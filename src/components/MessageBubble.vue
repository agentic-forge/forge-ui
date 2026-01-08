<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import Button from 'primevue/button'
import type { Message, TokenUsage } from '@/types'
import { useConversation } from '@/composables/useConversation'

const props = defineProps<{
  message: Message
  index: number
}>()

const { isAdvancedView, deleteMessagesFrom } = useConversation()

const copiedBlocks = ref<Set<number>>(new Set())

// Configure marked with syntax highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Custom renderer for code blocks
const renderer = new marked.Renderer()
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value
  return `<div class="code-block-wrapper"><pre><code class="hljs language-${language}">${highlighted}</code></pre></div>`
}

marked.use({ renderer })

const renderedContent = computed(() => {
  if (props.message.role === 'user') {
    // Escape HTML for user messages
    return DOMPurify.sanitize(props.message.content.replace(/\n/g, '<br>'))
  }

  // Render markdown for assistant messages
  const html = marked.parse(props.message.content) as string
  return DOMPurify.sanitize(html)
})

const isUser = computed(() => props.message.role === 'user')

const relativeTime = computed(() => {
  const date = new Date(props.message.timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
})

const exactTime = computed(() => {
  return new Date(props.message.timestamp).toLocaleString()
})

function formatUsage(usage: TokenUsage): string {
  return `${usage.prompt_tokens} / ${usage.completion_tokens} tokens`
}

function copyCodeBlock(index: number, code: string): void {
  navigator.clipboard.writeText(code)
  copiedBlocks.value.add(index)
  setTimeout(() => {
    copiedBlocks.value.delete(index)
  }, 2000)
}

function handleContentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement

  // Check if click is on a copy button
  if (target.classList.contains('code-copy-button')) {
    const wrapper = target.closest('.code-block-wrapper')
    if (wrapper) {
      const code = wrapper.querySelector('code')?.textContent || ''
      const index = Array.from(
        document.querySelectorAll('.code-block-wrapper')
      ).indexOf(wrapper as Element)
      copyCodeBlock(index, code)
    }
  }
}

function handleDelete(): void {
  if (confirm('Delete this message and all following messages?')) {
    deleteMessagesFrom(props.index)
  }
}
</script>

<template>
  <div
    class="message-bubble"
    :class="{ 'user-message': isUser, 'assistant-message': !isUser }"
  >
    <div class="message-header">
      <span class="message-role">{{ isUser ? 'You' : 'Assistant' }}</span>
      <span class="message-time" :title="exactTime">{{ relativeTime }}</span>
    </div>

    <div
      class="message-content"
      @click="handleContentClick"
      v-html="renderedContent"
    />

    <div v-if="isAdvancedView && !isUser" class="message-footer">
      <span v-if="message.model" class="message-model text-xs text-muted">
        {{ message.model }}
      </span>
      <span v-if="message.usage" class="message-usage text-xs text-muted">
        {{ formatUsage(message.usage) }}
      </span>
    </div>

    <div v-if="message.status === 'error'" class="message-error">
      <span class="error-text">Error occurred</span>
      <Button
        label="Retry"
        icon="pi pi-refresh"
        size="small"
        severity="secondary"
        text
      />
    </div>

    <div class="message-actions">
      <Button
        v-if="isAdvancedView"
        icon="pi pi-trash"
        size="small"
        severity="secondary"
        text
        rounded
        title="Delete from here"
        @click="handleDelete"
      />
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  position: relative;
  max-width: 80%;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.user-message {
  align-self: flex-end;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-bottom-right-radius: 4px;
}

.assistant-message {
  align-self: flex-start;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-bottom-left-radius: 4px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.8;
}

.message-role {
  font-weight: 600;
}

.message-content {
  line-height: 1.6;
}

.message-footer {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--p-content-border-color);
}

.message-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--p-red-100);
  border-radius: 6px;
  color: var(--p-red-600);
}

.message-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

/* Code block styles in message content */
:deep(.code-block-wrapper) {
  position: relative;
  margin: 0.75rem 0;
}

:deep(.code-block-wrapper pre) {
  background: var(--p-surface-900);
  color: var(--p-surface-100);
  border-radius: 8px;
  padding: 1rem;
  padding-right: 3rem;
  overflow-x: auto;
  margin: 0;
}

:deep(.code-block-wrapper::after) {
  content: 'Copy';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--p-surface-700);
  border: none;
  border-radius: 4px;
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  color: var(--p-surface-200);
  font-size: 0.75rem;
  opacity: 0.8;
  transition: opacity 0.2s;
}

:deep(.code-block-wrapper:hover::after) {
  opacity: 1;
}

/* Highlight.js theme */
:deep(.hljs) {
  background: transparent;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-literal),
:deep(.hljs-section),
:deep(.hljs-link) {
  color: #569cd6;
}

:deep(.hljs-string),
:deep(.hljs-title),
:deep(.hljs-name),
:deep(.hljs-type),
:deep(.hljs-attribute),
:deep(.hljs-symbol),
:deep(.hljs-bullet),
:deep(.hljs-built_in),
:deep(.hljs-addition),
:deep(.hljs-variable),
:deep(.hljs-template-tag),
:deep(.hljs-template-variable) {
  color: #ce9178;
}

:deep(.hljs-comment),
:deep(.hljs-quote),
:deep(.hljs-deletion),
:deep(.hljs-meta) {
  color: #6a9955;
}

:deep(.hljs-number) {
  color: #b5cea8;
}
</style>
