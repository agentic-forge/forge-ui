import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type {
  Conversation,
  Message,
  ToolCallState,
  CreateConversationRequest,
  HealthResponse,
  Tool,
  DebugEvent,
  TokenUsage,
  ModelInfo,
  ModelsResponse,
  AdvancedViewSettings,
  ContextInfo,
  // New model management types
  ProviderInfo,
  GroupedModelsResponse,
  ModelReference,
  ModelSuggestion,
  ModelCapabilities,
  FetchModelsResponse,
  AddModelResponse,
} from '@/types'
import { CONVERSATION_SCHEMA_VERSION } from '@/types'
import { useSSE, type SSEConnectionStatus } from './useSSE'
import { useKeys } from './useKeys'
import { useSettings } from './useSettings'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'

// Global state (singleton pattern)
const conversation = ref<Conversation | null>(null)
const isStreaming = ref(false)
const currentResponse = ref('')
const currentThinking = ref('')
const toolCalls = ref<Map<string, ToolCallState>>(new Map())
const isAdvancedView = ref(loadAdvancedView())
const showDebugPanel = ref(false)
const showToolsPanel = ref(false)
const availableTools = ref<Tool[]>([])
const healthStatus = ref<HealthResponse | null>(null)
const messageDraft = ref(loadMessageDraft())
const preferredModel = ref(loadPreferredModel())
const availableModels = ref<ModelInfo[]>([])
const availableProviders = ref<string[]>([])
const modelsCachedAt = ref<string | null>(null)
const isLoadingModels = ref(false)

// New model management state
const providers = ref<ProviderInfo[]>([])
const groupedModels = ref<GroupedModelsResponse | null>(null)
const favoriteModels = ref<ModelReference[]>([])
const recentModels = ref<ModelReference[]>([])
const defaultModel = ref<ModelReference | null>(null)

// Advanced view settings
const ADVANCED_VIEW_SETTINGS_KEY = 'forge-ui-advanced-settings'
const DEFAULT_ADVANCED_VIEW_SETTINGS: AdvancedViewSettings = {
  showContextSize: true,
  showTokenUsage: true,
  showThinkingSection: true,
  showModelName: true,
  enableToolCalling: true,
  useToonFormat: false,
  useToolRag: false,
}
const advancedViewSettings = ref<AdvancedViewSettings>(loadAdvancedViewSettings())

// System prompt templates based on toggle states
const SYSTEM_PROMPT_TEMPLATES = {
  // No tools enabled - basic assistant
  noTools: `You are a helpful assistant. Answer questions directly and conversationally.

Note: External tools are currently disabled. If the user asks for something that would typically require tools (like checking the weather, searching the web, etc.), let them know that tool access is not available and offer to help in other ways.`,

  // Tools enabled, no RAG - standard tool use
  toolsOnly: `You are a helpful assistant with access to external tools.

When you need to perform actions like checking weather, searching the web, or other capabilities, use the available tools. Call tools when needed to provide accurate, up-to-date information.

Be concise in your responses and let the tool results speak for themselves.`,

  // Tools enabled with RAG - two-turn discovery flow
  toolsWithRag: `You are a helpful assistant with access to a dynamic tool discovery system.

## How Tool Discovery Works

Tools are discovered via search and become available in subsequent messages:

1. When you need a capability, call \`search_tools\` with a description of what you need
2. After searching, briefly confirm what tools you found (e.g., "I found a weather tool. Proceeding to get the weather...")
3. The discovered tools will be available in your next response - you can then call them directly

**Important:** After calling \`search_tools\`, do NOT attempt to call the discovered tools in the same response. Keep your response brief - just confirm what you found and that you'll proceed.

Only search for tools when you actually need external capabilities. For simple questions or conversations, respond directly.`,
}

// Track if user has manually modified the system prompt
const isSystemPromptUserModified = ref(false)

// SSE instance
const sse = useSSE()

function loadAdvancedView(): boolean {
  return localStorage.getItem('forge-ui-advanced-view') === 'true'
}

function saveAdvancedView(value: boolean): void {
  localStorage.setItem('forge-ui-advanced-view', value ? 'true' : 'false')
}

function loadMessageDraft(): string {
  return localStorage.getItem('forge-ui-message-draft') || ''
}

function saveMessageDraft(value: string): void {
  localStorage.setItem('forge-ui-message-draft', value)
}

function loadPreferredModel(): string {
  return localStorage.getItem('forge-ui-preferred-model') || DEFAULT_MODEL
}

function savePreferredModel(value: string): void {
  localStorage.setItem('forge-ui-preferred-model', value)
}

function loadAdvancedViewSettings(): AdvancedViewSettings {
  const stored = localStorage.getItem(ADVANCED_VIEW_SETTINGS_KEY)
  if (stored) {
    try {
      return { ...DEFAULT_ADVANCED_VIEW_SETTINGS, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_ADVANCED_VIEW_SETTINGS
    }
  }
  return DEFAULT_ADVANCED_VIEW_SETTINGS
}

function saveAdvancedViewSettings(settings: AdvancedViewSettings): void {
  localStorage.setItem(ADVANCED_VIEW_SETTINGS_KEY, JSON.stringify(settings))
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export interface UseConversationReturn {
  // State
  conversation: Ref<Conversation | null>
  isStreaming: Ref<boolean>
  currentResponse: Ref<string>
  currentThinking: Ref<string>
  toolCalls: Ref<Map<string, ToolCallState>>
  isAdvancedView: Ref<boolean>
  showDebugPanel: Ref<boolean>
  showToolsPanel: Ref<boolean>
  availableTools: Ref<Tool[]>
  healthStatus: Ref<HealthResponse | null>
  messageDraft: Ref<string>
  preferredModel: Ref<string>
  debugEvents: Ref<DebugEvent[]>
  sseStatus: Ref<SSEConnectionStatus>
  availableModels: Ref<ModelInfo[]>
  availableProviders: Ref<string[]>
  modelsCachedAt: Ref<string | null>
  isLoadingModels: Ref<boolean>
  // New model management state
  providers: Ref<ProviderInfo[]>
  groupedModels: Ref<GroupedModelsResponse | null>
  favoriteModels: Ref<ModelReference[]>
  recentModels: Ref<ModelReference[]>
  defaultModel: Ref<ModelReference | null>

  // Advanced view settings
  advancedViewSettings: Ref<AdvancedViewSettings>

  // System prompt state
  isSystemPromptUserModified: Ref<boolean>

  // Computed
  messages: ComputedRef<Message[]>
  isConnected: ComputedRef<boolean>
  currentModelContextLength: ComputedRef<number>

  // Actions
  createConversation: (request?: CreateConversationRequest) => Promise<void>
  deleteConversation: () => Promise<void>
  sendMessage: (content: string, model?: string) => Promise<void>
  cancelGeneration: () => Promise<void>
  retryFromMessage: (index: number) => Promise<void>
  deleteMessagesFrom: (index: number) => Promise<void>
  updateSystemPrompt: (content: string) => Promise<void>
  updateTitle: (title: string) => void
  updateModel: (model: string) => Promise<void>
  fetchTools: () => Promise<void>
  refreshTools: () => Promise<void>
  checkHealth: () => Promise<void>
  fetchConfig: () => Promise<void>
  toggleAdvancedView: () => void
  toggleDebugPanel: () => void
  toggleToolsPanel: () => void
  saveDraft: (content: string) => void
  clearDraft: () => void
  setPreferredModel: (model: string) => void
  importConversation: (file: File) => Promise<void>
  exportConversation: () => void
  fetchModels: () => Promise<void>
  refreshModels: () => Promise<void>
  // New model management actions
  fetchProviders: () => Promise<void>
  fetchModelsGrouped: () => Promise<void>
  addModelToProvider: (
    providerId: string,
    modelId: string,
    displayName?: string,
    capabilities?: ModelCapabilities
  ) => Promise<AddModelResponse>
  removeModelFromProvider: (providerId: string, modelId: string) => Promise<void>
  toggleModelFavorite: (providerId: string, modelId: string) => Promise<boolean | null>
  fetchModelsFromProvider: (providerId: string) => Promise<FetchModelsResponse>
  getProviderSuggestions: (providerId: string) => Promise<ModelSuggestion[]>
  setProviderEnabled: (providerId: string, enabled: boolean) => Promise<void>
  // Advanced view settings actions
  updateAdvancedViewSettings: (settings: Partial<AdvancedViewSettings>) => void
  // System prompt actions
  getDefaultSystemPrompt: () => string
  resetSystemPromptToDefault: () => void
  syncSystemPromptWithToggles: () => void
  getContextInfoForMessage: (messageIndex: number) => ContextInfo | null
}

export function useConversation(): UseConversationReturn {
  const messages = computed(() => conversation.value?.messages || [])

  const isConnected = computed(
    () => healthStatus.value?.status === 'ok' || healthStatus.value?.status === 'healthy'
  )

  // Get current model's context length
  const currentModelContextLength = computed(() => {
    if (!conversation.value) return 200000 // Default fallback
    const modelId = conversation.value.metadata.model
    const model = availableModels.value.find((m) => m.id === modelId)
    return model?.context_length || 200000
  })

  // Update advanced view settings
  function updateAdvancedViewSettings(settings: Partial<AdvancedViewSettings>): void {
    advancedViewSettings.value = { ...advancedViewSettings.value, ...settings }
    saveAdvancedViewSettings(advancedViewSettings.value)
  }

  // Calculate context info for a specific message
  function getContextInfoForMessage(messageIndex: number): ContextInfo | null {
    if (!conversation.value) return null

    const msgs = conversation.value.messages
    const targetMsg = msgs[messageIndex]

    // Only assistant messages have usage data
    if (targetMsg.role !== 'assistant' || !targetMsg.usage) return null

    // Calculate cumulative tokens up to this message
    let cumulativeTokens = 0
    for (let i = 0; i <= messageIndex; i++) {
      const msg = msgs[i]
      if (msg.role === 'assistant' && msg.usage) {
        cumulativeTokens += msg.usage.prompt_tokens + msg.usage.completion_tokens
      }
    }

    const contextLimit = currentModelContextLength.value

    return {
      cumulativeTokens,
      perTurnInput: targetMsg.usage.prompt_tokens,
      contextLimit,
      percentUsed: (cumulativeTokens / contextLimit) * 100,
    }
  }

  // Get the default system prompt based on current toggle states
  function getDefaultSystemPrompt(): string {
    if (!advancedViewSettings.value.enableToolCalling) {
      return SYSTEM_PROMPT_TEMPLATES.noTools
    }
    if (advancedViewSettings.value.useToolRag) {
      return SYSTEM_PROMPT_TEMPLATES.toolsWithRag
    }
    return SYSTEM_PROMPT_TEMPLATES.toolsOnly
  }

  // Create conversation locally (no server call)
  async function createConversation(request?: CreateConversationRequest): Promise<void> {
    const now = new Date().toISOString()
    const model = request?.model || preferredModel.value

    // Determine default system prompt based on current toggle states
    const defaultSystemPrompt = getDefaultSystemPrompt()

    conversation.value = {
      version: CONVERSATION_SCHEMA_VERSION,
      metadata: {
        id: generateId(),
        title: '',
        created_at: now,
        updated_at: now,
        model,
        system_prompt: request?.system_prompt ?? defaultSystemPrompt,
        tools: [],
        total_tokens: 0,
        message_count: 0,
      },
      messages: [],
    }

    // Reset user-modified flag (will be set if user explicitly provided a prompt)
    isSystemPromptUserModified.value = request?.system_prompt !== undefined &&
      !Object.values(SYSTEM_PROMPT_TEMPLATES).includes(request.system_prompt)

    // Update health status and fetch available tools
    await checkHealth()
    await fetchTools()

    // Capture tools snapshot in conversation metadata
    if (availableTools.value.length > 0) {
      conversation.value.metadata.tools = [...availableTools.value]
    }
  }

  // Delete conversation (just clear local state)
  async function deleteConversation(): Promise<void> {
    conversation.value = null
  }

  // Send message with full history to stateless backend
  async function sendMessage(content: string, model?: string): Promise<void> {
    if (!conversation.value || isStreaming.value) return

    // Determine per-turn settings before creating the message
    // In advanced mode, respect the settings; in basic mode, use defaults
    const enableTools = isAdvancedView.value ? advancedViewSettings.value.enableToolCalling : true
    const useToonFormat = isAdvancedView.value ? advancedViewSettings.value.useToonFormat : false
    const useToolRag = isAdvancedView.value ? advancedViewSettings.value.useToolRag : false

    // Add user message to local state with per-turn settings
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      status: 'complete',
      enable_tools: enableTools,
      use_toon_format: useToonFormat,
      use_tool_rag_mode: useToolRag,
    }
    conversation.value.messages.push(userMessage)
    conversation.value.metadata.message_count = conversation.value.messages.length

    // Reset streaming state
    isStreaming.value = true
    currentResponse.value = ''
    currentThinking.value = ''
    toolCalls.value = new Map()

    // Build message history for the API (only user and assistant messages)
    const messageHistory = conversation.value.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(0, -1) // Exclude the message we just added
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    // Track TOON usage in conversation metadata
    if (useToonFormat && !conversation.value.metadata.use_toon_format) {
      conversation.value.metadata.use_toon_format = true
    }

    // Get BYOK keys and settings for this request
    const keys = useKeys()
    const settings = useSettings()

    // Determine model: explicit > settings > conversation > default
    const requestModel = model || settings.selectedModel.value || conversation.value.metadata.model || null

    const requestBody = {
      user_message: content,
      messages: messageHistory,
      system_prompt: conversation.value.metadata.system_prompt || null,
      model: requestModel,
      provider: keys.llmProvider.value,
      enable_tools: enableTools,
      use_toon_format: useToonFormat,
      use_tool_rag_mode: useToolRag,
    }

    // Get BYOK headers (X-LLM-Key, X-LLM-Provider, X-MCP-Keys)
    const byokHeaders = keys.getHeaders()

    // Connect to SSE via POST (fire and forget - handlers will be called)
    sse.connectPost(`${API_URL}/chat/stream`, requestBody, {
      onToken: (event) => {
        currentResponse.value = event.cumulative
      },
      onThinking: (event) => {
        currentThinking.value = event.cumulative
      },
      onToolCall: (event) => {
        toolCalls.value.set(event.id, {
          id: event.id,
          tool_name: event.tool_name,
          arguments: event.arguments,
          status: event.status,
        })
        // Trigger reactivity
        toolCalls.value = new Map(toolCalls.value)
      },
      onToolResult: (event) => {
        const tc = toolCalls.value.get(event.tool_call_id)
        if (tc) {
          tc.status = 'complete'
          tc.result = event.result
          tc.is_error = event.is_error
          tc.latency_ms = event.latency_ms
          toolCalls.value = new Map(toolCalls.value)
        }
      },
      onComplete: (event) => {
        // Add tool call/result messages first (chronological order)
        // Tool calls happen before the final assistant response
        toolCalls.value.forEach((tc) => {
          if (conversation.value) {
            // Tool call message
            conversation.value.messages.push({
              id: `msg_tc_${tc.id}`,
              role: 'tool_call',
              content: '',
              timestamp: new Date().toISOString(),
              status: 'complete',
              tool_name: tc.tool_name,
              tool_arguments: tc.arguments,
              tool_call_id: tc.id,
            })
            // Tool result message
            conversation.value.messages.push({
              id: `msg_tr_${tc.id}`,
              role: 'tool_result',
              content: '',
              timestamp: new Date().toISOString(),
              status: 'complete',
              tool_call_id: tc.id,
              tool_result: tc.result,
              is_error: tc.is_error,
              latency_ms: tc.latency_ms,
            })
          }
        })

        // Add assistant message (final response after tool execution)
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: event.response,
          timestamp: new Date().toISOString(),
          status: 'complete',
          model: conversation.value?.metadata.model,
          usage: event.usage as TokenUsage | undefined,
          thinking: currentThinking.value || undefined,
        }
        conversation.value?.messages.push(assistantMessage)

        // Update token count
        if (conversation.value && event.usage) {
          conversation.value.metadata.total_tokens +=
            (event.usage.prompt_tokens || 0) + (event.usage.completion_tokens || 0)
        }

        // Update message count
        if (conversation.value) {
          conversation.value.metadata.message_count = conversation.value.messages.length
          conversation.value.metadata.updated_at = new Date().toISOString()
        }

        // Reset streaming state
        isStreaming.value = false
        currentResponse.value = ''
        currentThinking.value = ''
        toolCalls.value = new Map()
        clearDraft()
      },
      onError: (event) => {
        console.error('Stream error:', event)

        // Add error message
        const errorMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: event.message,
          timestamp: new Date().toISOString(),
          status: 'error',
        }
        conversation.value?.messages.push(errorMessage)

        isStreaming.value = false
        currentResponse.value = ''
        currentThinking.value = ''
        toolCalls.value = new Map()
      },
      onPing: () => {
        // Keep-alive, nothing to do
      },
    }, { headers: byokHeaders })
  }

  // Cancel generation (just disconnect SSE - backend is stateless)
  async function cancelGeneration(): Promise<void> {
    if (!isStreaming.value) return

    sse.disconnect()
    isStreaming.value = false
    currentResponse.value = ''
    currentThinking.value = ''
    toolCalls.value = new Map()
  }

  // Retry from a specific message index (removes error and resends)
  async function retryFromMessage(index: number): Promise<void> {
    if (!conversation.value || isStreaming.value) return

    const messages = conversation.value.messages

    // Find the user message to retry (the one at or before the index)
    let userMessageIndex = index
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--
    }

    if (userMessageIndex < 0) return // No user message found

    const userMessage = messages[userMessageIndex]

    // Remove messages from the user message onwards (including the error)
    conversation.value.messages = messages.slice(0, userMessageIndex)
    conversation.value.metadata.message_count = conversation.value.messages.length
    conversation.value.metadata.updated_at = new Date().toISOString()

    // Resend the user message
    await sendMessage(userMessage.content)
  }

  // Delete messages from index (local operation)
  async function deleteMessagesFrom(index: number): Promise<void> {
    if (!conversation.value) return

    conversation.value.messages = conversation.value.messages.slice(0, index)
    conversation.value.metadata.message_count = conversation.value.messages.length
    conversation.value.metadata.updated_at = new Date().toISOString()
  }

  // Check if the current system prompt matches a default template
  function isSystemPromptDefault(): boolean {
    if (!conversation.value) return true
    const currentPrompt = conversation.value.metadata.system_prompt
    return Object.values(SYSTEM_PROMPT_TEMPLATES).includes(currentPrompt)
  }

  // Update system prompt (local operation) - marks as user-modified if different from defaults
  async function updateSystemPrompt(content: string): Promise<void> {
    if (!conversation.value) return

    conversation.value.metadata.system_prompt = content
    conversation.value.metadata.updated_at = new Date().toISOString()

    // Track if user modified the prompt to something other than a default
    isSystemPromptUserModified.value = !Object.values(SYSTEM_PROMPT_TEMPLATES).includes(content)
  }

  // Reset system prompt to the default based on current toggles
  function resetSystemPromptToDefault(): void {
    if (!conversation.value) return

    const defaultPrompt = getDefaultSystemPrompt()
    conversation.value.metadata.system_prompt = defaultPrompt
    conversation.value.metadata.updated_at = new Date().toISOString()
    isSystemPromptUserModified.value = false
  }

  // Sync system prompt with toggle changes (only if not user-modified)
  function syncSystemPromptWithToggles(): void {
    if (!conversation.value) return
    if (isSystemPromptUserModified.value) return

    const defaultPrompt = getDefaultSystemPrompt()
    conversation.value.metadata.system_prompt = defaultPrompt
    conversation.value.metadata.updated_at = new Date().toISOString()
  }

  // Update conversation title (local operation)
  function updateTitle(title: string): void {
    if (!conversation.value) return

    conversation.value.metadata.title = title
    conversation.value.metadata.updated_at = new Date().toISOString()
  }

  // Update model (local operation)
  async function updateModel(model: string): Promise<void> {
    if (!conversation.value) return

    conversation.value.metadata.model = model
    conversation.value.metadata.updated_at = new Date().toISOString()
  }

  async function fetchTools(useRagMode?: boolean): Promise<void> {
    // Use RAG mode from settings if not explicitly provided
    const ragMode = useRagMode ?? (isAdvancedView.value && advancedViewSettings.value.useToolRag)
    const url = ragMode ? `${API_URL}/tools?mode=rag` : `${API_URL}/tools`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`)
    }

    const tools = await response.json()
    availableTools.value = tools
  }

  async function refreshTools(): Promise<void> {
    const response = await fetch(`${API_URL}/tools/refresh`, { method: 'POST' })

    if (!response.ok) {
      throw new Error(`Failed to refresh tools: ${response.statusText}`)
    }

    // After refresh, fetch the updated tools with current RAG mode
    await fetchTools()
  }

  async function fetchModels(): Promise<void> {
    isLoadingModels.value = true
    try {
      const response = await fetch(`${API_URL}/models`)

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data: ModelsResponse = await response.json()
      availableModels.value = data.models
      availableProviders.value = data.providers
      modelsCachedAt.value = data.cached_at
    } finally {
      isLoadingModels.value = false
    }
  }

  async function refreshModels(): Promise<void> {
    isLoadingModels.value = true
    try {
      const response = await fetch(`${API_URL}/models/refresh`, { method: 'POST' })

      if (!response.ok) {
        throw new Error(`Failed to refresh models: ${response.statusText}`)
      }

      // After refresh, fetch the updated models
      await fetchModels()
    } finally {
      isLoadingModels.value = false
    }
  }

  // New model management methods

  async function fetchProviders(): Promise<void> {
    const response = await fetch(`${API_URL}/providers`)

    if (!response.ok) {
      throw new Error(`Failed to fetch providers: ${response.statusText}`)
    }

    const data = await response.json()
    providers.value = data.providers
  }

  async function fetchModelsGrouped(): Promise<void> {
    isLoadingModels.value = true
    try {
      const response = await fetch(`${API_URL}/models/grouped`)

      if (!response.ok) {
        throw new Error(`Failed to fetch grouped models: ${response.statusText}`)
      }

      const data: GroupedModelsResponse = await response.json()
      groupedModels.value = data
      favoriteModels.value = data.favorites
      recentModels.value = data.recent
      defaultModel.value = data.default_model
    } finally {
      isLoadingModels.value = false
    }
  }

  async function addModelToProvider(
    providerId: string,
    modelId: string,
    displayName?: string,
    capabilities?: ModelCapabilities
  ): Promise<AddModelResponse> {
    const response = await fetch(`${API_URL}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerId,
        model_id: modelId,
        display_name: displayName,
        capabilities,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to add model: ${response.statusText}`)
    }

    const data: AddModelResponse = await response.json()

    // Refresh the grouped models to update UI
    await fetchModelsGrouped()
    await fetchProviders()

    return data
  }

  async function removeModelFromProvider(providerId: string, modelId: string): Promise<void> {
    const response = await fetch(`${API_URL}/models/${providerId}/${modelId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to remove model: ${response.statusText}`)
    }

    // Refresh the grouped models to update UI
    await fetchModelsGrouped()
    await fetchProviders()
  }

  async function toggleModelFavorite(
    providerId: string,
    modelId: string
  ): Promise<boolean | null> {
    // Get current favorite status
    const currentModel = groupedModels.value?.providers[providerId]?.chat?.find(
      (m) => m.id === modelId
    )
    const newFavorited = !(currentModel?.favorited ?? false)

    const response = await fetch(`${API_URL}/models/${providerId}/${modelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorited: newFavorited }),
    })

    if (!response.ok) {
      throw new Error(`Failed to toggle favorite: ${response.statusText}`)
    }

    const data = await response.json()

    // Refresh the grouped models to update UI
    await fetchModelsGrouped()

    return data.model?.favorited ?? null
  }

  async function fetchModelsFromProvider(providerId: string): Promise<FetchModelsResponse> {
    isLoadingModels.value = true
    try {
      const response = await fetch(`${API_URL}/models/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch models: ${response.statusText}`)
      }

      const data: FetchModelsResponse = await response.json()

      // Refresh the grouped models to update UI
      await fetchModelsGrouped()
      await fetchProviders()

      return data
    } finally {
      isLoadingModels.value = false
    }
  }

  async function getProviderSuggestions(providerId: string): Promise<ModelSuggestion[]> {
    const response = await fetch(`${API_URL}/models/suggestions/${providerId}`)

    if (!response.ok) {
      throw new Error(`Failed to get suggestions: ${response.statusText}`)
    }

    const data = await response.json()
    return data.suggestions
  }

  async function setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
    const response = await fetch(`${API_URL}/providers/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update provider: ${response.statusText}`)
    }

    // Refresh providers to update UI
    await fetchProviders()
  }

  /**
   * Fetch server configuration (available providers, BYOK status).
   * Updates the keys composable with server provider info.
   */
  async function fetchConfig(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/config`)
      if (response.ok) {
        const data = await response.json()
        // Update keys composable with server config
        const keys = useKeys()
        keys.setServerConfig(data.server_providers || {}, data.allow_byok ?? true)
      }
    } catch (e) {
      console.warn('Failed to fetch config:', e)
    }
  }

  async function checkHealth(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/health`)
      if (response.ok) {
        const data = await response.json()
        // Normalize health response to match our HealthResponse type
        // Orchestrator returns { status: "ok", armory_available: bool }
        healthStatus.value = {
          status: data.status || 'ok',
          armory_connected: data.armory_available ?? data.armory_connected ?? false,
          active_runs: data.active_runs ?? 0,
        }
        // Also fetch config when checking health
        await fetchConfig()
      } else {
        healthStatus.value = null
      }
    } catch {
      healthStatus.value = null
    }
  }

  function toggleAdvancedView(): void {
    isAdvancedView.value = !isAdvancedView.value
    saveAdvancedView(isAdvancedView.value)
  }

  function toggleDebugPanel(): void {
    showDebugPanel.value = !showDebugPanel.value
  }

  function toggleToolsPanel(): void {
    showToolsPanel.value = !showToolsPanel.value
  }

  function saveDraft(content: string): void {
    messageDraft.value = content
    saveMessageDraft(content)
  }

  function clearDraft(): void {
    messageDraft.value = ''
    saveMessageDraft('')
  }

  function setPreferredModel(model: string): void {
    preferredModel.value = model
    savePreferredModel(model)
  }

  // Import conversation from file (local operation)
  async function importConversation(file: File): Promise<void> {
    const text = await file.text()
    const data = JSON.parse(text)

    // Handle version migration
    const importedVersion = data.version || '0.0.0' // Pre-versioned files
    const migratedData = migrateConversation(data, importedVersion)

    // Generate new ID for imported conversation
    const now = new Date().toISOString()
    conversation.value = {
      version: CONVERSATION_SCHEMA_VERSION,
      metadata: {
        ...migratedData.metadata,
        id: generateId(), // New ID for imported conversation
        updated_at: now,
      },
      messages: migratedData.messages || [],
    }
  }

  // Migrate conversation data from older versions
  function migrateConversation(data: Record<string, unknown>, fromVersion: string): Conversation {
    let migrated = { ...data } as unknown as Conversation

    // Version 0.0.0 (pre-versioned) -> 1.0.0
    // Pre-versioned files don't have the version field, add defaults
    if (fromVersion === '0.0.0' || fromVersion === '1.0.0') {
      migrated = {
        version: CONVERSATION_SCHEMA_VERSION,
        metadata: (data.metadata || {}) as Conversation['metadata'],
        messages: (data.messages || []) as Conversation['messages'],
      }

      // Migration to v1.1.0: add new fields, remove deprecated ones
      if (migrated.metadata.title === undefined) {
        migrated.metadata.title = ''
      }
      if (migrated.metadata.tools === undefined) {
        migrated.metadata.tools = []
      }
      if (migrated.metadata.total_tokens === undefined) {
        migrated.metadata.total_tokens = 0
      }
      if (migrated.metadata.message_count === undefined) {
        migrated.metadata.message_count = migrated.messages.length
      }

      // Remove deprecated system_prompt_history if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (migrated.metadata as any).system_prompt_history
    }

    return migrated
  }

  function exportConversation(): void {
    if (!conversation.value?.metadata?.id) return

    const data = JSON.stringify(conversation.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${conversation.value.metadata.id}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  return {
    // State
    conversation,
    isStreaming,
    currentResponse,
    currentThinking,
    toolCalls,
    isAdvancedView,
    showDebugPanel,
    showToolsPanel,
    availableTools,
    healthStatus,
    messageDraft,
    preferredModel,
    debugEvents: sse.debugEvents,
    sseStatus: sse.status,
    availableModels,
    availableProviders,
    modelsCachedAt,
    isLoadingModels,
    // New model management state
    providers,
    groupedModels,
    favoriteModels,
    recentModels,
    defaultModel,

    // Advanced view settings
    advancedViewSettings,

    // System prompt state
    isSystemPromptUserModified,

    // Computed
    messages,
    isConnected,
    currentModelContextLength,

    // Actions
    createConversation,
    deleteConversation,
    sendMessage,
    cancelGeneration,
    retryFromMessage,
    deleteMessagesFrom,
    updateSystemPrompt,
    updateTitle,
    updateModel,
    fetchTools,
    refreshTools,
    checkHealth,
    fetchConfig,
    toggleAdvancedView,
    toggleDebugPanel,
    toggleToolsPanel,
    saveDraft,
    clearDraft,
    setPreferredModel,
    importConversation,
    exportConversation,
    fetchModels,
    refreshModels,
    // New model management actions
    fetchProviders,
    fetchModelsGrouped,
    addModelToProvider,
    removeModelFromProvider,
    toggleModelFavorite,
    fetchModelsFromProvider,
    getProviderSuggestions,
    setProviderEnabled,
    // Advanced view settings actions
    updateAdvancedViewSettings,
    // System prompt actions
    getDefaultSystemPrompt,
    resetSystemPromptToDefault,
    syncSystemPromptWithToggles,
    getContextInfoForMessage,
  }
}
