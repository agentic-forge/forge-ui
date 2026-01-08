/**
 * SSE Event Types
 * These match the Python Pydantic models in forge-orchestrator
 */

export interface TokenEvent {
  token: string
  cumulative: string
}

export interface ThinkingEvent {
  content: string
  cumulative: string
}

export interface ToolCallEvent {
  id: string
  tool_name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'executing' | 'complete' | 'error'
}

export interface ToolResultEvent {
  tool_call_id: string
  result: unknown
  is_error: boolean
  latency_ms: number
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
}

export interface CompleteEvent {
  response: string
  usage?: TokenUsage
}

export interface ErrorEvent {
  code: string
  message: string
  retryable: boolean
}

export interface PingEvent {
  timestamp: number
}

export type SSEEventType =
  | 'token'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'complete'
  | 'error'
  | 'ping'

export type SSEEventData =
  | TokenEvent
  | ThinkingEvent
  | ToolCallEvent
  | ToolResultEvent
  | CompleteEvent
  | ErrorEvent
  | PingEvent

export interface SSEEvent {
  type: SSEEventType
  data: SSEEventData
  timestamp: Date
}

/**
 * Debug event for display in debug panel
 */
export interface DebugEvent {
  id: string
  type: SSEEventType
  data: SSEEventData
  timestamp: Date
  raw: string
}
