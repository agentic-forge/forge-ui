<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Button from 'primevue/button'
import type { DebugEvent } from '@/types'

const props = defineProps<{
  events: DebugEvent[]
}>()

const panelRef = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

// Auto-scroll to bottom on new events
watch(
  () => props.events.length,
  async () => {
    if (autoScroll.value) {
      await nextTick()
      if (panelRef.value) {
        panelRef.value.scrollTop = panelRef.value.scrollHeight
      }
    }
  }
)

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function getEventColor(type: string): string {
  switch (type) {
    case 'token':
      return 'var(--blue-400)'
    case 'thinking':
      return 'var(--purple-400)'
    case 'tool_call':
      return 'var(--orange-400)'
    case 'tool_result':
      return 'var(--green-400)'
    case 'complete':
      return 'var(--teal-400)'
    case 'error':
      return 'var(--red-400)'
    case 'ping':
      return 'var(--gray-400)'
    default:
      return 'var(--p-text-color)'
  }
}

function copyEvent(event: DebugEvent): void {
  navigator.clipboard.writeText(event.raw)
}
</script>

<template>
  <div class="debug-panel">
    <div class="debug-header">
      <span class="debug-title">
        <i class="pi pi-code" ></i>
        Debug Events
      </span>
      <div class="debug-actions">
        <label class="auto-scroll-toggle">
          <input v-model="autoScroll" type="checkbox" />
          <span class="text-xs">Auto-scroll</span>
        </label>
        <span class="event-count text-xs text-muted">
          {{ events.length }} events
        </span>
      </div>
    </div>
    <div ref="panelRef" class="debug-content">
      <div
        v-for="event in events"
        :key="event.id"
        class="debug-event"
      >
        <div class="event-header">
          <span class="event-time text-xs">
            {{ formatTimestamp(event.timestamp) }}
          </span>
          <span
            class="event-type"
            :style="{ color: getEventColor(event.type) }"
          >
            {{ event.type }}
          </span>
          <Button
            icon="pi pi-copy"
            text
            rounded
            size="small"
            class="copy-btn"
            title="Copy raw JSON"
            @click="copyEvent(event)"
          />
        </div>
        <pre class="event-data">{{ event.raw }}</pre>
      </div>
      <div v-if="events.length === 0" class="no-events">
        <i class="pi pi-inbox" ></i>
        <span>No events yet</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  width: 400px;
  background: var(--p-surface-900);
  border-left: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  color: var(--p-surface-100);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--p-surface-800);
  border-bottom: 1px solid var(--p-surface-700);
}

.debug-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.debug-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auto-scroll-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.auto-scroll-toggle input {
  cursor: pointer;
}

.debug-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
}

.debug-event {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: var(--p-surface-800);
  border-radius: 4px;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.event-time {
  color: var(--p-surface-400);
}

.event-type {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.copy-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  color: var(--p-surface-400);
}

.copy-btn:hover {
  color: var(--p-surface-100);
}

.event-data {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--p-surface-300);
  max-height: 150px;
  overflow-y: auto;
}

.no-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--p-surface-500);
  gap: 0.5rem;
}

.no-events i {
  font-size: 2rem;
}
</style>
