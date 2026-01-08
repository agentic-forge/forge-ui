<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import MessageBubble from './MessageBubble.vue'
import ToolCallCard from './ToolCallCard.vue'
import StreamingMessage from './StreamingMessage.vue'
import { useConversation } from '@/composables/useConversation'

const {
  messages,
  isStreaming,
  currentResponse,
  currentThinking,
  toolCalls,
} = useConversation()

const listRef = ref<HTMLElement | null>(null)

// Group messages with tool calls
const displayItems = computed(() => {
  const items: Array<{
    type: 'message' | 'tool'
    data: unknown
    index: number
  }> = []

  messages.value.forEach((msg, index) => {
    if (msg.role === 'tool_call' || msg.role === 'tool_result') {
      // Skip - we'll render these as part of ToolCallCard
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
