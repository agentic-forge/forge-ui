<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useConversation } from '@/composables/useConversation'

const props = defineProps<{
  response: string
  thinking: string
}>()

const { isAdvancedView } = useConversation()

const renderedResponse = computed(() => {
  return DOMPurify.sanitize(marked.parse(props.response) as string)
})
</script>

<template>
  <div class="streaming-message">
    <!-- Thinking section -->
    <div v-if="thinking && isAdvancedView" class="thinking-section">
      <div class="thinking-header">
        <i class="pi pi-lightbulb" />
        <span>Thinking...</span>
      </div>
      <div class="thinking-content text-sm text-muted">
        {{ thinking }}
      </div>
    </div>

    <!-- Response -->
    <div class="response-bubble">
      <div class="message-header">
        <span class="message-role">Assistant</span>
        <span class="streaming-indicator">
          <i class="pi pi-spin pi-spinner" />
          Generating...
        </span>
      </div>
      <div
        v-if="response"
        class="message-content"
        v-html="renderedResponse"
      />
      <div v-else class="typing-indicator">
        <span class="dot" />
        <span class="dot" />
        <span class="dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.streaming-message {
  align-self: flex-start;
  max-width: 80%;
  margin-bottom: 1rem;
}

.thinking-section {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--p-primary-color);
  margin-bottom: 0.5rem;
}

.thinking-content {
  font-style: italic;
  white-space: pre-wrap;
}

.response-bubble {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  padding: 1rem;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.8;
}

.message-role {
  font-weight: 600;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-primary-color);
}

.message-content {
  line-height: 1.6;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 0.5rem 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--p-primary-color);
  animation: typing 1.4s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-6px);
    opacity: 1;
  }
}
</style>
