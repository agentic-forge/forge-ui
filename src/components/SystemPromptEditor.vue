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
        Export the conversation before changing if you want to preserve the previous version.
      </p>

      <Textarea
        v-model="editedPrompt"
        rows="10"
        class="prompt-textarea"
        placeholder="You are a helpful AI assistant..."
      />
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
</style>
