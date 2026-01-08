<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Select from 'primevue/select'
import { useConversation } from '@/composables/useConversation'

const { conversation, updateModel, preferredModel, setPreferredModel } = useConversation()

// Common OpenRouter models
const modelOptions = [
  { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4' },
  { label: 'Claude Opus 4', value: 'anthropic/claude-opus-4' },
  { label: 'Claude 3.5 Haiku', value: 'anthropic/claude-3.5-haiku' },
  { label: 'GPT-4o', value: 'openai/gpt-4o' },
  { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
  { label: 'Gemini Pro 1.5', value: 'google/gemini-pro-1.5' },
  { label: 'DeepSeek V3', value: 'deepseek/deepseek-chat' },
  { label: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' },
]

// Use conversation model if available, otherwise use preferred model
const selectedModel = ref(conversation.value?.metadata?.model || preferredModel.value)

// Sync with conversation model when it changes
watch(
  () => conversation.value?.metadata?.model,
  (newModel) => {
    if (newModel) {
      selectedModel.value = newModel
    }
  }
)

async function handleModelChange(model: string): Promise<void> {
  if (!model) return

  // Always save as preferred model
  setPreferredModel(model)

  // Update conversation model if in a conversation
  if (conversation.value?.metadata && model !== conversation.value.metadata.model) {
    await updateModel(model)
  }
}

const displayLabel = computed(() => {
  const option = modelOptions.find((o) => o.value === selectedModel.value)
  return option?.label || selectedModel.value
})
</script>

<template>
  <div class="model-selector">
    <Select
      v-model="selectedModel"
      :options="modelOptions"
      optionLabel="label"
      optionValue="value"
      placeholder="Select Model"
      class="model-dropdown"
      @change="handleModelChange(selectedModel)"
    >
      <template #value="slotProps">
        <div v-if="slotProps.value" class="selected-model">
          <i class="pi pi-microchip" />
          <span>{{ displayLabel }}</span>
        </div>
        <span v-else>{{ slotProps.placeholder }}</span>
      </template>
      <template #option="slotProps">
        <div class="model-option">
          {{ slotProps.option.label }}
        </div>
      </template>
    </Select>
  </div>
</template>

<style scoped>
.model-selector {
  min-width: 200px;
}

.model-dropdown {
  width: 100%;
}

.selected-model {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-option {
  padding: 0.25rem 0;
}
</style>
