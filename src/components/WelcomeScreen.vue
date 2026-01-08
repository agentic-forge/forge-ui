<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import { useToast } from 'primevue/usetoast'
import { useConversation } from '@/composables/useConversation'

const { createConversation, importConversation } = useConversation()
const toast = useToast()

const isCreating = ref(false)

async function handleNewChat(): Promise<void> {
  isCreating.value = true
  try {
    await createConversation()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to create conversation',
      life: 3000,
    })
    console.error('Failed to create conversation:', error)
  } finally {
    isCreating.value = false
  }
}

async function handleImport(event: { files: File[] }): Promise<void> {
  const file = event.files[0]
  if (!file) return

  try {
    await importConversation(file)
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Conversation imported',
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to import conversation',
      life: 3000,
    })
    console.error('Failed to import conversation:', error)
  }
}
</script>

<template>
  <div class="welcome-screen">
    <div class="welcome-content">
      <div class="welcome-header">
        <h1 class="welcome-title">Welcome to Forge UI</h1>
        <p class="welcome-subtitle text-muted">
          Start a new conversation or import an existing one
        </p>
      </div>

      <Button
        label="New Chat"
        icon="pi pi-plus"
        :loading="isCreating"
        class="new-chat-btn"
        @click="handleNewChat"
      />

      <div class="divider">
        <span class="divider-text">or</span>
      </div>

      <div class="import-section">
        <FileUpload
          mode="basic"
          accept=".json"
          :maxFileSize="10000000"
          chooseLabel="Import Conversation"
          class="import-btn"
          @select="handleImport"
        />
        <p class="import-hint text-xs text-muted">
          Import a previously exported conversation JSON file
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.welcome-content {
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.welcome-header {
  margin-bottom: 2rem;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.welcome-subtitle {
  margin: 0;
}

.new-chat-btn {
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--p-content-border-color);
}

.divider-text {
  padding: 0 1rem;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.import-section {
  text-align: center;
}

.import-btn {
  width: 100%;
}

:deep(.import-btn .p-button) {
  width: 100%;
  justify-content: center;
}

.import-hint {
  margin-top: 0.5rem;
}
</style>
