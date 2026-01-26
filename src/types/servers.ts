/**
 * Custom MCP Server Types
 *
 * Types for user-configured MCP servers that connect directly
 * through forge-ui, bypassing Armory.
 */

export type MCPServerStatus = 'unknown' | 'connected' | 'error'

export interface MCPServerConfig {
  id: string // Generated UUID
  name: string // User-friendly name (used as @name/ prefix)
  url: string // MCP endpoint URL
  apiKey?: string // Optional API key for authentication
  enabled: boolean // Toggle to enable/disable
  status: MCPServerStatus // Connection status
  lastError?: string // Last error message if status is 'error'
  toolCount?: number // Number of tools available
  tools?: MCPToolDef[] // Cached tools from this server
  createdAt: string // ISO timestamp
}

/**
 * Validation response from /mcp/validate endpoint
 */
export interface MCPValidateResponse {
  valid: boolean
  tool_count: number
  tools: MCPToolDef[]
  error?: string
}

/**
 * Tool definition from MCP server
 */
export interface MCPToolDef {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/**
 * Server config format for API requests
 * (sent to orchestrator in extra_mcp_servers)
 */
export interface MCPServerForRequest {
  name: string
  url: string
  api_key?: string
}
