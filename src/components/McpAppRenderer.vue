<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import { useAppBridge, type AppContext } from '@/composables/useAppBridge'
import type { UiMetadata } from '@/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const props = defineProps<{
  uiMetadata: UiMetadata
  toolName: string
}>()

const emit = defineEmits<{
  contextUpdate: [context: AppContext]
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const htmlContent = ref<string | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(true)

// Extract server prefix from tool name (e.g., "weather__pick_location" -> "weather")
const serverPrefix = computed(() => {
  const parts = props.toolName.split('__')
  return parts.length > 1 ? parts[0] : ''
})

const { context, start: startBridge } = useAppBridge({
  iframeRef,
  serverPrefix: serverPrefix.value,
  onContextUpdate: (ctx) => emit('contextUpdate', ctx),
})

async function fetchHtml(): Promise<void> {
  isLoading.value = true
  loadError.value = null

  try {
    const uri = encodeURIComponent(props.uiMetadata.resourceUri)
    const response = await fetch(`${API_URL}/api/resources?uri=${uri}`)

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ detail: response.statusText }))
      throw new Error(errBody.detail || `Failed to load app: ${response.statusText}`)
    }

    htmlContent.value = await response.text()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    isLoading.value = false
  }
}

function onIframeLoad(): void {
  startBridge()
}

function retry(): void {
  fetchHtml()
}

// Computed display of context update
const contextSummary = computed(() => {
  if (!context.value) return null
  // Show a short summary of the context
  const entries = Object.entries(context.value)
  if (entries.length === 0) return null
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ')
})

onMounted(() => {
  fetchHtml()
})
</script>

<template>
  <div class="mcp-app-renderer">
    <!-- Loading state -->
    <div v-if="isLoading" class="app-loading">
      <ProgressSpinner
        style="width: 32px; height: 32px"
        strokeWidth="4"
      />
      <span class="loading-text">Loading app...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="app-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ loadError }}</span>
      <Button
        label="Retry"
        severity="secondary"
        size="small"
        @click="retry"
      />
    </div>

    <!-- App iframe -->
    <iframe
      v-else-if="htmlContent"
      ref="iframeRef"
      :srcdoc="htmlContent"
      sandbox="allow-scripts allow-forms"
      class="app-iframe"
      @load="onIframeLoad"
    ></iframe>

    <!-- Context update feedback -->
    <div v-if="contextSummary" class="context-feedback">
      <i class="pi pi-check-circle"></i>
      <span>Selected: {{ contextSummary }}</span>
    </div>
  </div>
</template>

<style scoped>
.mcp-app-renderer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.app-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  justify-content: center;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  min-height: 200px;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.app-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-red-500) 30%, transparent);
  border-radius: 8px;
  color: var(--p-red-500);
  font-size: 0.875rem;
}

.app-iframe {
  width: 100%;
  height: 400px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: white;
}

.context-feedback {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--p-green-500) 15%, transparent);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--p-green-500);
}

.context-feedback .pi {
  font-size: 0.875rem;
}
</style>
