<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import { useTheme } from '@/composables/useTheme'
import { useConversation } from '@/composables/useConversation'
import ModelSelector from './ModelSelector.vue'

const { isDark, toggleTheme } = useTheme()
const {
  conversation,
  isAdvancedView,
  healthStatus,
  toggleAdvancedView,
  checkHealth,
  refreshTools,
} = useConversation()

onMounted(() => {
  checkHealth()
  // Check health periodically
  setInterval(checkHealth, 30000)
})

function getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  if (!healthStatus.value) return 'disconnected'
  // Orchestrator returns status: "ok", not "healthy"
  const status = healthStatus.value.status
  return (status === 'ok' || status === 'healthy') ? 'connected' : 'disconnected'
}
</script>

<template>
  <header class="header-bar">
    <div class="header-left">
      <h1 class="logo">Forge UI</h1>
      <div class="connection-status">
        <span
          class="status-dot"
          :class="getConnectionStatus()"
          :title="healthStatus?.armory_connected ? 'Connected to Armory' : 'Armory not connected'"
        />
        <span class="status-text text-sm text-muted">
          {{ getConnectionStatus() === 'connected' ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
    </div>

    <div class="header-center">
      <ModelSelector v-if="conversation" />
    </div>

    <div class="header-right">
      <Button
        v-if="isAdvancedView"
        icon="pi pi-refresh"
        severity="secondary"
        text
        rounded
        title="Refresh Tools"
        @click="refreshTools"
      />

      <Button
        :icon="isAdvancedView ? 'pi pi-cog' : 'pi pi-eye'"
        :label="isAdvancedView ? 'Advanced' : 'Basic'"
        :severity="isAdvancedView ? 'primary' : 'secondary'"
        :outlined="!isAdvancedView"
        size="small"
        class="view-toggle"
        @click="toggleAdvancedView"
      />

      <Button
        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'"
        severity="secondary"
        text
        rounded
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        @click="toggleTheme"
      />
    </div>
  </header>
</template>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
  min-height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--p-primary-color);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--p-text-muted-color);
}

.status-dot.connected {
  background-color: #22c55e;
  box-shadow: 0 0 6px #22c55e80;
}

.status-dot.disconnected {
  background-color: #ef4444;
}

.status-dot.connecting {
  background-color: #f59e0b;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.view-toggle {
  font-size: 0.875rem;
}
</style>
