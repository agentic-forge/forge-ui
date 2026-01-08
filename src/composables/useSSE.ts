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
  disconnect: () => void
  clearDebugEvents: () => void
}

export function useSSE(): UseSSEReturn {
  const status = ref<SSEConnectionStatus>('disconnected')
  const debugEvents = ref<DebugEvent[]>([])
  let eventSource: EventSource | null = null
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

  function disconnect(): void {
    if (eventSource) {
      eventSource.close()
      eventSource = null
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
    disconnect,
    clearDebugEvents,
  }
}
