/**
 * Conversation Types
 * These match the Python Pydantic models in forge-orchestrator
 */

import type { TokenUsage } from './messages'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result'
export type MessageStatus = 'complete' | 'cancelled' | 'error' | 'streaming'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: string

  // For assistant messages
  model?: string
  usage?: TokenUsage

  // For tool_call messages
  tool_name?: string
  tool_arguments?: Record<string, unknown>
  tool_call_id?: string

  // For tool_result messages
  tool_result?: unknown
  is_error?: boolean
  latency_ms?: number

  // Status
  status: MessageStatus
}

export interface SystemPromptHistory {
  content: string
  set_at: string
}

export interface ConversationMetadata {
  id: string
  created_at: string
  updated_at: string
  model: string
  system_prompt: string
  system_prompt_history: SystemPromptHistory[]
  total_tokens: number
  message_count: number
}

export interface Conversation {
  metadata: ConversationMetadata
  messages: Message[]
}

/**
 * API Request/Response Types
 */

export interface CreateConversationRequest {
  model?: string
  system_prompt?: string
}

export interface SendMessageRequest {
  content: string
  model?: string
}

export interface UpdateSystemPromptRequest {
  content: string
}

export interface UpdateModelRequest {
  model: string
}

export interface HealthResponse {
  status: string
  armory_connected: boolean
  active_runs: number
}

export interface Tool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface ToolsResponse {
  tools: Tool[]
}

/**
 * Model Types (from OpenRouter via orchestrator)
 */

export interface ModelPricing {
  prompt: number
  completion: number
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  context_length: number
  pricing: ModelPricing
  supports_tools: boolean
  supports_vision: boolean
  modality?: string
  created?: number
}

export interface ModelsResponse {
  providers: string[]
  models: ModelInfo[]
  cached_at: string | null
}

export interface ModelsRefreshResponse {
  status: string
  model_count: number
  provider_count: number
}

/**
 * UI State Types
 */

export interface StreamingState {
  isStreaming: boolean
  currentResponse: string
  currentThinking: string
  toolCalls: Map<string, ToolCallState>
}

export interface ToolCallState {
  id: string
  tool_name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'executing' | 'complete' | 'error'
  result?: unknown
  is_error?: boolean
  latency_ms?: number
}
