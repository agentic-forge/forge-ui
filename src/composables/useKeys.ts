/**
 * Key management composable for BYOK (Bring Your Own Key) support.
 *
 * Follows the singleton composable pattern - module-level refs maintain
 * global state across all components.
 *
 * Supports multiple provider keys simultaneously - each provider can have
 * its own API key configured.
 */

import { ref, watch, computed } from 'vue'

// Storage key for persisted keys
const KEYS_STORAGE_KEY = 'forge_keys'

// Supported LLM providers
export type LLMProvider = 'openrouter' | 'openai' | 'anthropic' | 'google'

// All supported providers
export const ALL_PROVIDERS: LLMProvider[] = ['openrouter', 'openai', 'anthropic', 'google']

// Provider display info
export const PROVIDER_INFO: Record<LLMProvider, { label: string; keyUrl: string; placeholder: string }> = {
  openrouter: {
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
  },
  openai: {
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  google: {
    label: 'Google',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
}

// Module-level state (singleton pattern)
// Store keys per provider instead of a single key
const llmKeys = ref<Record<LLMProvider, string>>({
  openrouter: '',
  openai: '',
  anthropic: '',
  google: '',
})
const mcpKeys = ref<Record<string, string>>({})
const persistKeys = ref(false)

// Server configuration (from /config endpoint)
const serverProviders = ref<Record<string, boolean>>({})
const allowByok = ref(true)

// Legacy: keep track of "active" provider for backward compatibility
const activeProvider = ref<LLMProvider>('openrouter')

/**
 * Load keys from localStorage if previously saved.
 */
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)

      // Handle new format (llmKeys object)
      if (data.llmKeys) {
        llmKeys.value = {
          openrouter: data.llmKeys.openrouter || '',
          openai: data.llmKeys.openai || '',
          anthropic: data.llmKeys.anthropic || '',
          google: data.llmKeys.google || '',
        }
      }
      // Handle legacy format (single llmKey + llmProvider)
      else if (data.llmKey && data.llmProvider) {
        llmKeys.value[data.llmProvider as LLMProvider] = data.llmKey
      }

      mcpKeys.value = data.mcpKeys || {}
      activeProvider.value = data.activeProvider || data.llmProvider || 'openrouter'
      persistKeys.value = true // They have saved keys, so persistence is on
    }
  } catch (e) {
    console.warn('Failed to load keys from storage:', e)
  }
}

/**
 * Save keys to localStorage (only if persistence is enabled).
 */
function saveToStorage(): void {
  if (persistKeys.value) {
    try {
      localStorage.setItem(
        KEYS_STORAGE_KEY,
        JSON.stringify({
          llmKeys: llmKeys.value,
          mcpKeys: mcpKeys.value,
          activeProvider: activeProvider.value,
        })
      )
    } catch (e) {
      console.warn('Failed to save keys to storage:', e)
    }
  }
}

/**
 * Clear keys from localStorage.
 */
function clearStorage(): void {
  try {
    localStorage.removeItem(KEYS_STORAGE_KEY)
  } catch (e) {
    console.warn('Failed to clear keys from storage:', e)
  }
}

// Load keys on module init
loadFromStorage()

// Watch for changes and auto-save if persistence is enabled
watch([llmKeys, mcpKeys, activeProvider], () => {
  if (persistKeys.value) {
    saveToStorage()
  }
}, { deep: true })

export function useKeys() {
  /**
   * Check if user has an LLM key configured for a specific provider.
   */
  function hasKeyForProvider(provider: LLMProvider): boolean {
    // User has their own key for this provider
    if (llmKeys.value[provider]) return true
    // Server has a key for this provider
    return serverProviders.value[provider] === true
  }

  /**
   * Check if user has any LLM key configured.
   */
  const hasAnyLlmKey = computed(() => {
    return ALL_PROVIDERS.some(p => llmKeys.value[p] || serverProviders.value[p])
  })

  /**
   * Check if user has provided their own key for a provider (BYOK mode).
   */
  function isUsingByokForProvider(provider: LLMProvider): boolean {
    return !!llmKeys.value[provider]
  }

  /**
   * Get all providers that have BYOK keys configured.
   */
  const providersWithByok = computed(() => {
    return ALL_PROVIDERS.filter(p => llmKeys.value[p])
  })

  /**
   * Set LLM key for a specific provider.
   */
  function setLlmKey(key: string, provider: LLMProvider): void {
    llmKeys.value = { ...llmKeys.value, [provider]: key }
    activeProvider.value = provider
  }

  /**
   * Get LLM key for a specific provider.
   */
  function getLlmKey(provider: LLMProvider): string {
    return llmKeys.value[provider] || ''
  }

  /**
   * Clear LLM key for a specific provider.
   */
  function clearLlmKey(provider: LLMProvider): void {
    llmKeys.value = { ...llmKeys.value, [provider]: '' }
  }

  /**
   * Enable/disable key persistence.
   * When enabling, saves current keys. When disabling, clears localStorage.
   */
  function setPersistence(enabled: boolean): void {
    persistKeys.value = enabled
    if (enabled) {
      saveToStorage()
    } else {
      clearStorage()
    }
  }

  /**
   * Set an MCP server key.
   */
  function setMcpKey(serverName: string, key: string): void {
    mcpKeys.value = { ...mcpKeys.value, [serverName]: key }
  }

  /**
   * Remove an MCP server key.
   */
  function removeMcpKey(serverName: string): void {
    const newKeys = { ...mcpKeys.value }
    delete newKeys[serverName]
    mcpKeys.value = newKeys
  }

  /**
   * Clear all keys (session and storage).
   */
  function clearKeys(): void {
    llmKeys.value = {
      openrouter: '',
      openai: '',
      anthropic: '',
      google: '',
    }
    mcpKeys.value = {}
    clearStorage()
  }

  /**
   * Get headers for API requests (BYOK headers).
   * Uses the key for the specified provider, or falls back to any available key.
   *
   * @param provider - The provider to get headers for (usually from model selection)
   */
  function getHeaders(provider?: LLMProvider): Record<string, string> {
    const headers: Record<string, string> = {}

    // Only send BYOK headers if the specified provider has a key configured
    // Do NOT fall back to a different provider's key - that would cause routing errors
    if (provider && llmKeys.value[provider]) {
      headers['X-LLM-Key'] = llmKeys.value[provider]
      headers['X-LLM-Provider'] = provider
    }
    // If no provider specified but there's only one BYOK key, use it
    // (This handles legacy cases where provider wasn't tracked)
    else if (!provider) {
      const configuredProviders = ALL_PROVIDERS.filter(p => llmKeys.value[p])
      if (configuredProviders.length === 1) {
        const p = configuredProviders[0]
        headers['X-LLM-Key'] = llmKeys.value[p]
        headers['X-LLM-Provider'] = p
      }
      // If multiple keys or no keys, don't send BYOK headers - let server decide
    }
    // If provider specified but no key for it, don't send BYOK headers
    // Server will use its own keys for that provider

    if (Object.keys(mcpKeys.value).length > 0) {
      headers['X-MCP-Keys'] = JSON.stringify(mcpKeys.value)
    }

    return headers
  }

  /**
   * Update server configuration (from /config endpoint).
   */
  function setServerConfig(providers: Record<string, boolean>, byokAllowed: boolean): void {
    serverProviders.value = providers
    allowByok.value = byokAllowed
  }

  /**
   * Check if a specific provider has a server-side key.
   */
  function serverHasKey(provider: LLMProvider): boolean {
    return serverProviders.value[provider] === true
  }

  // Legacy compatibility: expose llmKey and llmProvider as computed
  // These return the "active" provider's key for backward compatibility
  const llmKey = computed({
    get: () => llmKeys.value[activeProvider.value] || '',
    set: (val: string) => {
      llmKeys.value = { ...llmKeys.value, [activeProvider.value]: val }
    }
  })

  const llmProvider = computed({
    get: () => activeProvider.value,
    set: (val: LLMProvider) => {
      activeProvider.value = val
    }
  })

  return {
    // State (reactive)
    llmKeys,
    llmKey, // Legacy: computed for active provider
    llmProvider, // Legacy: computed for active provider
    mcpKeys,
    persistKeys,
    serverProviders,
    allowByok,

    // Computed
    hasAnyLlmKey,
    providersWithByok,

    // Methods
    setLlmKey,
    getLlmKey,
    clearLlmKey,
    hasKeyForProvider,
    isUsingByokForProvider,
    setPersistence,
    setMcpKey,
    removeMcpKey,
    clearKeys,
    getHeaders,
    setServerConfig,
    serverHasKey,
    loadFromStorage,
  }
}
