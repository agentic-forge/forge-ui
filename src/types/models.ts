/**
 * Model Management Types
 *
 * Types for the new multi-provider model management system.
 */

/**
 * Provider information
 */
export interface ProviderInfo {
  id: string
  name: string
  configured: boolean // Has API key
  has_api: boolean // Supports API fetching
  model_count: number
  enabled: boolean
}

export interface ProvidersResponse {
  providers: ProviderInfo[]
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  tools: boolean
  vision: boolean
  reasoning: boolean
}

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string
  display_name: string
  category: 'chat' | 'embedding' | 'other'
  source: 'api' | 'manual' | 'legacy'
  capabilities: ModelCapabilities
  favorited: boolean
  added_at: string
  last_used_at?: string
}

/**
 * Reference to a model (provider + model_id)
 */
export interface ModelReference {
  provider: string
  model_id: string
}

/**
 * Grouped models response for management modal
 */
export interface GroupedModelsResponse {
  providers: Record<string, CategoryModels>
  favorites: ModelReference[]
  recent: ModelReference[]
  default_model: ModelReference | null
}

export interface CategoryModels {
  chat: ModelConfig[]
  embedding: ModelConfig[]
  other: ModelConfig[]
}

/**
 * Model suggestion for manual addition
 */
export interface ModelSuggestion {
  id: string
  display_name: string
  recommended?: boolean
}

export interface SuggestionsResponse {
  provider: string
  suggestions: ModelSuggestion[]
}

/**
 * Request/Response types for model management
 */

export interface AddModelRequest {
  provider: string
  model_id: string
  display_name?: string
  capabilities?: ModelCapabilities
}

export interface AddModelResponse {
  status: string
  model: ModelConfig
}

export interface UpdateModelConfigRequest {
  favorited?: boolean
  display_name?: string
  capabilities?: ModelCapabilities
}

export interface FetchModelsRequest {
  provider: string
}

export interface DeprecatedModel {
  id: string
  reason: string
}

export interface FetchModelsResponse {
  status: string
  provider: string
  models_added: number
  models_updated: number
  deprecated: DeprecatedModel[]
}

export interface UpdateProviderRequest {
  enabled: boolean
}
