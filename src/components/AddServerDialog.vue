<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useServers } from '@/composables/useServers'
import type { MCPServerConfig, MCPValidateResponse } from '@/types/servers'

const props = defineProps<{
  visible: boolean
  editServer?: MCPServerConfig | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'server-saved': [server: MCPServerConfig]
}>()

const { addServer, updateServer, validateServer } = useServers()

// Form state
const name = ref('')
const url = ref('')
const apiKey = ref('')

// Validation state
const isValidating = ref(false)
const validationResult = ref<MCPValidateResponse | null>(null)
const validationError = ref('')
const hasValidated = ref(false)

// Computed
const isEditing = computed(() => !!props.editServer)
const dialogTitle = computed(() => (isEditing.value ? 'Edit MCP Server' : 'Add MCP Server'))

const canSave = computed(() => {
  return name.value.trim() && url.value.trim() && hasValidated.value && validationResult.value?.valid
})

// Watch for edit mode changes
watch(
  () => props.editServer,
  (server) => {
    if (server) {
      name.value = server.name
      url.value = server.url
      apiKey.value = server.apiKey || ''
      // Reset validation when editing
      hasValidated.value = false
      validationResult.value = null
      validationError.value = ''
    }
  },
  { immediate: true }
)

// Reset form when dialog closes
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetForm()
    }
  }
)

function resetForm() {
  name.value = ''
  url.value = ''
  apiKey.value = ''
  hasValidated.value = false
  validationResult.value = null
  validationError.value = ''
}

async function handleTest() {
  if (!url.value.trim()) {
    validationError.value = 'URL is required'
    return
  }

  isValidating.value = true
  validationError.value = ''
  validationResult.value = null

  try {
    const result = await validateServer(url.value.trim(), apiKey.value || undefined)
    validationResult.value = result
    hasValidated.value = true

    if (!result.valid) {
      validationError.value = result.error || 'Unknown error'
    }
  } catch (e) {
    validationError.value = e instanceof Error ? e.message : 'Connection failed'
    hasValidated.value = true
  } finally {
    isValidating.value = false
  }
}

function handleSave() {
  if (!canSave.value) return

  const serverData = {
    name: name.value.trim(),
    url: url.value.trim(),
    apiKey: apiKey.value || undefined,
    enabled: true,
    status: 'connected' as const,
    toolCount: validationResult.value?.tool_count || 0,
    tools: validationResult.value?.tools || [],
  }

  if (isEditing.value && props.editServer) {
    updateServer(props.editServer.id, serverData)
    emit('server-saved', { ...props.editServer, ...serverData })
  } else {
    const newServer = addServer(serverData)
    emit('server-saved', newServer)
  }

  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    modal
    :closable="true"
    :style="{ width: '450px' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="add-server-form">
      <!-- Server Name -->
      <div class="form-field">
        <label for="server-name">Name</label>
        <InputText
          id="server-name"
          v-model="name"
          placeholder="My MCP Server"
          class="w-full"
        />
        <small class="field-hint">Used as prefix in tool names (e.g., @myserver/tool_name)</small>
      </div>

      <!-- Server URL -->
      <div class="form-field">
        <label for="server-url">URL</label>
        <InputText
          id="server-url"
          v-model="url"
          placeholder="https://example.com/mcp"
          class="w-full"
        />
        <small class="field-hint">MCP server endpoint URL</small>
      </div>

      <!-- API Key (Optional) -->
      <div class="form-field">
        <label for="server-apikey">API Key (Optional)</label>
        <Password
          id="server-apikey"
          v-model="apiKey"
          placeholder="Optional API key"
          class="w-full"
          :feedback="false"
          toggleMask
          inputClass="w-full"
        />
        <small class="field-hint">Leave empty if the server doesn't require authentication</small>
      </div>

      <!-- Test Connection -->
      <div class="test-section">
        <Button
          label="Test Connection"
          icon="pi pi-bolt"
          :loading="isValidating"
          :disabled="!url.trim()"
          severity="secondary"
          @click="handleTest"
        />

        <!-- Validation Result -->
        <div v-if="hasValidated" class="validation-result">
          <Message v-if="validationResult?.valid" severity="success" :closable="false">
            Connected! Found {{ validationResult.tool_count }} tool(s)
          </Message>
          <Message v-else severity="error" :closable="false">
            {{ validationError || 'Connection failed' }}
          </Message>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="handleCancel" />
      <Button
        :label="isEditing ? 'Save Changes' : 'Add Server'"
        icon="pi pi-check"
        :disabled="!canSave"
        @click="handleSave"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.add-server-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.field-hint {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}

.test-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--p-content-border-color);
}

.validation-result {
  margin-top: 0.25rem;
}

:deep(.p-password) {
  width: 100%;
}

:deep(.p-password input) {
  width: 100%;
}
</style>
