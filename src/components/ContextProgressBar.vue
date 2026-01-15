<script setup lang="ts">
import { computed } from 'vue'
import ProgressBar from 'primevue/progressbar'

const props = defineProps<{
  cumulativeTokens: number
  contextLimit: number
  perTurnInput?: number
  compact?: boolean
}>()

const percentUsed = computed(() =>
  Math.min((props.cumulativeTokens / props.contextLimit) * 100, 100)
)

const severityClass = computed(() => {
  if (percentUsed.value > 90) return 'danger'
  if (percentUsed.value > 75) return 'warning'
  return ''
})

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
</script>

<template>
  <div class="context-progress" :class="{ compact }">
    <div class="context-header">
      <span class="context-label">Context</span>
      <span class="context-value">
        {{ formatNumber(cumulativeTokens) }} / {{ formatNumber(contextLimit) }}
        <span class="context-percent">({{ percentUsed.toFixed(1) }}%)</span>
      </span>
    </div>
    <ProgressBar
      :value="percentUsed"
      :showValue="false"
      :class="severityClass"
    />
    <div v-if="perTurnInput !== undefined && !compact" class="turn-info">
      <span class="turn-label">This turn:</span>
      <span class="turn-value">{{ formatNumber(perTurnInput) }} input tokens</span>
    </div>
  </div>
</template>

<style scoped>
.context-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.context-progress.compact {
  gap: 0.125rem;
}

.context-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
}

.context-label {
  color: var(--p-text-muted-color);
  font-weight: 500;
}

.context-value {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  color: var(--p-text-color);
}

.context-percent {
  color: var(--p-text-muted-color);
  margin-left: 0.25rem;
}

.turn-info {
  display: flex;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
}

:deep(.p-progressbar) {
  height: 4px;
  border-radius: 2px;
  background: var(--p-surface-200);
}

.app-dark :deep(.p-progressbar) {
  background: var(--p-surface-700);
}

:deep(.p-progressbar-value) {
  background: var(--p-primary-color);
}

:deep(.p-progressbar.warning .p-progressbar-value) {
  background: var(--p-yellow-500);
}

:deep(.p-progressbar.danger .p-progressbar-value) {
  background: var(--p-red-500);
}
</style>
