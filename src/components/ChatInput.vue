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
  fetchTools,
  syncSystemPromptWithToggles,
} = useConversation()

function toggleToolCalling(): void {
  const newValue = !advancedViewSettings.value.enableToolCalling
  updateAdvancedViewSettings({ enableToolCalling: newValue })
  // If disabling tools, also disable RAG and refetch normal tools list
  if (!newValue && advancedViewSettings.value.useToolRag) {
    updateAdvancedViewSettings({ useToolRag: false })
    fetchTools(false)
  }
  // Sync system prompt with new toggle state
  syncSystemPromptWithToggles()
}

function toggleToonFormat(): void {
  updateAdvancedViewSettings({ useToonFormat: !advancedViewSettings.value.useToonFormat })
}

async function toggleToolRag(): Promise<void> {
  const newValue = !advancedViewSettings.value.useToolRag
  updateAdvancedViewSettings({ useToolRag: newValue })
  // Refetch tools with the new RAG mode
  await fetchTools(newValue)
  // Sync system prompt with new toggle state
  syncSystemPromptWithToggles()
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
        <span class="tools-status-dot" ></span>
        <i class="pi pi-wrench" ></i>
        <span class="tools-label">Tools</span>
      </button>
      <button
        type="button"
        class="toon-toggle"
        :class="{ 'toon-enabled': advancedViewSettings.useToonFormat }"
        :title="advancedViewSettings.useToonFormat ? 'TOON format enabled - reduces tokens for tool results' : 'TOON format disabled - click to enable'"
        @click="toggleToonFormat"
      >
        <span class="toon-status-dot" ></span>
        <i class="pi pi-bolt" ></i>
        <span class="toon-label">TOON</span>
      </button>
      <button
        v-if="advancedViewSettings.enableToolCalling"
        type="button"
        class="rag-toggle"
        :class="{ 'rag-enabled': advancedViewSettings.useToolRag }"
        :title="advancedViewSettings.useToolRag ? 'Tool RAG enabled - semantic tool search (reduces context usage)' : 'Tool RAG disabled - click to enable semantic tool search'"
        @click="toggleToolRag"
      >
        <span class="rag-status-dot" ></span>
        <i class="pi pi-search" ></i>
        <span class="rag-label">RAG</span>
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
          <i class="pi pi-spin pi-spinner" ></i>
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

/* TOON Toggle - similar to tools toggle but with orange accent */
.toon-toggle {
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

.toon-toggle:hover {
  background: var(--p-content-hover-background);
  border-color: var(--p-text-muted-color);
}

.toon-toggle.toon-enabled {
  color: var(--p-text-color);
  border-color: var(--p-green-500);
  background: color-mix(in srgb, var(--p-green-500) 10%, transparent);
}

.toon-toggle.toon-enabled:hover {
  background: color-mix(in srgb, var(--p-green-500) 15%, transparent);
}

.toon-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-text-muted-color);
  transition: all 0.2s ease;
}

.toon-toggle.toon-enabled .toon-status-dot {
  background: var(--p-green-500);
  box-shadow: 0 0 4px var(--p-green-500);
}

.toon-toggle i {
  font-size: 0.75rem;
}

.toon-label {
  line-height: 1;
}

/* RAG Toggle - similar to toon toggle but with blue accent */
.rag-toggle {
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

.rag-toggle:hover {
  background: var(--p-content-hover-background);
  border-color: var(--p-text-muted-color);
}

.rag-toggle.rag-enabled {
  color: var(--p-text-color);
  border-color: var(--p-blue-500);
  background: color-mix(in srgb, var(--p-blue-500) 10%, transparent);
}

.rag-toggle.rag-enabled:hover {
  background: color-mix(in srgb, var(--p-blue-500) 15%, transparent);
}

.rag-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-text-muted-color);
  transition: all 0.2s ease;
}

.rag-toggle.rag-enabled .rag-status-dot {
  background: var(--p-blue-500);
  box-shadow: 0 0 4px var(--p-blue-500);
}

.rag-toggle i {
  font-size: 0.75rem;
}

.rag-label {
  line-height: 1;
}
</style>
