/**
 * Custom MCP Servers composable
 *
 * Follows the singleton composable pattern - module-level refs maintain
 * global state across all components.
 *
 * Manages user-configured MCP servers that connect directly through
 * forge-ui, bypassing Armory.
 */

import { ref, computed, watch } from 'vue'
import type { Tool } from '@/types/conversation'
import type {
  MCPServerConfig,
  MCPServerForRequest,
  MCPValidateResponse,
} from '@/types/servers'

// Storage key for persisted servers
const SERVERS_STORAGE_KEY = 'forge_mcp_servers'

// API URL from environment (use ?? so empty string works for production)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4041'

// Module-level state (singleton pattern)
const servers = ref<MCPServerConfig[]>([])

/**
 * Generate an ID for new servers (matches forge-ui ID format)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Load servers from localStorage
 */
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(SERVERS_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      if (Array.isArray(data)) {
        servers.value = data
      }
    }
  } catch (e) {
    console.warn('Failed to load servers from storage:', e)
  }
}

/**
 * Save servers to localStorage
 */
function saveToStorage(): void {
  try {
    localStorage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(servers.value))
  } catch (e) {
    console.warn('Failed to save servers to storage:', e)
  }
}

// Load servers on module init
loadFromStorage()

// Watch for changes and auto-save
watch(
  servers,
  () => {
    saveToStorage()
  },
  { deep: true }
)

export function useServers() {
  /**
   * Get enabled servers only
   */
  const enabledServers = computed(() => servers.value.filter((s) => s.enabled))

  /**
   * Get servers formatted for API request payload
   */
  const serversForRequest = computed<MCPServerForRequest[]>(() =>
    enabledServers.value.map((s) => ({
      name: s.name,
      url: s.url,
      api_key: s.apiKey || undefined,
    }))
  )

  /**
   * Check if any servers are configured
   */
  const hasServers = computed(() => servers.value.length > 0)

  /**
   * Check if any servers are enabled
   */
  const hasEnabledServers = computed(() => enabledServers.value.length > 0)

  /**
   * Get all tools from enabled custom servers, with prefixed names
   * Uses _serverName__toolName format (valid for all LLM providers)
   */
  const customServerTools = computed<Tool[]>(() => {
    const tools: Tool[] = []
    for (const server of enabledServers.value) {
      if (server.tools && server.status === 'connected') {
        for (const tool of server.tools) {
          tools.push({
            name: `_${server.name}__${tool.name}`,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })
        }
      }
    }
    return tools
  })

  /**
   * Add a new server configuration
   */
  function addServer(config: Omit<MCPServerConfig, 'id' | 'createdAt'>): MCPServerConfig {
    const newServer: MCPServerConfig = {
      ...config,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    servers.value = [...servers.value, newServer]
    return newServer
  }

  /**
   * Update an existing server configuration
   */
  function updateServer(id: string, updates: Partial<Omit<MCPServerConfig, 'id' | 'createdAt'>>): void {
    const index = servers.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      servers.value = [
        ...servers.value.slice(0, index),
        { ...servers.value[index], ...updates },
        ...servers.value.slice(index + 1),
      ]
    }
  }

  /**
   * Remove a server configuration
   */
  function removeServer(id: string): void {
    servers.value = servers.value.filter((s) => s.id !== id)
  }

  /**
   * Toggle server enabled/disabled
   */
  function toggleServer(id: string): void {
    const server = servers.value.find((s) => s.id === id)
    if (server) {
      updateServer(id, { enabled: !server.enabled })
    }
  }

  /**
   * Get a server by ID
   */
  function getServer(id: string): MCPServerConfig | undefined {
    return servers.value.find((s) => s.id === id)
  }

  /**
   * Validate/test a server connection
   * Returns validation result from orchestrator
   */
  async function validateServer(
    url: string,
    apiKey?: string
  ): Promise<MCPValidateResponse> {
    const response = await fetch(`${API_URL}/mcp/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        api_key: apiKey || null,
      }),
    })

    if (!response.ok) {
      throw new Error(`Validation request failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Test a specific server and update its status and tools
   */
  async function testServer(id: string): Promise<MCPValidateResponse> {
    const server = servers.value.find((s) => s.id === id)
    if (!server) {
      throw new Error('Server not found')
    }

    try {
      const result = await validateServer(server.url, server.apiKey)

      updateServer(id, {
        status: result.valid ? 'connected' : 'error',
        toolCount: result.tool_count,
        tools: result.valid ? result.tools : undefined,
        lastError: result.error,
      })

      return result
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error'
      updateServer(id, {
        status: 'error',
        tools: undefined,
        lastError: errorMsg,
      })
      throw e
    }
  }

  /**
   * Test all enabled servers and update their status
   */
  async function testAllServers(): Promise<void> {
    const promises = enabledServers.value.map((server) =>
      testServer(server.id).catch(() => {
        // Errors already handled in testServer
      })
    )
    await Promise.all(promises)
  }

  /**
   * Clear all servers
   */
  function clearServers(): void {
    servers.value = []
  }

  return {
    // State (reactive)
    servers,

    // Computed
    enabledServers,
    serversForRequest,
    hasServers,
    hasEnabledServers,
    customServerTools,

    // Methods
    addServer,
    updateServer,
    removeServer,
    toggleServer,
    getServer,
    validateServer,
    testServer,
    testAllServers,
    clearServers,
    loadFromStorage,
  }
}
