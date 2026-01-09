<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useConversation } from '@/composables/useConversation'
import type { ModelInfo } from '@/types'

const {
  conversation,
  updateModel,
  preferredModel,
  setPreferredModel,
  availableModels,
  availableProviders,
  isLoadingModels,
  fetchModels,
  refreshModels,
} = useConversation()

// Fallback models if API hasn't been called yet
const fallbackModels: ModelInfo[] = [
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    context_length: 200000,
    pricing: { prompt: 0.000003, completion: 0.000015 },
    supports_tools: true,
    supports_vision: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    context_length: 128000,
    pricing: { prompt: 0.0000025, completion: 0.00001 },
    supports_tools: true,
    supports_vision: true,
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    context_length: 1000000,
    pricing: { prompt: 0, completion: 0 },
    supports_tools: true,
    supports_vision: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    context_length: 64000,
    pricing: { prompt: 0.00000014, completion: 0.00000028 },
    supports_tools: true,
    supports_vision: false,
  },
]

// Filter state
const selectedProvider = ref<string | null>(null)
const filterToolsSupport = ref(false)
const filterVisionSupport = ref(false)
const showFilters = ref(false)

// Use API models if available, fallback to hardcoded
const models = computed(() => {
  return availableModels.value.length > 0 ? availableModels.value : fallbackModels
})

const providers = computed(() => {
  if (availableProviders.value.length > 0) {
    return [{ label: 'All Providers', value: null }, ...availableProviders.value.map((p) => ({
      label: formatProviderName(p),
      value: p,
    }))]
  }
  // Fallback providers
  const uniqueProviders = [...new Set(fallbackModels.map((m) => m.provider))]
  return [{ label: 'All Providers', value: null }, ...uniqueProviders.map((p) => ({
    label: formatProviderName(p),
    value: p,
  }))]
})

// Filtered models based on provider and feature filters
const filteredModels = computed(() => {
  let result = models.value

  if (selectedProvider.value) {
    result = result.filter((m) => m.provider === selectedProvider.value)
  }

  if (filterToolsSupport.value) {
    result = result.filter((m) => m.supports_tools)
  }

  if (filterVisionSupport.value) {
    result = result.filter((m) => m.supports_vision)
  }

  return result
})

// Model options for dropdown
const modelOptions = computed(() => {
  return filteredModels.value.map((m) => ({
    label: m.name,
    value: m.id,
    model: m,
  }))
})

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

function formatProviderName(provider: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    deepseek: 'DeepSeek',
    moonshotai: 'Kimi',
    qwen: 'Qwen',
  }
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

function formatPrice(price: number): string {
  if (price === 0) return 'Free'
  // Convert to price per 1M tokens
  const perMillion = price * 1_000_000
  if (perMillion < 0.01) return '<$0.01/M'
  return `$${perMillion.toFixed(2)}/M`
}

async function handleModelChange(model: string): Promise<void> {
  if (!model) return

  // Always save as preferred model
  setPreferredModel(model)

  // Update conversation model if in a conversation
  if (conversation.value?.metadata && model !== conversation.value.metadata.model) {
    await updateModel(model)
  }
}

async function handleRefresh(): Promise<void> {
  await refreshModels()
}

const displayLabel = computed(() => {
  const model = models.value.find((m) => m.id === selectedModel.value)
  return model?.name || selectedModel.value
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (selectedProvider.value) count++
  if (filterToolsSupport.value) count++
  if (filterVisionSupport.value) count++
  return count
})

// Fetch models on mount if not already loaded
onMounted(async () => {
  if (availableModels.value.length === 0) {
    try {
      await fetchModels()
    } catch (e) {
      console.warn('Failed to fetch models, using fallback:', e)
    }
  }
})
</script>

<template>
  <div class="model-selector">
    <div class="selector-row">
      <Select
        v-model="selectedModel"
        :options="modelOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Select Model"
        class="model-dropdown"
        :loading="isLoadingModels"
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
            <div class="model-option-main">
              <span class="model-name">{{ slotProps.option.label }}</span>
              <span class="model-provider">{{ formatProviderName(slotProps.option.model.provider) }}</span>
            </div>
            <div class="model-option-meta">
              <span v-if="slotProps.option.model.supports_tools" class="badge badge-tools" title="Supports tool calling">
                <i class="pi pi-wrench" />
              </span>
              <span v-if="slotProps.option.model.supports_vision" class="badge badge-vision" title="Supports vision">
                <i class="pi pi-eye" />
              </span>
              <span class="model-price">{{ formatPrice(slotProps.option.model.pricing.prompt) }}</span>
            </div>
          </div>
        </template>
      </Select>

      <Button
        icon="pi pi-filter"
        :severity="activeFiltersCount > 0 ? 'primary' : 'secondary'"
        text
        rounded
        :badge="activeFiltersCount > 0 ? String(activeFiltersCount) : undefined"
        title="Filter models"
        @click="showFilters = !showFilters"
      />

      <Button
        icon="pi pi-refresh"
        severity="secondary"
        text
        rounded
        :loading="isLoadingModels"
        title="Refresh models from OpenRouter"
        @click="handleRefresh"
      />
    </div>

    <div v-if="showFilters" class="filters-panel">
      <div class="filter-row">
        <label>Provider</label>
        <Select
          v-model="selectedProvider"
          :options="providers"
          optionLabel="label"
          optionValue="value"
          placeholder="All Providers"
          class="provider-dropdown"
        />
      </div>

      <div class="filter-row checkboxes">
        <label class="checkbox-label">
          <Checkbox v-model="filterToolsSupport" :binary="true" />
          <i class="pi pi-wrench" />
          <span>Tools</span>
        </label>

        <label class="checkbox-label">
          <Checkbox v-model="filterVisionSupport" :binary="true" />
          <i class="pi pi-eye" />
          <span>Vision</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-selector {
  min-width: 200px;
}

.selector-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.model-dropdown {
  flex: 1;
  min-width: 180px;
}

.selected-model {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  gap: 1rem;
  width: 100%;
}

.model-option-main {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.model-name {
  font-weight: 500;
  color: var(--p-text-color);
}

.model-provider {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.model-option-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
}

.badge-tools {
  background: color-mix(in srgb, var(--p-blue-500) 20%, transparent);
  color: var(--p-blue-500);
}

.badge-vision {
  background: color-mix(in srgb, var(--p-green-500) 20%, transparent);
  color: var(--p-green-500);
}

.model-price {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  min-width: 4rem;
  text-align: right;
}

.filters-panel {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-border-radius);
  background: var(--p-surface-ground);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-row + .filter-row {
  margin-top: 0.5rem;
}

.filter-row > label:first-child {
  min-width: 4rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.provider-dropdown {
  flex: 1;
}

.filter-row.checkboxes {
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--p-text-color);
}

.checkbox-label i {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
</style>
