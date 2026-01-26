<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useConversation } from '@/composables/useConversation'
import { useKeys, PROVIDER_INFO, type LLMProvider } from '@/composables/useKeys'
import type { ModelConfig, ModelSuggestion, ModelCapabilities } from '@/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const toast = useToast()

const {
  providers,
  groupedModels,
  isLoadingModels,
  fetchProviders,
  fetchModelsGrouped,
  addModelToProvider,
  removeModelFromProvider,
  toggleModelFavorite,
  fetchModelsFromProvider,
  getProviderSuggestions,
} = useConversation()

// BYOK state
const {
  llmKey,
  llmProvider,
  persistKeys,
  serverProviders,
  allowByok,
  isUsingByok,
  setLlmKey,
  setLlmProvider,
  setPersistence,
  serverHasKey,
} = useKeys()

// Local state
const selectedProviderId = ref<string | null>(null)
const showAddModelDialog = ref(false)
const suggestions = ref<ModelSuggestion[]>([])
const isLoadingSuggestions = ref(false)

// Add model form state
const newModelId = ref('')
const newModelDisplayName = ref('')
const newModelCapabilities = ref<ModelCapabilities>({
  tools: true,
  vision: false,
  reasoning: false,
})

// BYOK local state
const localApiKey = ref('')
const showApiKey = ref(false)

// BYOK providers that support user keys
const BYOK_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'google']

// Check if current provider supports BYOK
const isByokProvider = computed(() => {
  return selectedProviderId.value ? BYOK_PROVIDERS.includes(selectedProviderId.value) : false
})

// Get BYOK provider info for current provider
const currentByokInfo = computed(() => {
  if (!selectedProviderId.value || !isByokProvider.value) return null
  return PROVIDER_INFO[selectedProviderId.value as LLMProvider]
})

// Check if current provider has a server key
const currentProviderHasServerKey = computed(() => {
  if (!selectedProviderId.value) return false
  return serverHasKey(selectedProviderId.value as LLMProvider)
})

// Check if user has set their own key for current provider
const userHasKeyForProvider = computed(() => {
  if (!selectedProviderId.value) return false
  return llmProvider.value === selectedProviderId.value && !!llmKey.value
})

// Check if user has a BYOK key for a specific provider (for sidebar icons)
function userHasKeyFor(providerId: string): boolean {
  return llmProvider.value === providerId && !!llmKey.value
}

// Check if a provider is ready to use (has server key OR user BYOK key)
function isProviderReady(provider: { id: string; configured: boolean }): boolean {
  return provider.configured || userHasKeyFor(provider.id)
}

// Initialize data when modal opens
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      await loadData()
    }
  }
)

// Sync localApiKey when provider changes or modal opens
watch(
  [selectedProviderId, () => props.visible],
  ([providerId, visible]) => {
    if (visible && providerId && BYOK_PROVIDERS.includes(providerId)) {
      // Show existing key if this is the active BYOK provider
      if (llmProvider.value === providerId && llmKey.value) {
        localApiKey.value = llmKey.value
      } else {
        localApiKey.value = ''
      }
    }
  }
)

// BYOK handlers
function applyApiKey(): void {
  if (!selectedProviderId.value || !localApiKey.value) return
  setLlmKey(localApiKey.value, selectedProviderId.value as LLMProvider)
  toast.add({
    severity: 'success',
    summary: 'API Key Set',
    detail: `Using your ${formatProviderName(selectedProviderId.value)} API key`,
    life: 3000,
  })
}

function clearApiKey(): void {
  localApiKey.value = ''
  if (selectedProviderId.value === llmProvider.value) {
    setLlmKey('', llmProvider.value)
    toast.add({
      severity: 'info',
      summary: 'API Key Cleared',
      detail: 'Reverted to server key (if available)',
      life: 3000,
    })
  }
}

function handlePersistChange(enabled: boolean): void {
  setPersistence(enabled)
  toast.add({
    severity: enabled ? 'success' : 'info',
    summary: enabled ? 'Key Saved' : 'Key Not Saved',
    detail: enabled ? 'Your key will be remembered in this browser' : 'Key will be cleared when you close the browser',
    life: 3000,
  })
}

async function loadData(): Promise<void> {
  try {
    await Promise.all([fetchProviders(), fetchModelsGrouped()])
    // Select first configured provider by default
    if (!selectedProviderId.value && providers.value.length > 0) {
      const configured = providers.value.find((p) => p.configured)
      selectedProviderId.value = configured?.id || providers.value[0].id
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load model data',
      life: 3000,
    })
  }
}

// Current provider and its models
const currentProvider = computed(() => {
  if (!selectedProviderId.value) return null
  return providers.value.find((p) => p.id === selectedProviderId.value) || null
})

const currentModels = computed(() => {
  if (!selectedProviderId.value || !groupedModels.value) return { chat: [], embedding: [], other: [] }
  return groupedModels.value.providers[selectedProviderId.value] || { chat: [], embedding: [], other: [] }
})

// Check if viewing favorites pseudo-provider
const isViewingFavorites = computed(() => selectedProviderId.value === '__favorites__')

// Get all favorite models across providers
const allFavorites = computed(() => {
  if (!groupedModels.value) return []
  const favorites: Array<{ provider: string; model: ModelConfig }> = []
  for (const [providerId, categories] of Object.entries(groupedModels.value.providers)) {
    for (const model of [...categories.chat, ...categories.embedding, ...categories.other]) {
      if (model.favorited) {
        favorites.push({ provider: providerId, model })
      }
    }
  }
  return favorites
})

function formatProviderName(providerId: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    openrouter: 'OpenRouter',
  }
  return names[providerId] || providerId.charAt(0).toUpperCase() + providerId.slice(1)
}

function selectProvider(providerId: string): void {
  selectedProviderId.value = providerId
}

async function handleFetchModels(): Promise<void> {
  if (!currentProvider.value || !currentProvider.value.has_api) return

  try {
    const result = await fetchModelsFromProvider(currentProvider.value.id)
    toast.add({
      severity: 'success',
      summary: 'Models Updated',
      detail: `Added ${result.models_added}, updated ${result.models_updated} models`,
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error instanceof Error ? error.message : 'Failed to fetch models',
      life: 5000,
    })
  }
}

async function handleToggleFavorite(providerId: string, modelId: string): Promise<void> {
  try {
    await toggleModelFavorite(providerId, modelId)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to update favorite',
      life: 3000,
    })
  }
}

async function handleDeleteModel(providerId: string, modelId: string): Promise<void> {
  try {
    await removeModelFromProvider(providerId, modelId)
    toast.add({
      severity: 'info',
      summary: 'Model Removed',
      detail: `Removed ${modelId}`,
      life: 2000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to remove model',
      life: 3000,
    })
  }
}

async function openAddModelDialog(): Promise<void> {
  if (!currentProvider.value) return

  // Reset form
  newModelId.value = ''
  newModelDisplayName.value = ''
  newModelCapabilities.value = { tools: true, vision: false, reasoning: false }

  // Load suggestions
  isLoadingSuggestions.value = true
  try {
    suggestions.value = await getProviderSuggestions(currentProvider.value.id)
  } catch {
    suggestions.value = []
  } finally {
    isLoadingSuggestions.value = false
  }

  showAddModelDialog.value = true
}

function selectSuggestion(suggestion: ModelSuggestion): void {
  newModelId.value = suggestion.id
  newModelDisplayName.value = suggestion.display_name
}

async function handleAddModel(): Promise<void> {
  if (!currentProvider.value || !newModelId.value) return

  try {
    await addModelToProvider(
      currentProvider.value.id,
      newModelId.value,
      newModelDisplayName.value || undefined,
      newModelCapabilities.value
    )
    toast.add({
      severity: 'success',
      summary: 'Model Added',
      detail: `Added ${newModelDisplayName.value || newModelId.value}`,
      life: 2000,
    })
    showAddModelDialog.value = false
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to add model',
      life: 3000,
    })
  }
}

function closeModal(): void {
  emit('update:visible', false)
}

onMounted(() => {
  if (props.visible) {
    loadData()
  }
})
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Model Management"
    :style="{ width: '900px', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="modal-content">
      <!-- Provider Sidebar -->
      <div class="provider-sidebar">
        <div class="sidebar-header">Providers</div>

        <!-- Favorites pseudo-provider -->
        <div
          class="provider-item"
          :class="{ active: isViewingFavorites }"
          @click="selectProvider('__favorites__')"
        >
          <i class="pi pi-star-fill provider-icon favorites" ></i>
          <span class="provider-name">Favorites</span>
          <span class="provider-count">{{ allFavorites.length }}</span>
        </div>

        <div class="sidebar-divider" ></div>

        <!-- Real providers -->
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="provider-item"
          :class="{
            active: selectedProviderId === provider.id,
            disabled: !provider.configured && !allowByok,
          }"
          @click="(provider.configured || allowByok) && selectProvider(provider.id)"
        >
          <i
            class="provider-icon"
            :class="[
              isProviderReady(provider) ? 'pi pi-circle-fill configured' : 'pi pi-circle unconfigured',
            ]"
          ></i>
          <span class="provider-name">{{ formatProviderName(provider.id) }}</span>
          <span class="provider-count">{{ provider.model_count }}</span>
        </div>
      </div>

      <!-- Models Panel -->
      <div class="models-panel">
        <!-- Favorites view -->
        <template v-if="isViewingFavorites">
          <div class="panel-header">
            <h3>Favorite Models</h3>
          </div>

          <div v-if="allFavorites.length === 0" class="empty-state">
            <i class="pi pi-star" ></i>
            <p>No favorite models yet</p>
            <p class="hint">Click the star icon on any model to add it to favorites</p>
          </div>

          <div v-else class="models-list">
            <div
              v-for="{ provider, model } in allFavorites"
              :key="`${provider}-${model.id}`"
              class="model-item"
            >
              <div class="model-info">
                <div class="model-name">{{ model.display_name }}</div>
                <div class="model-meta">
                  <span class="model-provider">{{ formatProviderName(provider) }}</span>
                  <span class="model-id">{{ model.id }}</span>
                </div>
              </div>
              <div class="model-badges">
                <span v-if="model.capabilities.tools" class="badge badge-tools" title="Tools">
                  <i class="pi pi-wrench" ></i>
                </span>
                <span v-if="model.capabilities.vision" class="badge badge-vision" title="Vision">
                  <i class="pi pi-eye" ></i>
                </span>
                <span v-if="model.capabilities.reasoning" class="badge badge-reasoning" title="Reasoning">
                  <i class="pi pi-lightbulb" ></i>
                </span>
              </div>
              <div class="model-actions">
                <Button
                  icon="pi pi-star-fill"
                  severity="warning"
                  text
                  rounded
                  size="small"
                  title="Remove from favorites"
                  @click="handleToggleFavorite(provider, model.id)"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- Provider view -->
        <template v-else-if="currentProvider">
          <div class="panel-header">
            <h3>{{ formatProviderName(currentProvider.id) }} Models</h3>
            <div class="header-actions">
              <Button
                v-if="currentProvider.has_api"
                icon="pi pi-refresh"
                label="Fetch"
                severity="secondary"
                size="small"
                :loading="isLoadingModels"
                @click="handleFetchModels"
              />
              <Button
                icon="pi pi-plus"
                label="Add Model"
                size="small"
                @click="openAddModelDialog"
              />
            </div>
          </div>

          <!-- BYOK Section -->
          <div v-if="isByokProvider && allowByok" class="byok-section">
            <div class="byok-header">
              <span class="byok-title">API Key</span>
              <div class="byok-status">
                <Tag
                  v-if="userHasKeyForProvider"
                  severity="success"
                  icon="pi pi-check"
                  value="Your key"
                />
                <Tag
                  v-else-if="currentProviderHasServerKey"
                  severity="info"
                  icon="pi pi-server"
                  value="Server key"
                />
                <Tag
                  v-else
                  severity="warn"
                  icon="pi pi-exclamation-triangle"
                  value="No key"
                />
              </div>
            </div>

            <div class="byok-content">
              <div class="key-input-row">
                <InputText
                  v-model="localApiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  :placeholder="currentByokInfo?.placeholder || 'Enter API key...'"
                  class="key-input"
                />
                <Button
                  :icon="showApiKey ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  severity="secondary"
                  text
                  @click="showApiKey = !showApiKey"
                  title="Toggle visibility"
                />
                <Button
                  v-if="localApiKey"
                  icon="pi pi-check"
                  severity="success"
                  :disabled="localApiKey === llmKey && llmProvider === selectedProviderId"
                  @click="applyApiKey"
                  title="Apply key"
                />
                <Button
                  v-if="userHasKeyForProvider"
                  icon="pi pi-times"
                  severity="danger"
                  text
                  @click="clearApiKey"
                  title="Clear key"
                />
              </div>

              <div class="byok-footer">
                <a
                  v-if="currentByokInfo"
                  :href="currentByokInfo.keyUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="get-key-link"
                >
                  Get {{ currentByokInfo.label }} API key
                  <i class="pi pi-external-link"></i>
                </a>

                <label v-if="localApiKey || userHasKeyForProvider" class="persist-checkbox">
                  <Checkbox
                    :modelValue="persistKeys"
                    :binary="true"
                    @update:modelValue="handlePersistChange"
                  />
                  <span>Remember key</span>
                </label>
              </div>

              <Message v-if="persistKeys && userHasKeyForProvider" severity="info" :closable="false" class="persist-note">
                <i class="pi pi-lock"></i>
                Key saved in browser only, never sent to our servers for storage.
              </Message>
            </div>
          </div>

          <!-- Not configured message (only show if no server key AND no user key) -->
          <div v-if="!currentProvider.configured && !userHasKeyForProvider" class="empty-state">
            <i class="pi pi-key" ></i>
            <p>Provider not configured</p>
            <p v-if="allowByok" class="hint">Enter your API key above, or add {{ currentProvider.id.toUpperCase() }}_API_KEY to server .env</p>
            <p v-else class="hint">Add {{ currentProvider.id.toUpperCase() }}_API_KEY to your .env file</p>
          </div>

          <!-- Models list -->
          <template v-else>
            <!-- Chat models -->
            <div v-if="currentModels.chat.length > 0" class="category-section">
              <div class="category-header">Chat Models</div>
              <div class="models-list">
                <div
                  v-for="model in currentModels.chat"
                  :key="model.id"
                  class="model-item"
                >
                  <div class="model-info">
                    <div class="model-name">{{ model.display_name }}</div>
                    <div class="model-meta">
                      <span class="model-id">{{ model.id }}</span>
                      <span class="model-source" :class="model.source">{{ model.source }}</span>
                    </div>
                  </div>
                  <div class="model-badges">
                    <span v-if="model.capabilities.tools" class="badge badge-tools" title="Tools">
                      <i class="pi pi-wrench" ></i>
                    </span>
                    <span v-if="model.capabilities.vision" class="badge badge-vision" title="Vision">
                      <i class="pi pi-eye" ></i>
                    </span>
                    <span v-if="model.capabilities.reasoning" class="badge badge-reasoning" title="Reasoning">
                      <i class="pi pi-lightbulb" ></i>
                    </span>
                  </div>
                  <div class="model-actions">
                    <Button
                      :icon="model.favorited ? 'pi pi-star-fill' : 'pi pi-star'"
                      :severity="model.favorited ? 'warning' : 'secondary'"
                      text
                      rounded
                      size="small"
                      :title="model.favorited ? 'Remove from favorites' : 'Add to favorites'"
                      @click="handleToggleFavorite(currentProvider.id, model.id)"
                    />
                    <Button
                      v-if="model.source === 'manual'"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      title="Remove model"
                      @click="handleDeleteModel(currentProvider.id, model.id)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Embedding models -->
            <div v-if="currentModels.embedding.length > 0" class="category-section">
              <div class="category-header">Embedding Models</div>
              <div class="models-list">
                <div
                  v-for="model in currentModels.embedding"
                  :key="model.id"
                  class="model-item"
                >
                  <div class="model-info">
                    <div class="model-name">{{ model.display_name }}</div>
                    <div class="model-meta">
                      <span class="model-id">{{ model.id }}</span>
                    </div>
                  </div>
                  <div class="model-actions">
                    <Button
                      v-if="model.source === 'manual'"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      @click="handleDeleteModel(currentProvider.id, model.id)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div
              v-if="currentModels.chat.length === 0 && currentModels.embedding.length === 0"
              class="empty-state"
            >
              <i class="pi pi-box" ></i>
              <p>No models configured</p>
              <p class="hint">
                <template v-if="currentProvider.has_api">
                  Click "Fetch" to load models from {{ formatProviderName(currentProvider.id) }}
                </template>
                <template v-else>
                  Click "Add Model" to manually add models
                </template>
              </p>
            </div>
          </template>
        </template>
      </div>
    </div>

    <template #footer>
      <Button label="Close" severity="secondary" @click="closeModal" />
    </template>
  </Dialog>

  <!-- Add Model Dialog -->
  <Dialog
    v-model:visible="showAddModelDialog"
    modal
    :header="`Add Model to ${currentProvider ? formatProviderName(currentProvider.id) : ''}`"
    :style="{ width: '500px' }"
  >
    <div class="add-model-content">
      <!-- Suggestions -->
      <div v-if="suggestions.length > 0" class="suggestions-section">
        <label>Suggestions</label>
        <div class="suggestions-chips">
          <Button
            v-for="suggestion in suggestions"
            :key="suggestion.id"
            :label="suggestion.display_name"
            :severity="suggestion.recommended ? 'primary' : 'secondary'"
            size="small"
            outlined
            @click="selectSuggestion(suggestion)"
          />
        </div>
      </div>

      <!-- Model ID input -->
      <div class="form-field">
        <label for="model-id">Model ID *</label>
        <InputText
          id="model-id"
          v-model="newModelId"
          placeholder="e.g., claude-sonnet-4-20250514"
          class="w-full"
        />
      </div>

      <!-- Display name input -->
      <div class="form-field">
        <label for="display-name">Display Name (optional)</label>
        <InputText
          id="display-name"
          v-model="newModelDisplayName"
          placeholder="e.g., Claude Sonnet 4"
          class="w-full"
        />
      </div>

      <!-- Capabilities -->
      <div class="form-field">
        <label>Capabilities</label>
        <div class="capabilities-checkboxes">
          <label class="checkbox-label">
            <Checkbox v-model="newModelCapabilities.tools" :binary="true" />
            <i class="pi pi-wrench" ></i>
            <span>Tool calling</span>
          </label>
          <label class="checkbox-label">
            <Checkbox v-model="newModelCapabilities.vision" :binary="true" />
            <i class="pi pi-eye" ></i>
            <span>Vision</span>
          </label>
          <label class="checkbox-label">
            <Checkbox v-model="newModelCapabilities.reasoning" :binary="true" />
            <i class="pi pi-lightbulb" ></i>
            <span>Reasoning</span>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showAddModelDialog = false" />
      <Button label="Add Model" :disabled="!newModelId" @click="handleAddModel" />
    </template>
  </Dialog>
</template>

<style scoped>
.modal-content {
  display: flex;
  gap: 1rem;
  min-height: 400px;
}

/* Provider Sidebar */
.provider-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--p-content-border-color);
  padding-right: 1rem;
}

.sidebar-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
  padding: 0 0.5rem;
}

.sidebar-divider {
  height: 1px;
  background: var(--p-content-border-color);
  margin: 0.5rem 0;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--p-border-radius);
  cursor: pointer;
  transition: background-color 0.15s;
}

.provider-item:hover:not(.disabled) {
  background: var(--p-surface-hover);
}

.provider-item.active {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.provider-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.provider-icon {
  font-size: 0.625rem;
}

.provider-icon.configured {
  color: var(--p-green-500);
}

.provider-icon.unconfigured {
  color: var(--p-gray-400);
}

.provider-icon.favorites {
  color: var(--p-yellow-500);
  font-size: 0.875rem;
}

.provider-name {
  flex: 1;
  font-size: 0.875rem;
}

.provider-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
}

/* Models Panel */
.models-panel {
  flex: 1;
  min-width: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.category-section {
  margin-bottom: 1.5rem;
}

.category-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.model-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--p-border-radius);
  background: var(--p-surface-ground);
}

.model-item:hover {
  background: var(--p-surface-hover);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.model-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.model-id {
  font-family: monospace;
}

.model-source {
  padding: 0.0625rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  text-transform: uppercase;
}

.model-source.api {
  background: color-mix(in srgb, var(--p-blue-500) 20%, transparent);
  color: var(--p-blue-500);
}

.model-source.manual {
  background: color-mix(in srgb, var(--p-gray-500) 20%, transparent);
  color: var(--p-text-muted-color);
}

.model-provider {
  font-weight: 500;
}

.model-badges {
  display: flex;
  gap: 0.25rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
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
  background: color-mix(in srgb, var(--p-orange-500) 20%, transparent);
  color: var(--p-orange-500);
}

.model-actions {
  display: flex;
  gap: 0.25rem;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Add Model Dialog */
.add-model-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestions-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.suggestions-section label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-muted-color);
}

.suggestions-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
}

.capabilities-checkboxes {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label i {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.w-full {
  width: 100%;
}

/* BYOK Section */
.byok-section {
  background: var(--p-surface-ground);
  border-radius: var(--p-border-radius);
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.byok-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.byok-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.byok-status {
  display: flex;
  gap: 0.25rem;
}

.byok-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.key-input-row {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.key-input {
  flex: 1;
  font-family: monospace;
  font-size: 0.875rem;
}

.byok-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.get-key-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--p-primary-color);
  text-decoration: none;
}

.get-key-link:hover {
  text-decoration: underline;
}

.persist-checkbox {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.persist-note {
  margin: 0;
  font-size: 0.75rem;
}

.persist-note :deep(.p-message-text) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
