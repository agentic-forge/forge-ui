<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useServers } from '@/composables/useServers'
import AddServerDialog from './AddServerDialog.vue'
import type { MCPServerConfig } from '@/types/servers'

const { servers, toggleServer, removeServer, testServer } = useServers()

// Dialog state
const showAddDialog = ref(false)
const editingServer = ref<MCPServerConfig | null>(null)

// Testing state
const testingServerId = ref<string | null>(null)

function handleAddServer() {
  editingServer.value = null
  showAddDialog.value = true
}

function handleEditServer(server: MCPServerConfig) {
  editingServer.value = server
  showAddDialog.value = true
}

function handleDeleteServer(server: MCPServerConfig) {
  if (confirm(`Remove "${server.name}" server?`)) {
    removeServer(server.id)
  }
}

async function handleTestServer(server: MCPServerConfig) {
  testingServerId.value = server.id
  try {
    await testServer(server.id)
  } finally {
    testingServerId.value = null
  }
}

function getStatusColor(status: MCPServerConfig['status']): string {
  switch (status) {
    case 'connected':
      return 'var(--p-green-500)'
    case 'error':
      return 'var(--p-red-500)'
    default:
      return 'var(--p-gray-500)'
  }
}

function getStatusIcon(status: MCPServerConfig['status']): string {
  switch (status) {
    case 'connected':
      return 'pi-check-circle'
    case 'error':
      return 'pi-times-circle'
    default:
      return 'pi-circle'
  }
}
</script>

<template>
  <div class="servers-panel">
    <div class="servers-header">
      <span class="servers-title">
        <i class="pi pi-cloud"></i>
        Custom MCP Servers
      </span>
      <Button
        icon="pi pi-plus"
        text
        rounded
        size="small"
        title="Add server"
        @click="handleAddServer"
      />
    </div>

    <div class="servers-content">
      <template v-if="servers.length === 0">
        <div class="no-servers">
          <i class="pi pi-cloud-upload"></i>
          <span>No custom servers</span>
          <span class="text-xs text-muted">Add your own MCP servers</span>
          <Button
            label="Add Server"
            icon="pi pi-plus"
            size="small"
            text
            @click="handleAddServer"
          />
        </div>
      </template>

      <template v-else>
        <div
          v-for="server in servers"
          :key="server.id"
          class="server-item"
          :class="{ disabled: !server.enabled }"
        >
          <div class="server-main">
            <div class="server-status">
              <i
                class="pi"
                :class="getStatusIcon(server.status)"
                :style="{ color: getStatusColor(server.status) }"
              ></i>
            </div>
            <div class="server-info">
              <div class="server-name-row">
                <span class="server-name">{{ server.name }}</span>
                <span v-if="server.toolCount" class="tool-count">
                  {{ server.toolCount }} tools
                </span>
              </div>
              <div class="server-url">{{ server.url }}</div>
              <div v-if="server.lastError && server.status === 'error'" class="server-error">
                {{ server.lastError }}
              </div>
            </div>
            <ToggleSwitch
              :modelValue="server.enabled"
              @update:modelValue="toggleServer(server.id)"
              class="server-toggle"
            />
          </div>

          <div class="server-actions">
            <Button
              icon="pi pi-bolt"
              text
              rounded
              size="small"
              title="Test connection"
              :loading="testingServerId === server.id"
              @click="handleTestServer(server)"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              title="Edit server"
              @click="handleEditServer(server)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              title="Remove server"
              @click="handleDeleteServer(server)"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- Add/Edit Dialog -->
    <AddServerDialog
      v-model:visible="showAddDialog"
      :edit-server="editingServer"
      @server-saved="showAddDialog = false"
    />
  </div>
</template>

<style scoped>
.servers-panel {
  background: var(--p-surface-900);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.servers-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--p-surface-800);
  border-radius: 6px 6px 0 0;
  border-bottom: 1px solid var(--p-surface-700);
}

.servers-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--p-surface-100);
}

.servers-content {
  padding: 0.5rem;
}

.server-item {
  background: var(--p-surface-800);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border-left: 2px solid var(--p-primary-color);
  overflow: hidden;
}

.server-item.disabled {
  opacity: 0.6;
  border-left-color: var(--p-gray-500);
}

.server-main {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
}

.server-status {
  padding-top: 0.125rem;
}

.server-status i {
  font-size: 1rem;
}

.server-info {
  flex: 1;
  min-width: 0;
}

.server-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.server-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-surface-100);
}

.tool-count {
  font-size: 0.6875rem;
  background: rgba(var(--p-primary-color-rgb), 0.2);
  color: var(--p-primary-300);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.server-url {
  font-size: 0.75rem;
  color: var(--p-surface-400);
  margin-top: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.server-error {
  font-size: 0.6875rem;
  color: var(--p-red-400);
  margin-top: 0.25rem;
}

.server-toggle {
  flex-shrink: 0;
}

.server-actions {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--p-surface-850);
  border-top: 1px solid var(--p-surface-700);
}

.server-actions :deep(.p-button) {
  width: 28px;
  height: 28px;
  color: var(--p-surface-400);
}

.server-actions :deep(.p-button:hover) {
  color: var(--p-surface-100);
}

.no-servers {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--p-surface-500);
  gap: 0.5rem;
  text-align: center;
}

.no-servers i {
  font-size: 2rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-muted {
  color: var(--p-surface-500);
}
</style>
