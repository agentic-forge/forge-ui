<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import MessageList from '@/components/MessageList.vue'
import ChatInput from '@/components/ChatInput.vue'
import SystemPromptEditor from '@/components/SystemPromptEditor.vue'
import { useConversation } from '@/composables/useConversation'

const {
  conversation,
  isAdvancedView,
  toggleDebugPanel,
  showDebugPanel,
  toggleToolsPanel,
  showToolsPanel,
  deleteConversation,
  exportConversation,
} = useConversation()

const showSystemPromptEditor = ref(false)

async function handleDeleteConversation(): Promise<void> {
  if (confirm('Are you sure you want to delete this conversation?')) {
    await deleteConversation()
  }
}
</script>

<template>
  <div class="chat-view">
    <!-- Chat toolbar -->
    <div class="chat-toolbar">
      <div class="toolbar-left">
        <span v-if="conversation?.metadata" class="conversation-id text-xs text-muted">
          {{ conversation.metadata.id }}
        </span>
      </div>
      <div class="toolbar-right">
        <Button
          icon="pi pi-file-edit"
          severity="secondary"
          text
          size="small"
          title="Edit System Prompt"
          @click="showSystemPromptEditor = true"
        />
        <Button
          icon="pi pi-download"
          severity="secondary"
          text
          size="small"
          title="Export Conversation"
          @click="exportConversation"
        />
        <Button
          v-if="isAdvancedView"
          :icon="showToolsPanel ? 'pi pi-wrench' : 'pi pi-wrench'"
          :severity="showToolsPanel ? 'primary' : 'secondary'"
          text
          size="small"
          :title="showToolsPanel ? 'Hide Tools Panel' : 'Show Tools Panel'"
          @click="toggleToolsPanel"
        />
        <Button
          v-if="isAdvancedView"
          :icon="showDebugPanel ? 'pi pi-eye-slash' : 'pi pi-code'"
          severity="secondary"
          text
          size="small"
          :title="showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'"
          @click="toggleDebugPanel"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          size="small"
          title="Delete Conversation"
          @click="handleDeleteConversation"
        />
      </div>
    </div>

    <!-- Messages -->
    <MessageList />

    <!-- Input -->
    <ChatInput />

    <!-- System Prompt Editor Dialog -->
    <SystemPromptEditor v-model:visible="showSystemPromptEditor" />
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.conversation-id {
  font-family: monospace;
}
</style>
