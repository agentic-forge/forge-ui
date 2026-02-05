import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useTheme } from './useTheme'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

export interface AppContext {
  [key: string]: unknown
}

export interface UseAppBridgeOptions {
  iframeRef: Ref<HTMLIFrameElement | null>
  serverPrefix: string
  onContextUpdate?: (context: AppContext) => void
}

export interface UseAppBridgeReturn {
  context: Ref<AppContext | null>
  start: () => void
  stop: () => void
}

/**
 * Host-side JSON-RPC postMessage bridge for MCP Apps.
 *
 * Handles messages from sandboxed iframes:
 * - updateModelContext: Store context for display
 * - callServerTool: Proxy tool calls to orchestrator
 * - openLink: Open URLs in new tab
 * - getTheme: Return current dark/light mode
 * - log: Console logging from iframe
 */
export function useAppBridge(options: UseAppBridgeOptions): UseAppBridgeReturn {
  const { iframeRef, serverPrefix, onContextUpdate } = options
  const { isDark } = useTheme()
  const context = ref<AppContext | null>(null)
  let listening = false

  async function handleMessage(event: MessageEvent): Promise<void> {
    const iframe = iframeRef.value
    if (!iframe) return

    // Security: only accept messages from our iframe
    if (event.source !== iframe.contentWindow) return

    const { method, params, id } = event.data || {}
    if (!method) return

    let result: unknown
    let error: { code: number; message: string } | undefined

    try {
      switch (method) {
        case 'updateModelContext': {
          context.value = params?.context || params
          onContextUpdate?.(context.value as AppContext)
          result = { ok: true }
          break
        }

        case 'callServerTool': {
          const toolName = params?.tool_name
          const toolArgs = params?.arguments || {}

          // Prefix tool name with server if not already prefixed
          const fullToolName = toolName.includes('__')
            ? toolName
            : `${serverPrefix}__${toolName}`

          const response = await fetch(`${API_URL}/api/tools/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool_name: fullToolName,
              arguments: toolArgs,
            }),
          })

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}))
            throw new Error(errBody.detail || `Tool call failed: ${response.statusText}`)
          }

          result = await response.json()
          break
        }

        case 'openLink': {
          const url = params?.url
          if (url && typeof url === 'string') {
            window.open(url, '_blank', 'noopener,noreferrer')
          }
          result = { ok: true }
          break
        }

        case 'getTheme': {
          result = { theme: isDark.value ? 'dark' : 'light' }
          break
        }

        case 'log': {
          const level = params?.level || 'log'
          const message = params?.message || ''
          const validLevels = ['log', 'info', 'warn', 'error', 'debug'] as const
          type LogLevel = typeof validLevels[number]
          const logLevel: LogLevel = validLevels.includes(level) ? level : 'log'
          console[logLevel](`[MCP App] ${message}`)
          result = { ok: true }
          break
        }

        default: {
          error = { code: -32601, message: `Method not found: ${method}` }
        }
      }
    } catch (e) {
      error = { code: -32000, message: (e as Error).message }
    }

    // Send JSON-RPC response back to iframe
    if (id !== undefined) {
      const response: Record<string, unknown> = { jsonrpc: '2.0', id }
      if (error) {
        response.error = error
      } else {
        response.result = result
      }
      iframe.contentWindow?.postMessage(response, '*')
    }
  }

  // Sync theme changes to iframe
  const stopThemeWatch = watch(isDark, (dark) => {
    const iframe = iframeRef.value
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          jsonrpc: '2.0',
          method: 'themeChanged',
          params: { theme: dark ? 'dark' : 'light' },
        },
        '*',
      )
    }
  })

  function start(): void {
    if (listening) return
    window.addEventListener('message', handleMessage)
    listening = true
  }

  function stop(): void {
    if (!listening) return
    window.removeEventListener('message', handleMessage)
    listening = false
  }

  onUnmounted(() => {
    stop()
    stopThemeWatch()
  })

  return { context, start, stop }
}
