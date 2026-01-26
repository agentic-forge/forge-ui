/**
 * Settings composable for BYOK model selection and preferences.
 *
 * Handles fetching models from provider APIs using user's API keys
 * and managing model favorites for quick access.
 */

import { ref, computed, watch } from 'vue'
import type { LLMProvider } from './useKeys'

// Storage key for settings
const SETTINGS_STORAGE_KEY = 'forge_settings'

// Model info from provider APIs
export interface ProviderModel {
  id: string
  name: string
  context_length?: number
  pricing?: {
    prompt: number
    completion: number
  }
}

// Module-level state (singleton pattern)
const providerModels = ref<ProviderModel[]>([])
const selectedModel = ref('')
const favoriteModelIds = ref<string[]>([])
const isLoadingModels = ref(false)
const modelsError = ref<string | null>(null)

/**
 * Load settings from localStorage.
 */
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      selectedModel.value = data.selectedModel || ''
      favoriteModelIds.value = data.favoriteModelIds || []
    }
  } catch (e) {
    console.warn('Failed to load settings from storage:', e)
  }
}

/**
 * Save settings to localStorage.
 */
function saveToStorage(): void {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        selectedModel: selectedModel.value,
        favoriteModelIds: favoriteModelIds.value,
      })
    )
  } catch (e) {
    console.warn('Failed to save settings to storage:', e)
  }
}

// Load settings on module init
loadFromStorage()

// Auto-save on changes
watch([selectedModel, favoriteModelIds], () => {
  saveToStorage()
}, { deep: true })

// Static Anthropic models (no API endpoint available)
const ANTHROPIC_MODELS: ProviderModel[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', context_length: 200000 },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', context_length: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', context_length: 200000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', context_length: 200000 },
]

// Static Google models (Gemini)
const GOOGLE_MODELS: ProviderModel[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', context_length: 1000000 },
  { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', context_length: 1000000 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context_length: 2000000 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', context_length: 1000000 },
]

export function useSettings() {
  /**
   * Get favorite models from the current provider models list.
   */
  const favoriteModels = computed(() => {
    return providerModels.value.filter((m) => favoriteModelIds.value.includes(m.id))
  })

  /**
   * Get non-favorite models.
   */
  const otherModels = computed(() => {
    return providerModels.value.filter((m) => !favoriteModelIds.value.includes(m.id))
  })

  /**
   * Set the selected model.
   */
  function setModel(modelId: string): void {
    selectedModel.value = modelId
  }

  /**
   * Toggle a model's favorite status.
   */
  function toggleFavorite(modelId: string): void {
    const idx = favoriteModelIds.value.indexOf(modelId)
    if (idx >= 0) {
      favoriteModelIds.value = favoriteModelIds.value.filter((id) => id !== modelId)
    } else {
      favoriteModelIds.value = [...favoriteModelIds.value, modelId]
    }
  }

  /**
   * Check if a model is favorited.
   */
  function isFavorite(modelId: string): boolean {
    return favoriteModelIds.value.includes(modelId)
  }

  /**
   * Fetch available models for a provider using the user's API key.
   */
  async function fetchModelsForProvider(provider: LLMProvider, apiKey: string): Promise<void> {
    isLoadingModels.value = true
    modelsError.value = null
    providerModels.value = []

    try {
      if (provider === 'openrouter') {
        // OpenRouter allows client-side model listing
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`)
        }

        const data = await response.json()
        providerModels.value = data.data.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          context_length: m.context_length,
          pricing: m.pricing,
        }))

        // Sort by name
        providerModels.value.sort((a, b) => a.name.localeCompare(b.name))
      } else if (provider === 'openai') {
        // OpenAI models endpoint
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`)
        }

        const data = await response.json()
        // Filter to chat models
        providerModels.value = data.data
          .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
          .map((m: any) => ({
            id: m.id,
            name: m.id,
          }))
          .sort((a: ProviderModel, b: ProviderModel) => a.name.localeCompare(b.name))
      } else if (provider === 'anthropic') {
        // Anthropic doesn't have a models endpoint, use static list
        providerModels.value = [...ANTHROPIC_MODELS]
      } else if (provider === 'google') {
        // Google doesn't have an easy client-side models endpoint, use static list
        providerModels.value = [...GOOGLE_MODELS]
      }

      // Auto-select first model if none selected
      if (!selectedModel.value && providerModels.value.length > 0) {
        selectedModel.value = providerModels.value[0].id
      }
    } catch (e) {
      console.error('Failed to fetch models:', e)
      modelsError.value = e instanceof Error ? e.message : 'Failed to fetch models'

      // Fall back to default model for the provider
      if (provider === 'openrouter') {
        selectedModel.value = 'anthropic/claude-sonnet-4'
      } else if (provider === 'openai') {
        selectedModel.value = 'gpt-4o'
      } else if (provider === 'anthropic') {
        providerModels.value = [...ANTHROPIC_MODELS]
        selectedModel.value = 'claude-sonnet-4-20250514'
      } else if (provider === 'google') {
        providerModels.value = [...GOOGLE_MODELS]
        selectedModel.value = 'gemini-2.0-flash'
      }
    } finally {
      isLoadingModels.value = false
    }
  }

  /**
   * Clear models (when switching providers or clearing keys).
   */
  function clearModels(): void {
    providerModels.value = []
    modelsError.value = null
  }

  return {
    // State (reactive)
    providerModels,
    selectedModel,
    favoriteModelIds,
    isLoadingModels,
    modelsError,

    // Computed
    favoriteModels,
    otherModels,

    // Methods
    setModel,
    toggleFavorite,
    isFavorite,
    fetchModelsForProvider,
    clearModels,
    loadFromStorage,
  }
}
