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
} from '@/types'
import { useSSE, type SSEConnectionStatus } from './useSSE'

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
const availableTools = ref<Tool[]>([])
const healthStatus = ref<HealthResponse | null>(null)
const messageDraft = ref(loadMessageDraft())
const preferredModel = ref(loadPreferredModel())

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

export interface UseConversationReturn {
  // State
  conversation: Ref<Conversation | null>
  isStreaming: Ref<boolean>
  currentResponse: Ref<string>
  currentThinking: Ref<string>
  toolCalls: Ref<Map<string, ToolCallState>>
  isAdvancedView: Ref<boolean>
  showDebugPanel: Ref<boolean>
  availableTools: Ref<Tool[]>
  healthStatus: Ref<HealthResponse | null>
  messageDraft: Ref<string>
  preferredModel: Ref<string>
  debugEvents: Ref<DebugEvent[]>
  sseStatus: Ref<SSEConnectionStatus>

  // Computed
  messages: ComputedRef<Message[]>
  isConnected: ComputedRef<boolean>

  // Actions
  createConversation: (request?: CreateConversationRequest) => Promise<void>
  loadConversation: (id: string) => Promise<void>
  deleteConversation: () => Promise<void>
  sendMessage: (content: string, model?: string) => Promise<void>
  cancelGeneration: () => Promise<void>
  deleteMessagesFrom: (index: number) => Promise<void>
  updateSystemPrompt: (content: string) => Promise<void>
  updateModel: (model: string) => Promise<void>
  refreshTools: () => Promise<void>
  checkHealth: () => Promise<void>
  toggleAdvancedView: () => void
  toggleDebugPanel: () => void
  saveDraft: (content: string) => void
  clearDraft: () => void
  setPreferredModel: (model: string) => void
  importConversation: (file: File) => Promise<void>
  exportConversation: () => void
}

export function useConversation(): UseConversationReturn {
  const messages = computed(() => conversation.value?.messages || [])

  const isConnected = computed(
    () => healthStatus.value?.status === 'ok' || healthStatus.value?.status === 'healthy'
  )

  async function createConversation(request?: CreateConversationRequest): Promise<void> {
    const payload = {
      model: request?.model || preferredModel.value,
      system_prompt: request?.system_prompt,
    }

    const response = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`)
    }

    // API returns { id, model, system_prompt }, need to fetch full conversation
    const created = await response.json()
    await loadConversation(created.id)

    // Update health status after successful conversation creation
    await checkHealth()
  }

  async function loadConversation(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/conversations/${id}`)

    if (!response.ok) {
      throw new Error(`Failed to load conversation: ${response.statusText}`)
    }

    conversation.value = await response.json()
  }

  async function deleteConversation(): Promise<void> {
    if (!conversation.value?.metadata?.id) return

    const response = await fetch(
      `${API_URL}/conversations/${conversation.value.metadata.id}`,
      { method: 'DELETE' }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`)
    }

    conversation.value = null
  }

  async function sendMessage(content: string, model?: string): Promise<void> {
    if (!conversation.value?.metadata?.id || isStreaming.value) return

    const convId = conversation.value.metadata.id

    // Add user message to local state
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      status: 'complete',
    }
    conversation.value.messages.push(userMessage)

    // Reset streaming state
    isStreaming.value = true
    currentResponse.value = ''
    currentThinking.value = ''
    toolCalls.value = new Map()

    // Build URL with query params
    const params = new URLSearchParams({ message: content })
    if (model) {
      params.append('model', model)
    }
    const streamUrl = `${API_URL}/conversations/${convId}/stream?${params.toString()}`

    // Connect to SSE
    sse.connect(streamUrl, {
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
        // Add assistant message to conversation
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: event.response,
          timestamp: new Date().toISOString(),
          status: 'complete',
          model: conversation.value?.metadata.model,
          usage: event.usage as TokenUsage | undefined,
        }
        conversation.value?.messages.push(assistantMessage)

        // Add tool call/result messages
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
    })
  }

  async function cancelGeneration(): Promise<void> {
    if (!conversation.value?.metadata?.id || !isStreaming.value) return

    const response = await fetch(
      `${API_URL}/conversations/${conversation.value.metadata.id}/cancel`,
      { method: 'POST' }
    )

    if (!response.ok) {
      console.error('Failed to cancel generation:', response.statusText)
    }

    sse.disconnect()
    isStreaming.value = false
    currentResponse.value = ''
    currentThinking.value = ''
    toolCalls.value = new Map()
  }

  async function deleteMessagesFrom(index: number): Promise<void> {
    if (!conversation.value?.metadata?.id) return

    const response = await fetch(
      `${API_URL}/conversations/${conversation.value.metadata.id}/messages/${index}`,
      { method: 'DELETE' }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete messages: ${response.statusText}`)
    }

    conversation.value = await response.json()
  }

  async function updateSystemPrompt(content: string): Promise<void> {
    if (!conversation.value?.metadata?.id) return

    const response = await fetch(
      `${API_URL}/conversations/${conversation.value.metadata.id}/system-prompt`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to update system prompt: ${response.statusText}`)
    }

    conversation.value = await response.json()
  }

  async function updateModel(model: string): Promise<void> {
    if (!conversation.value?.metadata?.id) return

    const response = await fetch(
      `${API_URL}/conversations/${conversation.value.metadata.id}/model`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to update model: ${response.statusText}`)
    }

    conversation.value = await response.json()
  }

  async function refreshTools(): Promise<void> {
    const response = await fetch(`${API_URL}/tools/refresh`, { method: 'POST' })

    if (!response.ok) {
      throw new Error(`Failed to refresh tools: ${response.statusText}`)
    }

    const data = await response.json()
    availableTools.value = data.tools
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

  async function importConversation(file: File): Promise<void> {
    const text = await file.text()
    const data = JSON.parse(text) as Conversation

    // Create the conversation on the server
    const response = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: data.metadata.model,
        system_prompt: data.metadata.system_prompt,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to import conversation: ${response.statusText}`)
    }

    conversation.value = await response.json()
    // Note: Messages are not imported in this simple version
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
    availableTools,
    healthStatus,
    messageDraft,
    preferredModel,
    debugEvents: sse.debugEvents,
    sseStatus: sse.status,

    // Computed
    messages,
    isConnected,

    // Actions
    createConversation,
    loadConversation,
    deleteConversation,
    sendMessage,
    cancelGeneration,
    deleteMessagesFrom,
    updateSystemPrompt,
    updateModel,
    refreshTools,
    checkHealth,
    toggleAdvancedView,
    toggleDebugPanel,
    saveDraft,
    clearDraft,
    setPreferredModel,
    importConversation,
    exportConversation,
  }
}
