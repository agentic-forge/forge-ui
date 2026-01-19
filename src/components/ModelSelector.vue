<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { useConversation } from '@/composables/useConversation'
import type { ModelConfig } from '@/types'

const emit = defineEmits<{
  (e: 'manage-models'): void
}>()

const {
  conversation,
  updateModel,
  preferredModel,
  setPreferredModel,
  isLoadingModels,
  // New model management
  groupedModels,
  fetchModelsGrouped,
  fetchProviders,
} = useConversation()

// Whether to use new grouped models (if available)
const useNewModelSystem = computed(() => {
  return groupedModels.value !== null && Object.keys(groupedModels.value.providers).length > 0
})

// Dropdown option type
interface ModelOption {
  label: string
  value: string
  provider: string
  model: ModelConfig | null
  isHeader?: boolean
  isFavorite?: boolean
  isRecent?: boolean
}

// Build model options from grouped models - favorites first, then all models
const modelOptions = computed((): ModelOption[] => {
  if (!useNewModelSystem.value || !groupedModels.value) {
    // Fallback to empty - will show placeholder
    return []
  }

  const options: ModelOption[] = []
  const addedIds = new Set<string>()

  // Helper to create option from model
  const createOption = (
    providerId: string,
    model: ModelConfig,
    flags: { isFavorite?: boolean; isRecent?: boolean } = {}
  ): ModelOption => ({
    label: model.display_name,
    value: model.id,
    provider: providerId,
    model,
    isFavorite: flags.isFavorite,
    isRecent: flags.isRecent,
  })

  // Helper to find model by reference
  const findModel = (providerId: string, modelId: string): ModelConfig | null => {
    const providerData = groupedModels.value?.providers[providerId]
    if (!providerData) return null
    return (
      providerData.chat.find((m) => m.id === modelId) ||
      providerData.embedding.find((m) => m.id === modelId) ||
      providerData.other.find((m) => m.id === modelId) ||
      null
    )
  }

  // Collect all favorites from all providers
  const favorites: Array<{ provider: string; model: ModelConfig }> = []
  for (const [providerId, categories] of Object.entries(groupedModels.value.providers)) {
    for (const model of [...categories.chat, ...categories.embedding, ...categories.other]) {
      if (model.favorited) {
        favorites.push({ provider: providerId, model })
      }
    }
  }

  // Add favorites section
  if (favorites.length > 0) {
    options.push({
      label: 'Favorites',
      value: '__header_favorites__',
      provider: '',
      model: null,
      isHeader: true,
    })
    for (const { provider, model } of favorites) {
      options.push(createOption(provider, model, { isFavorite: true }))
      addedIds.add(`${provider}/${model.id}`)
    }
  }

  // Add recent section (exclude already-added favorites)
  const recentModels: Array<{ provider: string; model: ModelConfig }> = []
  for (const ref of groupedModels.value.recent || []) {
    const key = `${ref.provider}/${ref.model_id}`
    if (!addedIds.has(key)) {
      const model = findModel(ref.provider, ref.model_id)
      if (model) {
        recentModels.push({ provider: ref.provider, model })
      }
    }
  }

  if (recentModels.length > 0) {
    options.push({
      label: 'Recent',
      value: '__header_recent__',
      provider: '',
      model: null,
      isHeader: true,
    })
    for (const { provider, model } of recentModels) {
      options.push(createOption(provider, model, { isRecent: true }))
      addedIds.add(`${provider}/${model.id}`)
    }
  }

  // Add all models section (exclude already-added)
  const allModels: Array<{ provider: string; model: ModelConfig }> = []
  for (const [providerId, categories] of Object.entries(groupedModels.value.providers)) {
    for (const model of categories.chat) {
      const key = `${providerId}/${model.id}`
      if (!addedIds.has(key)) {
        allModels.push({ provider: providerId, model })
      }
    }
  }

  if (allModels.length > 0) {
    options.push({
      label: 'All Models',
      value: '__header_all__',
      provider: '',
      model: null,
      isHeader: true,
    })
    // Sort by display name
    allModels.sort((a, b) => a.model.display_name.localeCompare(b.model.display_name))
    for (const { provider, model } of allModels) {
      options.push(createOption(provider, model))
    }
  }

  return options
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
    openrouter: 'OpenRouter',
    moonshotai: 'Kimi',
    qwen: 'Qwen',
  }
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

async function handleModelChange(model: string): Promise<void> {
  if (!model || model.startsWith('__header_')) return

  // Always save as preferred model
  setPreferredModel(model)

  // Update conversation model if in a conversation
  if (conversation.value?.metadata && model !== conversation.value.metadata.model) {
    await updateModel(model)
  }
}

async function handleRefresh(): Promise<void> {
  await Promise.all([fetchProviders(), fetchModelsGrouped()])
}

const displayLabel = computed(() => {
  // Find the model in options
  const option = modelOptions.value.find((o) => o.value === selectedModel.value && !o.isHeader)
  return option?.label || selectedModel.value
})

function handleManageModels(): void {
  emit('manage-models')
}

// Check if option is selectable (not a header)
function isOptionDisabled(option: ModelOption): boolean {
  return option.isHeader === true
}

// Fetch models on mount if not already loaded
onMounted(async () => {
  try {
    await Promise.all([fetchProviders(), fetchModelsGrouped()])
  } catch (e) {
    console.warn('Failed to load models:', e)
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
        :optionDisabled="isOptionDisabled"
        placeholder="Select Model"
        class="model-dropdown"
        :loading="isLoadingModels"
        @change="handleModelChange(selectedModel)"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="selected-model">
            <i class="pi pi-microchip" ></i>
            <span>{{ displayLabel }}</span>
          </div>
          <span v-else>{{ slotProps.placeholder }}</span>
        </template>
        <template #option="slotProps">
          <!-- Section header -->
          <div v-if="slotProps.option.isHeader" class="model-header">
            <i
              :class="[
                'pi',
                slotProps.option.value === '__header_favorites__' ? 'pi-star-fill' :
                slotProps.option.value === '__header_recent__' ? 'pi-clock' : 'pi-list'
              ]"
            ></i>
            <span>{{ slotProps.option.label }}</span>
          </div>
          <!-- Model option -->
          <div v-else class="model-option">
            <div class="model-option-main">
              <div class="model-name-row">
                <i v-if="slotProps.option.isFavorite" class="pi pi-star-fill favorite-icon" ></i>
                <span class="model-name">{{ slotProps.option.label }}</span>
              </div>
              <span class="model-provider">{{ formatProviderName(slotProps.option.provider) }}</span>
            </div>
            <div class="model-option-meta">
              <span v-if="slotProps.option.model?.capabilities?.tools" class="badge badge-tools" title="Supports tool calling">
                <i class="pi pi-wrench" ></i>
              </span>
              <span v-if="slotProps.option.model?.capabilities?.vision" class="badge badge-vision" title="Supports vision">
                <i class="pi pi-eye" ></i>
              </span>
              <span v-if="slotProps.option.model?.capabilities?.reasoning" class="badge badge-reasoning" title="Supports reasoning">
                <i class="pi pi-lightbulb" ></i>
              </span>
            </div>
          </div>
        </template>
      </Select>

      <Button
        icon="pi pi-refresh"
        severity="secondary"
        text
        rounded
        :loading="isLoadingModels"
        title="Refresh models"
        @click="handleRefresh"
      />

      <Button
        icon="pi pi-cog"
        severity="secondary"
        text
        rounded
        title="Manage models"
        @click="handleManageModels"
      />
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

/* Section headers */
.model-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  cursor: default;
}

.model-header i {
  font-size: 0.625rem;
}

/* Model options */
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

.model-name-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.favorite-icon {
  font-size: 0.625rem;
  color: var(--p-yellow-500);
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
  gap: 0.375rem;
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

.badge-reasoning {
  background: color-mix(in srgb, var(--p-purple-500) 20%, transparent);
  color: var(--p-purple-500);
}
</style>
