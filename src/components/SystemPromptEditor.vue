<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useConversation } from '@/composables/useConversation'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { conversation, updateSystemPrompt } = useConversation()
const toast = useToast()

const editedPrompt = ref('')
const isSaving = ref(false)

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      editedPrompt.value = conversation.value?.metadata?.system_prompt || ''
    }
  }
)

async function handleSave(): Promise<void> {
  if (!conversation.value?.metadata?.id) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No active conversation',
      life: 3000,
    })
    return
  }

  isSaving.value = true
  try {
    await updateSystemPrompt(editedPrompt.value)
    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: 'System prompt updated',
      life: 2000,
    })
    emit('update:visible', false)
  } catch (error) {
    console.error('Failed to update system prompt:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update system prompt',
      life: 3000,
    })
  } finally {
    isSaving.value = false
  }
}

function handleCancel(): void {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Edit System Prompt"
    :style="{ width: '600px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="editor-content">
      <p class="editor-description text-sm text-muted">
        The system prompt sets the behavior and context for the AI assistant.
        Changes will be versioned and saved to conversation history.
      </p>

      <Textarea
        v-model="editedPrompt"
        rows="10"
        class="prompt-textarea"
        placeholder="You are a helpful AI assistant..."
      />

      <div v-if="conversation?.metadata?.system_prompt_history?.length" class="history-section">
        <h4 class="history-label text-sm">Previous Versions</h4>
        <div class="history-list">
          <div
            v-for="(item, index) in conversation.metadata?.system_prompt_history"
            :key="index"
            class="history-item"
          >
            <span class="history-date text-xs text-muted">
              {{ new Date(item.set_at).toLocaleString() }}
            </span>
            <p class="history-content text-sm">
              {{ item.content.substring(0, 100) }}{{ item.content.length > 100 ? '...' : '' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        severity="secondary"
        text
        @click="handleCancel"
      />
      <Button
        label="Save"
        :loading="isSaving"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.editor-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-description {
  margin: 0;
}

.prompt-textarea {
  width: 100%;
  font-family: inherit;
}

.history-section {
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 1rem;
}

.history-label {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  padding: 0.5rem;
  border-radius: 6px;
}

.history-date {
  display: block;
  margin-bottom: 0.25rem;
}

.history-content {
  margin: 0;
}
</style>
