<script setup lang="ts">
import { computed } from 'vue'

import type { AdminAlert } from '../../../types/admin-alert'

const props = defineProps<{
  alert: AdminAlert
}>()

defineEmits<{
  close: []
  action: []
}>()

const iconMap = {
  success: 'mdi-check-circle-outline',
  info: 'mdi-information-outline',
  warning: 'mdi-alert-outline',
  error: 'mdi-alert-circle-outline',
} as const

const ariaRole = computed(() =>
  props.alert.type === 'warning' || props.alert.type === 'error' ? 'alert' : 'status',
)

const ariaLive = computed(() =>
  props.alert.type === 'warning' || props.alert.type === 'error' ? 'assertive' : 'polite',
)

const alertIcon = computed(() => iconMap[props.alert.type])
</script>

<template>
  <article
    class="admin-alert-item"
    :class="`admin-alert-item--${alert.type}`"
    :role="ariaRole"
    :aria-live="ariaLive"
    aria-atomic="true"
  >
    <div class="admin-alert-item__indicator" aria-hidden="true">
      <v-icon :icon="alertIcon" size="20" />
    </div>

    <div class="admin-alert-item__body">
      <div v-if="alert.title" class="admin-alert-item__title">
        {{ alert.title }}
      </div>
      <div class="admin-alert-item__message">
        {{ alert.message }}
      </div>

      <button
        v-if="alert.action && alert.actionLabel"
        type="button"
        class="admin-alert-item__action"
        @click="$emit('action')"
      >
        {{ alert.actionLabel }}
      </button>
    </div>

    <button
      v-if="alert.dismissible !== false"
      type="button"
      class="admin-alert-item__close"
      aria-label="Hinweis schließen"
      @click="$emit('close')"
    >
      <v-icon icon="mdi-close" size="18" />
    </button>
  </article>
</template>

<style scoped>
.admin-alert-item {
  --admin-alert-accent: rgba(125, 209, 191, 0.96);
  --admin-alert-accent-soft: rgba(125, 209, 191, 0.16);
  --admin-alert-border: rgba(125, 209, 191, 0.28);
  --admin-alert-surface:
    radial-gradient(circle at top left, rgba(125, 209, 191, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(14, 24, 35, 0.96), rgba(9, 17, 27, 0.96));
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.9rem;
  width: min(100%, 40rem);
  padding: 0.95rem 1rem 0.95rem 0.9rem;
  border-radius: 22px;
  border: 1px solid var(--admin-alert-border);
  background: var(--admin-alert-surface);
  color: rgba(242, 247, 252, 0.96);
  box-shadow:
    0 18px 42px rgba(1, 6, 13, 0.36),
    0 6px 18px rgba(1, 6, 13, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px) saturate(1.08);
  pointer-events: auto;
  overflow: hidden;
}

.admin-alert-item::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 38%);
  pointer-events: none;
}

.admin-alert-item--success {
  --admin-alert-accent: rgba(98, 212, 168, 0.96);
  --admin-alert-accent-soft: rgba(98, 212, 168, 0.16);
  --admin-alert-border: rgba(98, 212, 168, 0.24);
  --admin-alert-surface:
    radial-gradient(circle at top left, rgba(98, 212, 168, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(13, 25, 28, 0.96), rgba(8, 18, 21, 0.96));
}

.admin-alert-item--info {
  --admin-alert-accent: rgba(97, 191, 234, 0.96);
  --admin-alert-accent-soft: rgba(97, 191, 234, 0.16);
  --admin-alert-border: rgba(97, 191, 234, 0.24);
  --admin-alert-surface:
    radial-gradient(circle at top left, rgba(97, 191, 234, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(12, 22, 34, 0.96), rgba(8, 16, 27, 0.96));
}

.admin-alert-item--warning {
  --admin-alert-accent: rgba(234, 182, 92, 0.96);
  --admin-alert-accent-soft: rgba(234, 182, 92, 0.18);
  --admin-alert-border: rgba(234, 182, 92, 0.26);
  --admin-alert-surface:
    radial-gradient(circle at top left, rgba(234, 182, 92, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(31, 24, 15, 0.96), rgba(21, 16, 10, 0.96));
}

.admin-alert-item--error {
  --admin-alert-accent: rgba(230, 112, 112, 0.96);
  --admin-alert-accent-soft: rgba(230, 112, 112, 0.16);
  --admin-alert-border: rgba(230, 112, 112, 0.24);
  --admin-alert-surface:
    radial-gradient(circle at top left, rgba(230, 112, 112, 0.14), transparent 42%),
    linear-gradient(180deg, rgba(31, 20, 24, 0.96), rgba(22, 12, 16, 0.96));
}

.admin-alert-item__indicator {
  position: relative;
  z-index: 1;
  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.5rem;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: var(--admin-alert-accent);
  background: var(--admin-alert-accent-soft);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 10px 22px rgba(0, 0, 0, 0.14);
}

.admin-alert-item__body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  padding-top: 0.12rem;
}

.admin-alert-item__title {
  color: rgba(247, 250, 255, 0.98);
  font-size: 0.95rem;
  font-weight: 760;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.admin-alert-item__message {
  color: rgba(221, 231, 241, 0.88);
  font-size: 0.92rem;
  line-height: 1.45;
  word-break: break-word;
}

.admin-alert-item__action {
  appearance: none;
  width: fit-content;
  min-height: 2.35rem;
  margin-top: 0.1rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(248, 250, 253, 0.96);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 140ms ease;
}

.admin-alert-item__action:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.admin-alert-item__action:active {
  transform: scale(0.988);
}

.admin-alert-item__close {
  position: relative;
  z-index: 1;
  width: 2.5rem;
  min-width: 2.5rem;
  height: 2.5rem;
  margin: -0.18rem -0.18rem 0 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: transparent;
  color: rgba(203, 216, 228, 0.72);
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 140ms ease;
}

.admin-alert-item__close:hover {
  color: rgba(246, 249, 253, 0.94);
  background: rgba(255, 255, 255, 0.06);
}

.admin-alert-item__close:active {
  transform: scale(0.97);
}

@media (max-width: 760px) {
  .admin-alert-item {
    width: 100%;
    gap: 0.8rem;
    padding: 0.88rem 0.82rem 0.88rem 0.82rem;
    border-radius: 20px;
  }

  .admin-alert-item__indicator,
  .admin-alert-item__close {
    width: 2.35rem;
    min-width: 2.35rem;
    height: 2.35rem;
  }

  .admin-alert-item__title {
    font-size: 0.92rem;
  }

  .admin-alert-item__message {
    font-size: 0.89rem;
  }

  .admin-alert-item__action {
    min-height: 2.5rem;
  }
}
</style>
