<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import Checkbox from 'primevue/checkbox'
import type { AdvancedViewSettings } from '@/types'
import { useConversation } from '@/composables/useConversation'

const { advancedViewSettings, updateAdvancedViewSettings } = useConversation()

const popoverRef = ref()

function toggle(event: Event) {
  popoverRef.value.toggle(event)
}

function updateSetting(key: keyof AdvancedViewSettings, value: boolean) {
  updateAdvancedViewSettings({ [key]: value })
}

defineExpose({ toggle })
</script>

<template>
  <Button
    icon="pi pi-sliders-h"
    severity="secondary"
    text
    rounded
    size="small"
    title="Display Settings"
    @click="toggle"
  />
  <Popover ref="popoverRef">
    <div class="settings-popover">
      <div class="settings-title">Display Settings</div>
      <div class="settings-list">
        <label class="setting-item">
          <Checkbox
            :modelValue="advancedViewSettings.showContextSize"
            :binary="true"
            @update:modelValue="updateSetting('showContextSize', $event as boolean)"
          />
          <span>Context size</span>
        </label>
        <label class="setting-item">
          <Checkbox
            :modelValue="advancedViewSettings.showTokenUsage"
            :binary="true"
            @update:modelValue="updateSetting('showTokenUsage', $event as boolean)"
          />
          <span>Token usage</span>
        </label>
        <label class="setting-item">
          <Checkbox
            :modelValue="advancedViewSettings.showThinkingSection"
            :binary="true"
            @update:modelValue="updateSetting('showThinkingSection', $event as boolean)"
          />
          <span>Thinking section</span>
        </label>
        <label class="setting-item">
          <Checkbox
            :modelValue="advancedViewSettings.showModelName"
            :binary="true"
            @update:modelValue="updateSetting('showModelName', $event as boolean)"
          />
          <span>Model name</span>
        </label>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.settings-popover {
  padding: 0.5rem;
  min-width: 180px;
}

.settings-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.025em;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 0.5rem;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem 0;
}

.setting-item:hover {
  color: var(--p-primary-color);
}
</style>
