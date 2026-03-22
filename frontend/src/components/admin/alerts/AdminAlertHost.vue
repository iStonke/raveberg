<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import AdminAlertItem from './AdminAlertItem.vue'
import { useAdminAlert } from '../../../stores/adminAlert'

const adminAlert = useAdminAlert()
const { activeAlert } = storeToRefs(adminAlert)

const supportsHoverPause = computed(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
})

function handlePause() {
  if (!supportsHoverPause.value || !activeAlert.value) {
    return
  }

  adminAlert.pause(activeAlert.value.id)
}

function handleResume() {
  if (!supportsHoverPause.value || !activeAlert.value) {
    return
  }

  adminAlert.resume(activeAlert.value.id)
}

function handleClose() {
  if (!activeAlert.value) {
    return
  }

  adminAlert.dismiss(activeAlert.value.id)
}

async function handleAction() {
  if (!activeAlert.value) {
    return
  }

  await adminAlert.executeAction(activeAlert.value.id)
}
</script>

<template>
  <Teleport to="body">
    <div class="admin-alert-host" aria-live="off">
      <Transition name="admin-alert-slide" appear>
        <div
          v-if="activeAlert"
          :key="activeAlert.id"
          class="admin-alert-host__stack"
          @mouseenter="handlePause"
          @mouseleave="handleResume"
        >
          <AdminAlertItem
            :alert="activeAlert"
            @close="handleClose"
            @action="handleAction"
          />
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.admin-alert-host {
  position: fixed;
  inset: 0 0 auto;
  z-index: 1200;
  display: flex;
  justify-content: center;
  padding:
    max(1rem, calc(env(safe-area-inset-top) + 1rem))
    1rem
    0;
  pointer-events: none;
}

.admin-alert-host__stack {
  width: min(100%, 40rem);
  pointer-events: auto;
  will-change: transform, opacity;
}

.admin-alert-slide-enter-active {
  transition:
    transform 300ms cubic-bezier(0.2, 0.82, 0.24, 1),
    opacity 300ms ease;
}

.admin-alert-slide-leave-active {
  transition:
    transform 210ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 210ms ease;
}

.admin-alert-slide-enter-from {
  opacity: 0;
  transform: translate3d(0, -1.25rem, 0) scale(0.985);
}

.admin-alert-slide-enter-to,
.admin-alert-slide-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.admin-alert-slide-leave-to {
  opacity: 0;
  transform: translate3d(0, -1rem, 0) scale(0.992);
}

@media (max-width: 960px) {
  .admin-alert-host {
    padding-inline: 0.75rem;
  }
}

@media (max-width: 640px) {
  .admin-alert-host {
    padding:
      max(0.75rem, calc(env(safe-area-inset-top) + 0.75rem))
      0.5rem
      0;
  }

  .admin-alert-host__stack {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-alert-slide-enter-active,
  .admin-alert-slide-leave-active {
    transition-duration: 1ms;
  }

  .admin-alert-slide-enter-from,
  .admin-alert-slide-leave-to {
    transform: none;
  }
}
</style>
