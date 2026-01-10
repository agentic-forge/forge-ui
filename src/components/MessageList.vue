<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import MessageBubble from './MessageBubble.vue'
import ToolCallCard from './ToolCallCard.vue'
import StreamingMessage from './StreamingMessage.vue'
import { useConversation } from '@/composables/useConversation'
import type { Message, ToolCallState } from '@/types'

const {
  messages,
  isStreaming,
  currentResponse,
  currentThinking,
  toolCalls,
  isAdvancedView,
} = useConversation()

const listRef = ref<HTMLElement | null>(null)

// Build tool call states from history
function buildToolCallFromHistory(
  callMsg: Message,
  resultMsg: Message | undefined
): ToolCallState {
  return {
    id: callMsg.tool_call_id || callMsg.id,
    tool_name: callMsg.tool_name || 'unknown',
    arguments: callMsg.tool_arguments || {},
    status: resultMsg ? 'complete' : 'pending',
    result: resultMsg?.tool_result,
    is_error: resultMsg?.is_error || false,
    latency_ms: resultMsg?.latency_ms,
  }
}

// Group messages with tool calls
const displayItems = computed(() => {
  const items: Array<{
    type: 'message' | 'tool_group'
    data: unknown
    index: number
  }> = []

  // Build a map of tool_call_id -> result message
  const toolResults = new Map<string, Message>()
  messages.value.forEach((msg) => {
    if (msg.role === 'tool_result' && msg.tool_call_id) {
      toolResults.set(msg.tool_call_id, msg)
    }
  })

  // Track which tool calls we've already added
  const addedToolCalls = new Set<string>()

  messages.value.forEach((msg, index) => {
    if (msg.role === 'tool_call') {
      // Only add tool calls once (avoid duplicates)
      if (msg.tool_call_id && !addedToolCalls.has(msg.tool_call_id)) {
        addedToolCalls.add(msg.tool_call_id)
        const resultMsg = toolResults.get(msg.tool_call_id)
        const toolState = buildToolCallFromHistory(msg, resultMsg)

        // Show all tool calls in advanced view, only errors in basic view
        if (isAdvancedView.value || toolState.is_error) {
          items.push({ type: 'tool_group', data: toolState, index })
        }
      }
      return
    }

    if (msg.role === 'tool_result') {
      // Skip - already handled with tool_call
      return
    }

    items.push({ type: 'message', data: msg, index })
  })

  return items
})

// Auto-scroll to bottom on new messages
watch(
  [messages, currentResponse],
  async () => {
    await nextTick()
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  },
  { deep: true }
)
</script>

<template>
  <div ref="listRef" class="message-list">
    <div class="messages-container">
      <template v-for="item in displayItems" :key="`${item.type}-${item.index}`">
        <MessageBubble
          v-if="item.type === 'message'"
          :message="(item.data as any)"
          :index="item.index"
        />
        <ToolCallCard
          v-else-if="item.type === 'tool_group'"
          :tool-call="(item.data as ToolCallState)"
        />
      </template>

      <!-- Tool calls during streaming -->
      <template v-if="isStreaming && toolCalls.size > 0">
        <ToolCallCard
          v-for="[id, tc] in toolCalls"
          :key="id"
          :tool-call="tc"
        />
      </template>

      <!-- Streaming message -->
      <StreamingMessage
        v-if="isStreaming && (currentResponse || currentThinking)"
        :response="currentResponse"
        :thinking="currentThinking"
      />
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.messages-container {
  display: flex;
  flex-direction: column;
  max-width: 900px;
  margin: 0 auto;
}
</style>
