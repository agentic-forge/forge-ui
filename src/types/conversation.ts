/**
 * Conversation Types
 *
 * The conversation file format is defined by JSON Schema:
 * schemas/conversation.v1.schema.json
 *
 * These TypeScript types are manually maintained to match the schema.
 * The schema serves as documentation and can be used for runtime validation.
 */

import type { TokenUsage, UiMetadata } from './messages'

/** Current schema version for conversation export format */
export const CONVERSATION_SCHEMA_VERSION = '1.1.0'

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
  thinking?: string

  // For tool_call messages
  tool_name?: string
  tool_arguments?: Record<string, unknown>
  tool_call_id?: string

  // For tool_result messages
  tool_result?: unknown
  is_error?: boolean
  latency_ms?: number
  result_format?: 'json' | 'toon'
  ui_metadata?: UiMetadata

  // For user messages - per-turn settings
  enable_tools?: boolean
  use_toon_format?: boolean
  use_tool_rag_mode?: boolean

  // Status
  status: MessageStatus
}

export interface Tool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface ConversationMetadata {
  id: string
  title: string
  created_at: string
  updated_at: string
  model: string
  system_prompt: string
  tools: Tool[]
  total_tokens: number
  message_count: number
  use_toon_format?: boolean
}

export interface Conversation {
  /** Schema version for migration support */
  version: string
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
  ui_metadata?: UiMetadata
}

/**
 * Advanced View Settings
 *
 * Controls which information is displayed in the advanced view mode.
 * Persisted to localStorage.
 */
export interface AdvancedViewSettings {
  showContextSize: boolean
  showTokenUsage: boolean
  showThinkingSection: boolean
  showModelName: boolean
  enableToolCalling: boolean
  useToonFormat: boolean
  useToolRag: boolean
}

/**
 * Context tracking information for a message
 */
export interface ContextInfo {
  cumulativeTokens: number
  perTurnInput: number
  contextLimit: number
  percentUsed: number
}
