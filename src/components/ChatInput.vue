<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { useConversation } from '@/composables/useConversation'

const {
  isStreaming,
  messageDraft,
  sendMessage,
  cancelGeneration,
  saveDraft,
} = useConversation()

const inputText = ref(messageDraft.value)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showStopButton = ref(false)
let stopButtonTimeout: ReturnType<typeof setTimeout> | null = null

// Watch for external draft changes
watch(messageDraft, (newValue) => {
  if (newValue !== inputText.value) {
    inputText.value = newValue
  }
})

// Save draft on changes
watch(inputText, (newValue) => {
  saveDraft(newValue)
})

// Show stop button after delay when streaming
watch(isStreaming, (streaming) => {
  if (streaming) {
    stopButtonTimeout = setTimeout(() => {
      showStopButton.value = true
    }, 2500)
  } else {
    showStopButton.value = false
    if (stopButtonTimeout) {
      clearTimeout(stopButtonTimeout)
      stopButtonTimeout = null
    }
  }
})

function handleSend(): void {
  const content = inputText.value.trim()
  if (!content || isStreaming.value) return

  sendMessage(content)
  inputText.value = ''
}

function handleKeydown(event: KeyboardEvent): void {
  // Escape to cancel
  if (event.key === 'Escape' && isStreaming.value) {
    cancelGeneration()
    event.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (stopButtonTimeout) {
    clearTimeout(stopButtonTimeout)
  }
})
</script>

<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <Textarea
        ref="textareaRef"
        v-model="inputText"
        placeholder="Type a message..."
        :disabled="isStreaming"
        autoResize
        rows="1"
        class="message-input"
      />
      <div class="input-actions">
        <Button
          v-if="!isStreaming"
          icon="pi pi-send"
          :disabled="!inputText.trim()"
          rounded
          class="send-button"
          @click="handleSend"
        />
        <Button
          v-else-if="showStopButton"
          icon="pi pi-stop"
          severity="danger"
          rounded
          class="stop-button"
          title="Stop generation (Escape)"
          @click="cancelGeneration"
        />
        <span v-else class="streaming-indicator">
          <i class="pi pi-spin pi-spinner" />
        </span>
      </div>
    </div>
    <div class="input-hint text-xs text-muted">
      Press Escape to cancel generation
    </div>
  </div>
</template>

<style scoped>
.chat-input-container {
  padding: 1rem 1.5rem;
  background: var(--p-content-background);
  border-top: 1px solid var(--p-content-border-color);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 0.75rem;
}

.message-input {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  min-height: 24px;
  max-height: 200px;
  font-size: 1rem;
  line-height: 1.5;
}

.message-input:focus {
  outline: none;
  box-shadow: none;
}

:deep(.message-input.p-inputtextarea) {
  border: none;
  background: transparent;
  padding: 0;
}

.input-actions {
  display: flex;
  align-items: center;
}

.send-button,
.stop-button {
  width: 40px;
  height: 40px;
}

.streaming-indicator {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-primary-color);
}

.input-hint {
  margin-top: 0.5rem;
  text-align: center;
  opacity: 0.7;
}
</style>
