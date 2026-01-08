<script setup lang="ts">
import { computed } from 'vue'
import Toast from 'primevue/toast'
import HeaderBar from './components/HeaderBar.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import ChatView from './views/ChatView.vue'
import DebugPanel from './components/DebugPanel.vue'
import { useConversation } from './composables/useConversation'
import { useTheme } from './composables/useTheme'

// Initialize theme (applies class to <html> element)
useTheme()
const { conversation, isAdvancedView, showDebugPanel, debugEvents } = useConversation()

const hasConversation = computed(() => conversation.value !== null)
</script>

<template>
  <div class="app-container">
    <Toast position="top-right" />
    <HeaderBar />
    <main class="main-content">
      <WelcomeScreen v-if="!hasConversation" />
      <ChatView v-else />
    </main>
    <DebugPanel
      v-if="isAdvancedView && showDebugPanel"
      :events="debugEvents"
    />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
