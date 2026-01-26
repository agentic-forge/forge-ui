/**
 * Key management composable for BYOK (Bring Your Own Key) support.
 *
 * Follows the singleton composable pattern - module-level refs maintain
 * global state across all components.
 */

import { ref, watch, computed } from 'vue'

// Storage key for persisted keys
const KEYS_STORAGE_KEY = 'forge_keys'

// Supported LLM providers
export type LLMProvider = 'openrouter' | 'openai' | 'anthropic' | 'google'

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
const llmKey = ref('')
const llmProvider = ref<LLMProvider>('openrouter')
const mcpKeys = ref<Record<string, string>>({})
const persistKeys = ref(false)

// Server configuration (from /config endpoint)
const serverProviders = ref<Record<string, boolean>>({})
const allowByok = ref(true)

/**
 * Load keys from localStorage if previously saved.
 */
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(KEYS_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      llmKey.value = data.llmKey || ''
      llmProvider.value = data.llmProvider || 'openrouter'
      mcpKeys.value = data.mcpKeys || {}
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
          llmKey: llmKey.value,
          llmProvider: llmProvider.value,
          mcpKeys: mcpKeys.value,
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
watch([llmKey, llmProvider, mcpKeys], () => {
  if (persistKeys.value) {
    saveToStorage()
  }
}, { deep: true })

export function useKeys() {
  /**
   * Check if user has an LLM key configured (either their own or server has one).
   */
  const hasLlmKey = computed(() => {
    // User has their own key
    if (llmKey.value) return true
    // Check if server has a key for current provider
    return serverProviders.value[llmProvider.value] === true
  })

  /**
   * Check if user has provided their own key (BYOK mode).
   */
  const isUsingByok = computed(() => !!llmKey.value)

  /**
   * Get the current provider info.
   */
  const currentProviderInfo = computed(() => PROVIDER_INFO[llmProvider.value])

  /**
   * Set LLM key for current session.
   */
  function setLlmKey(key: string, provider?: LLMProvider): void {
    llmKey.value = key
    if (provider) {
      llmProvider.value = provider
    }
  }

  /**
   * Set LLM provider.
   */
  function setLlmProvider(provider: LLMProvider): void {
    llmProvider.value = provider
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
    llmKey.value = ''
    mcpKeys.value = {}
    clearStorage()
  }

  /**
   * Get headers for API requests (BYOK headers).
   * Only includes headers if user has provided their own keys.
   */
  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    if (llmKey.value) {
      headers['X-LLM-Key'] = llmKey.value
      headers['X-LLM-Provider'] = llmProvider.value
    }

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

  return {
    // State (reactive)
    llmKey,
    llmProvider,
    mcpKeys,
    persistKeys,
    serverProviders,
    allowByok,

    // Computed
    hasLlmKey,
    isUsingByok,
    currentProviderInfo,

    // Methods
    setLlmKey,
    setLlmProvider,
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
