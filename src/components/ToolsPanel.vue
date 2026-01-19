<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import type { Tool } from '@/types'
import { useConversation } from '@/composables/useConversation'

const { availableTools, refreshTools, healthStatus } = useConversation()

const isArmoryConnected = computed(() => healthStatus.value?.armory_connected ?? false)

const toolsByServer = computed(() => {
  const grouped = new Map<string, Tool[]>()

  for (const tool of availableTools.value) {
    // Tool names are prefixed with server name, e.g., "weather__get_current_weather"
    const parts = tool.name.split('__')
    const serverName = parts.length > 1 ? parts[0] : 'unknown'

    if (!grouped.has(serverName)) {
      grouped.set(serverName, [])
    }
    grouped.get(serverName)!.push(tool)
  }

  return grouped
})

function getToolDisplayName(tool: Tool): string {
  // Remove server prefix from tool name
  const parts = tool.name.split('__')
  return parts.length > 1 ? parts.slice(1).join('__') : tool.name
}

function copyToolSchema(tool: Tool): void {
  const schema = JSON.stringify(tool.inputSchema, null, 2)
  navigator.clipboard.writeText(schema)
}
</script>

<template>
  <div class="tools-panel">
    <div class="tools-header">
      <span class="tools-title">
        <i class="pi pi-wrench" ></i>
        Available Tools
      </span>
      <div class="tools-actions">
        <span class="tool-count text-xs text-muted">
          {{ availableTools.length }} tools
        </span>
        <Button
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          title="Refresh tools"
          @click="refreshTools"
        />
      </div>
    </div>
    <div class="tools-content">
      <template v-if="!isArmoryConnected">
        <div class="no-tools">
          <i class="pi pi-exclamation-triangle" style="color: var(--orange-400)" ></i>
          <span>Armory not connected</span>
          <span class="text-xs text-muted">Tools are unavailable</span>
        </div>
      </template>
      <template v-else-if="availableTools.length === 0">
        <div class="no-tools">
          <i class="pi pi-inbox" ></i>
          <span>No tools available</span>
          <span class="text-xs text-muted">Click refresh to load tools</span>
        </div>
      </template>
      <template v-else>
        <div
          v-for="[serverName, tools] in toolsByServer"
          :key="serverName"
          class="server-group"
        >
          <div class="server-header">
            <i class="pi pi-server" ></i>
            <span class="server-name">{{ serverName }}</span>
            <span class="server-count text-xs text-muted">{{ tools.length }}</span>
          </div>
          <div class="server-tools">
            <div
              v-for="tool in tools"
              :key="tool.name"
              class="tool-item"
            >
              <div class="tool-header">
                <span class="tool-name">{{ getToolDisplayName(tool) }}</span>
                <Button
                  v-if="tool.inputSchema"
                  icon="pi pi-copy"
                  text
                  rounded
                  size="small"
                  class="copy-btn"
                  title="Copy input schema"
                  @click="copyToolSchema(tool)"
                />
              </div>
              <div v-if="tool.description" class="tool-description">
                {{ tool.description }}
              </div>
              <div v-if="tool.inputSchema?.properties" class="tool-params">
                <span class="params-label">Parameters:</span>
                <span
                  v-for="(_, paramName) in (tool.inputSchema.properties as Record<string, unknown>)"
                  :key="String(paramName)"
                  class="param-tag"
                >
                  {{ paramName }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tools-panel {
  width: 320px;
  background: var(--p-surface-900);
  border-left: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  color: var(--p-surface-100);
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--p-surface-800);
  border-bottom: 1px solid var(--p-surface-700);
}

.tools-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.tools-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tools-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.server-group {
  margin-bottom: 1rem;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--p-surface-800);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.server-name {
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: capitalize;
}

.server-count {
  margin-left: auto;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.server-tools {
  padding-left: 0.5rem;
}

.tool-item {
  padding: 0.5rem;
  background: var(--p-surface-800);
  border-radius: 4px;
  margin-bottom: 0.5rem;
  border-left: 2px solid var(--p-primary-color);
}

.tool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tool-name {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  color: var(--p-primary-color);
  font-weight: 500;
}

.copy-btn {
  width: 24px;
  height: 24px;
  color: var(--p-surface-400);
}

.copy-btn:hover {
  color: var(--p-surface-100);
}

.tool-description {
  font-size: 0.75rem;
  color: var(--p-surface-300);
  margin-top: 0.25rem;
  line-height: 1.4;
}

.tool-params {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
  align-items: center;
}

.params-label {
  font-size: 0.625rem;
  color: var(--p-surface-500);
  text-transform: uppercase;
  margin-right: 0.25rem;
}

.param-tag {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.6875rem;
  background: rgba(var(--p-primary-color-rgb), 0.2);
  color: var(--p-primary-300);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.no-tools {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--p-surface-500);
  gap: 0.5rem;
  text-align: center;
}

.no-tools i {
  font-size: 2rem;
}
</style>
