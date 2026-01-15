<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useTheme } from '@/composables/useTheme'
import { useConversation } from '@/composables/useConversation'
import ModelSelector from './ModelSelector.vue'
import ModelManagementModal from './ModelManagementModal.vue'
import AdvancedViewSettingsPopover from './AdvancedViewSettingsPopover.vue'

const { isDark, toggleTheme } = useTheme()
const {
  conversation,
  isAdvancedView,
  healthStatus,
  toggleAdvancedView,
  checkHealth,
  refreshTools,
  updateTitle,
} = useConversation()

const isEditingTitle = ref(false)
const editedTitle = ref('')
const showModelModal = ref(false)

function startEditingTitle(): void {
  editedTitle.value = conversation.value?.metadata.title || ''
  isEditingTitle.value = true
}

function saveTitle(): void {
  updateTitle(editedTitle.value.trim())
  isEditingTitle.value = false
}

function cancelEditingTitle(): void {
  isEditingTitle.value = false
}

function handleTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    saveTitle()
  } else if (event.key === 'Escape') {
    cancelEditingTitle()
  }
}

// Reset editing state when conversation changes
watch(
  () => conversation.value?.metadata.id,
  () => {
    isEditingTitle.value = false
  }
)

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
      <!-- Conversation Title -->
      <div v-if="conversation" class="conversation-title">
        <template v-if="isEditingTitle">
          <InputText
            v-model="editedTitle"
            placeholder="Enter conversation title..."
            class="title-input"
            size="small"
            autofocus
            @keydown="handleTitleKeydown"
            @blur="saveTitle"
          />
        </template>
        <template v-else>
          <span
            class="title-display"
            :class="{ 'has-title': conversation.metadata.title }"
            @click="startEditingTitle"
            title="Click to edit title"
          >
            {{ conversation.metadata.title || 'Untitled Conversation' }}
          </span>
          <Button
            icon="pi pi-pencil"
            severity="secondary"
            text
            rounded
            size="small"
            class="edit-title-btn"
            @click="startEditingTitle"
          />
        </template>
      </div>

      <ModelSelector v-if="conversation" @manage-models="showModelModal = true" />
    </div>

    <!-- Model Management Modal -->
    <ModelManagementModal v-model:visible="showModelModal" />

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

      <!-- Display settings popover (advanced view only) -->
      <AdvancedViewSettingsPopover v-if="isAdvancedView" />

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
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.conversation-title {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.title-display {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.title-display:hover {
  background: var(--p-content-hover-background);
}

.title-display.has-title {
  color: var(--p-text-color);
  font-weight: 500;
}

.title-input {
  min-width: 200px;
  max-width: 300px;
}

.edit-title-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.conversation-title:hover .edit-title-btn {
  opacity: 0.6;
}

.edit-title-btn:hover {
  opacity: 1 !important;
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
