<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { useConversation } from '@/composables/useConversation'

const {
  isStreaming,
  isAdvancedView,
  advancedViewSettings,
  updateAdvancedViewSettings,
  messageDraft,
  sendMessage,
  cancelGeneration,
  saveDraft,
} = useConversation()

function toggleToolCalling(): void {
  updateAdvancedViewSettings({ enableToolCalling: !advancedViewSettings.value.enableToolCalling })
}

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
    <!-- Input header with options (advanced mode only) -->
    <div v-if="isAdvancedView" class="input-header">
      <button
        type="button"
        class="tools-toggle"
        :class="{ 'tools-enabled': advancedViewSettings.enableToolCalling }"
        :title="advancedViewSettings.enableToolCalling ? 'Tools enabled - click to disable' : 'Tools disabled - click to enable'"
        @click="toggleToolCalling"
      >
        <span class="tools-status-dot" />
        <i class="pi pi-wrench" />
        <span class="tools-label">Tools</span>
      </button>
    </div>
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

.input-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tools-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.tools-toggle:hover {
  background: var(--p-content-hover-background);
  border-color: var(--p-text-muted-color);
}

.tools-toggle.tools-enabled {
  color: var(--p-text-color);
  border-color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

.tools-toggle.tools-enabled:hover {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.tools-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-text-muted-color);
  transition: all 0.2s ease;
}

.tools-toggle.tools-enabled .tools-status-dot {
  background: var(--p-green-500);
  box-shadow: 0 0 4px var(--p-green-500);
}

.tools-toggle i {
  font-size: 0.75rem;
}

.tools-label {
  line-height: 1;
}
</style>
