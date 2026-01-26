<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import type { Tool } from '@/types'
import { useConversation } from '@/composables/useConversation'
import { useServers } from '@/composables/useServers'
import ServersPanel from './ServersPanel.vue'

const { availableTools, refreshTools, healthStatus } = useConversation()
const { customServerTools } = useServers()

// Collapsible state for servers section
const showServersSection = ref(true)

// Track collapsed server groups
const collapsedServers = ref<Set<string>>(new Set())

const isArmoryConnected = computed(() => healthStatus.value?.armory_connected ?? false)

// Merge Armory tools with custom server tools
const allTools = computed<Tool[]>(() => {
  return [...availableTools.value, ...customServerTools.value]
})

interface ParsedToolServer {
  server: string
  name: string
  isCustom: boolean
}

/**
 * Parse tool name to extract server and display name.
 * Handles both formats:
 * - Custom: _serverName__toolName (starts with underscore)
 * - Armory: serverName__toolName (no leading underscore)
 */
function parseToolServer(toolName: string): ParsedToolServer {
  // Check for custom server prefix (_serverName__toolName)
  if (toolName.startsWith('_') && toolName.includes('__')) {
    const withoutPrefix = toolName.substring(1) // Remove leading underscore
    const [server, ...rest] = withoutPrefix.split('__')
    return { server, name: rest.join('__'), isCustom: true }
  }

  // Check for Armory prefix (serverName__toolName)
  if (toolName.includes('__')) {
    const [server, ...rest] = toolName.split('__')
    return { server, name: rest.join('__'), isCustom: false }
  }

  // Special case: search_tools is the RAG meta-tool
  if (toolName === 'search_tools') {
    return { server: 'Tool RAG', name: toolName, isCustom: false }
  }

  // Unknown format
  return { server: 'other', name: toolName, isCustom: false }
}

interface ServerGroup {
  name: string
  isCustom: boolean
  tools: Tool[]
}

const toolsByServer = computed(() => {
  const grouped = new Map<string, ServerGroup>()

  for (const tool of allTools.value) {
    const parsed = parseToolServer(tool.name)
    const key = `${parsed.isCustom ? '@' : ''}${parsed.server}`

    if (!grouped.has(key)) {
      grouped.set(key, {
        name: parsed.server,
        isCustom: parsed.isCustom,
        tools: [],
      })
    }
    grouped.get(key)!.tools.push(tool)
  }

  return grouped
})

function toggleServerGroup(serverKey: string): void {
  if (collapsedServers.value.has(serverKey)) {
    collapsedServers.value.delete(serverKey)
  } else {
    collapsedServers.value.add(serverKey)
  }
  // Trigger reactivity
  collapsedServers.value = new Set(collapsedServers.value)
}

function isServerCollapsed(serverKey: string): boolean {
  return collapsedServers.value.has(serverKey)
}

function getToolDisplayName(tool: Tool): string {
  const parsed = parseToolServer(tool.name)
  return parsed.name
}

function copyToolSchema(tool: Tool): void {
  const schema = JSON.stringify(tool.inputSchema, null, 2)
  navigator.clipboard.writeText(schema)
}
</script>

<template>
  <div class="tools-panel">
    <!-- Custom MCP Servers Section -->
    <div class="servers-section">
      <div
        class="section-toggle"
        @click="showServersSection = !showServersSection"
      >
        <i class="pi" :class="showServersSection ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
        <span>Custom Servers</span>
      </div>
      <ServersPanel v-if="showServersSection" />
    </div>

    <!-- Tools Section -->
    <div class="tools-header">
      <span class="tools-title">
        <i class="pi pi-wrench" ></i>
        Available Tools
      </span>
      <div class="tools-actions">
        <span class="tool-count text-xs text-muted">
          {{ allTools.length }} tools
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
      <template v-else-if="allTools.length === 0">
        <div class="no-tools">
          <i class="pi pi-inbox" ></i>
          <span>No tools available</span>
          <span class="text-xs text-muted">Click refresh to load tools</span>
        </div>
      </template>
      <template v-else>
        <div
          v-for="[serverKey, group] in toolsByServer"
          :key="serverKey"
          class="server-group"
          :class="{ 'custom-server': group.isCustom }"
        >
          <div
            class="server-header"
            @click="toggleServerGroup(serverKey)"
          >
            <i
              class="pi collapse-icon"
              :class="isServerCollapsed(serverKey) ? 'pi-chevron-right' : 'pi-chevron-down'"
            ></i>
            <i class="pi" :class="group.isCustom ? 'pi-user' : 'pi-server'"></i>
            <span class="server-name">{{ group.name }}</span>
            <span v-if="group.isCustom" class="custom-tag">Custom</span>
            <span class="server-count text-xs text-muted">{{ group.tools.length }}</span>
          </div>
          <div v-if="!isServerCollapsed(serverKey)" class="server-tools">
            <div
              v-for="tool in group.tools"
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
  overflow-y: auto;
}

.servers-section {
  border-bottom: 1px solid var(--p-surface-700);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: var(--p-surface-400);
  cursor: pointer;
  user-select: none;
}

.section-toggle:hover {
  color: var(--p-surface-200);
  background: var(--p-surface-800);
}

.section-toggle i {
  font-size: 0.625rem;
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
  cursor: pointer;
  user-select: none;
}

.server-header:hover {
  background: var(--p-surface-700);
}

.collapse-icon {
  font-size: 0.625rem;
  color: var(--p-surface-400);
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

.custom-tag {
  font-size: 0.625rem;
  background: var(--p-cyan-900);
  color: var(--p-cyan-300);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 600;
}

.custom-server .server-header {
  background: color-mix(in srgb, var(--p-cyan-700) 20%, var(--p-surface-800));
}

.custom-server .tool-item {
  border-left-color: var(--p-cyan-500);
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
