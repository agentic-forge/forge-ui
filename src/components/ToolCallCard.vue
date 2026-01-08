<script setup lang="ts">
import { ref, computed } from 'vue'
import Panel from 'primevue/panel'
import type { ToolCallState } from '@/types'
import { useConversation } from '@/composables/useConversation'

const props = defineProps<{
  toolCall: ToolCallState
}>()

const { isAdvancedView } = useConversation()

const isExpanded = ref(false)
const showFullResult = ref(false)

const displayName = computed(() => {
  if (isAdvancedView.value) {
    return props.toolCall.tool_name
  }
  // Remove server prefix for basic view (e.g., "weather__get_forecast" -> "get_forecast")
  const parts = props.toolCall.tool_name.split('__')
  return parts.length > 1 ? parts.slice(1).join('__') : props.toolCall.tool_name
})

const statusIcon = computed(() => {
  switch (props.toolCall.status) {
    case 'pending':
      return 'pi pi-clock'
    case 'executing':
      return 'pi pi-spin pi-spinner'
    case 'complete':
      return props.toolCall.is_error ? 'pi pi-times-circle' : 'pi pi-check-circle'
    case 'error':
      return 'pi pi-exclamation-circle'
    default:
      return 'pi pi-question-circle'
  }
})

const statusClass = computed(() => {
  switch (props.toolCall.status) {
    case 'pending':
      return 'status-pending'
    case 'executing':
      return 'status-executing'
    case 'complete':
      return props.toolCall.is_error ? 'status-error' : 'status-success'
    case 'error':
      return 'status-error'
    default:
      return ''
  }
})

const formattedArguments = computed(() => {
  return JSON.stringify(props.toolCall.arguments, null, 2)
})

const formattedResult = computed(() => {
  if (props.toolCall.result === undefined) return ''
  const str = JSON.stringify(props.toolCall.result, null, 2)
  if (!showFullResult.value && str.length > 500) {
    return str.substring(0, 500) + '...'
  }
  return str
})

const isResultTruncated = computed(() => {
  if (props.toolCall.result === undefined) return false
  return JSON.stringify(props.toolCall.result, null, 2).length > 500
})
</script>

<template>
  <div class="tool-call-card">
    <Panel
      :collapsed="!isExpanded"
      toggleable
      @update:collapsed="isExpanded = !$event"
    >
      <template #header>
        <div class="tool-header">
          <i :class="[statusIcon, statusClass]" />
          <span class="tool-name">{{ displayName }}</span>
          <span v-if="isAdvancedView && toolCall.latency_ms" class="tool-latency text-xs text-muted">
            {{ toolCall.latency_ms }}ms
          </span>
        </div>
      </template>

      <div class="tool-details">
        <div class="detail-section">
          <h4 class="detail-label">Arguments</h4>
          <pre class="detail-code">{{ formattedArguments }}</pre>
        </div>

        <div v-if="toolCall.result !== undefined" class="detail-section">
          <h4 class="detail-label">
            Result
            <span v-if="toolCall.is_error" class="error-badge">Error</span>
          </h4>
          <pre class="detail-code" :class="{ 'error-result': toolCall.is_error }">{{ formattedResult }}</pre>
          <button
            v-if="isResultTruncated && !showFullResult"
            class="show-more-btn"
            @click="showFullResult = true"
          >
            Show more
          </button>
        </div>
      </div>
    </Panel>
  </div>
</template>

<style scoped>
.tool-call-card {
  margin: 0.75rem 0;
  max-width: 80%;
  align-self: flex-start;
}

:deep(.p-panel) {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
}

:deep(.p-panel-header) {
  padding: 0.75rem 1rem;
  background: var(--p-content-background);
}

:deep(.p-panel-content) {
  padding: 1rem;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tool-name {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 500;
}

.tool-latency {
  margin-left: auto;
}

.status-pending {
  color: var(--yellow-500);
}

.status-executing {
  color: var(--p-primary-color);
}

.status-success {
  color: var(--green-500);
}

.status-error {
  color: var(--red-500);
}

.tool-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-badge {
  background: var(--red-500);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.625rem;
  text-transform: uppercase;
}

.detail-code {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  padding: 0.75rem;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.8125rem;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-result {
  background: var(--p-red-50);
  color: var(--p-red-700);
}

.show-more-btn {
  background: none;
  border: none;
  color: var(--p-primary-color);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.25rem 0;
  text-decoration: underline;
}

.show-more-btn:hover {
  color: var(--p-primary-600);
}
</style>
