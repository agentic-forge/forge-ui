import { ref, type Ref } from 'vue'
import type {
  SSEEventType,
  SSEEventData,
  DebugEvent,
  TokenEvent,
  ThinkingEvent,
  ToolCallEvent,
  ToolResultEvent,
  CompleteEvent,
  ErrorEvent,
} from '@/types'

export type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SSEHandlers {
  onToken?: (event: TokenEvent) => void
  onThinking?: (event: ThinkingEvent) => void
  onToolCall?: (event: ToolCallEvent) => void
  onToolResult?: (event: ToolResultEvent) => void
  onComplete?: (event: CompleteEvent) => void
  onError?: (event: ErrorEvent) => void
  onPing?: () => void
}

export interface UseSSEReturn {
  status: Ref<SSEConnectionStatus>
  debugEvents: Ref<DebugEvent[]>
  connect: (url: string, handlers: SSEHandlers) => void
  connectPost: (url: string, body: unknown, handlers: SSEHandlers) => void
  disconnect: () => void
  clearDebugEvents: () => void
}

export function useSSE(): UseSSEReturn {
  const status = ref<SSEConnectionStatus>('disconnected')
  const debugEvents = ref<DebugEvent[]>([])
  let eventSource: EventSource | null = null
  let abortController: AbortController | null = null
  let eventIdCounter = 0

  function parseEventData(type: SSEEventType, rawData: string): SSEEventData | null {
    try {
      return JSON.parse(rawData) as SSEEventData
    } catch {
      console.error(`Failed to parse SSE event data for type ${type}:`, rawData)
      return null
    }
  }

  function addDebugEvent(type: SSEEventType, data: SSEEventData, raw: string): void {
    const event: DebugEvent = {
      id: `event-${eventIdCounter++}`,
      type,
      data,
      timestamp: new Date(),
      raw,
    }
    debugEvents.value = [...debugEvents.value.slice(-99), event] // Keep last 100
  }

  function handleSSEEvent(
    eventType: string,
    eventData: string,
    handlers: SSEHandlers
  ): boolean {
    // Returns true if stream should end
    const type = eventType as SSEEventType

    switch (type) {
      case 'token': {
        const data = parseEventData('token', eventData) as TokenEvent | null
        if (data) {
          addDebugEvent('token', data, eventData)
          handlers.onToken?.(data)
        }
        break
      }
      case 'thinking': {
        const data = parseEventData('thinking', eventData) as ThinkingEvent | null
        if (data) {
          addDebugEvent('thinking', data, eventData)
          handlers.onThinking?.(data)
        }
        break
      }
      case 'tool_call': {
        const data = parseEventData('tool_call', eventData) as ToolCallEvent | null
        if (data) {
          addDebugEvent('tool_call', data, eventData)
          handlers.onToolCall?.(data)
        }
        break
      }
      case 'tool_result': {
        const data = parseEventData('tool_result', eventData) as ToolResultEvent | null
        if (data) {
          addDebugEvent('tool_result', data, eventData)
          handlers.onToolResult?.(data)
        }
        break
      }
      case 'complete': {
        const data = parseEventData('complete', eventData) as CompleteEvent | null
        if (data) {
          addDebugEvent('complete', data, eventData)
          handlers.onComplete?.(data)
        }
        return true // End stream
      }
      case 'error': {
        const data = parseEventData('error', eventData) as ErrorEvent | null
        if (data) {
          addDebugEvent('error', data, eventData)
          handlers.onError?.(data)
        }
        return true // End stream
      }
      case 'ping': {
        const data = parseEventData('ping', eventData)
        if (data) {
          addDebugEvent('ping', data, eventData)
          handlers.onPing?.()
        }
        break
      }
    }
    return false
  }

  function connect(url: string, handlers: SSEHandlers): void {
    // Disconnect existing connection
    disconnect()

    status.value = 'connecting'

    try {
      eventSource = new EventSource(url)

      eventSource.onopen = () => {
        status.value = 'connected'
      }

      eventSource.onerror = () => {
        status.value = 'error'
        // EventSource will automatically reconnect
      }

      // Token event
      eventSource.addEventListener('token', (event: MessageEvent) => {
        const data = parseEventData('token', event.data) as TokenEvent | null
        if (data) {
          addDebugEvent('token', data, event.data)
          handlers.onToken?.(data)
        }
      })

      // Thinking event
      eventSource.addEventListener('thinking', (event: MessageEvent) => {
        const data = parseEventData('thinking', event.data) as ThinkingEvent | null
        if (data) {
          addDebugEvent('thinking', data, event.data)
          handlers.onThinking?.(data)
        }
      })

      // Tool call event
      eventSource.addEventListener('tool_call', (event: MessageEvent) => {
        const data = parseEventData('tool_call', event.data) as ToolCallEvent | null
        if (data) {
          addDebugEvent('tool_call', data, event.data)
          handlers.onToolCall?.(data)
        }
      })

      // Tool result event
      eventSource.addEventListener('tool_result', (event: MessageEvent) => {
        const data = parseEventData('tool_result', event.data) as ToolResultEvent | null
        if (data) {
          addDebugEvent('tool_result', data, event.data)
          handlers.onToolResult?.(data)
        }
      })

      // Complete event
      eventSource.addEventListener('complete', (event: MessageEvent) => {
        const data = parseEventData('complete', event.data) as CompleteEvent | null
        if (data) {
          addDebugEvent('complete', data, event.data)
          handlers.onComplete?.(data)
        }
        // Disconnect after complete
        disconnect()
      })

      // Error event
      eventSource.addEventListener('error', (event: MessageEvent) => {
        // This is an SSE error event from the server, not a connection error
        if (event.data) {
          const data = parseEventData('error', event.data) as ErrorEvent | null
          if (data) {
            addDebugEvent('error', data, event.data)
            handlers.onError?.(data)
          }
        }
        disconnect()
      })

      // Ping event
      eventSource.addEventListener('ping', (event: MessageEvent) => {
        const data = parseEventData('ping', event.data)
        if (data) {
          addDebugEvent('ping', data, event.data)
          handlers.onPing?.()
        }
      })
    } catch (error) {
      status.value = 'error'
      console.error('Failed to create EventSource:', error)
    }
  }

  // Connect via POST request with streaming response
  async function connectPost(url: string, body: unknown, handlers: SSEHandlers): Promise<void> {
    // Disconnect existing connection
    disconnect()

    status.value = 'connecting'
    abortController = new AbortController()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      status.value = 'connected'

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      // Track event state across chunk reads
      let currentEventType = ''
      let currentEventData = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events from buffer
        // Handle both \n and \r\n line endings
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            currentEventData = line.slice(5).trim()
          } else if (line === '' && currentEventType && currentEventData) {
            // Empty line signals end of event
            const shouldEnd = handleSSEEvent(currentEventType, currentEventData, handlers)
            currentEventType = ''
            currentEventData = ''
            if (shouldEnd) {
              reader.cancel()
              disconnect()
              return
            }
          }
        }
      }

      // Stream ended naturally
      disconnect()
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Intentional disconnect
        status.value = 'disconnected'
      } else {
        status.value = 'error'
        console.error('SSE POST connection error:', error)
        handlers.onError?.({
          code: 'CONNECTION_ERROR',
          message: (error as Error).message,
          retryable: true,
        })
      }
    }
  }

  function disconnect(): void {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    status.value = 'disconnected'
  }

  function clearDebugEvents(): void {
    debugEvents.value = []
  }

  return {
    status,
    debugEvents,
    connect,
    connectPost,
    disconnect,
    clearDebugEvents,
  }
}
