import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type {
  AdminAlert,
  AdminAlertOptions,
  AdminAlertPayload,
  AdminAlertType,
} from '../types/admin-alert'

type AdminAlertState = 'queued' | 'active' | 'leaving'
type AdminAlertRecord = AdminAlert & { state: AdminAlertState }

const AUTO_DISMISS_MS: Record<AdminAlertType, number> = {
  success: 2900,
  info: 3500,
  warning: 4600,
  error: 6200,
}

const EXIT_ANIMATION_MS = 200

export const useAdminAlertStore = defineStore('adminAlert', () => {
  const alerts = ref<AdminAlertRecord[]>([])
  const autoDismissHandles = new Map<string, number>()
  const removalHandles = new Map<string, number>()
  const timerStartedAt = new Map<string, number>()
  const timerRemaining = new Map<string, number>()

  const activeAlert = computed(() =>
    alerts.value.find((alert) => alert.state === 'active' || alert.state === 'leaving') ?? null,
  )

  const queuedCount = computed(
    () => alerts.value.filter((alert) => alert.state === 'queued').length,
  )

  function showAlert(payload: AdminAlertPayload) {
    const type = payload.type ?? 'info'
    const duration = payload.persistent ? payload.duration : payload.duration ?? AUTO_DISMISS_MS[type]
    const alert: AdminAlertRecord = {
      id: createAlertId(),
      type,
      title: payload.title,
      message: payload.message,
      duration,
      dismissible: payload.dismissible ?? true,
      createdAt: Date.now(),
      actionLabel: payload.actionLabel,
      action: payload.action,
      persistent: payload.persistent ?? false,
      state: 'queued',
    }

    alerts.value = [...alerts.value, alert]
    activateNextAlert()
    return alert.id
  }

  function success(message: string, options: AdminAlertOptions = {}) {
    return showAlert({ ...options, type: 'success', message })
  }

  function info(message: string, options: AdminAlertOptions = {}) {
    return showAlert({ ...options, type: 'info', message })
  }

  function warning(message: string, options: AdminAlertOptions = {}) {
    return showAlert({ ...options, type: 'warning', message })
  }

  function error(message: string, options: AdminAlertOptions = {}) {
    return showAlert({ ...options, type: 'error', message })
  }

  function dismiss(id = activeAlert.value?.id) {
    if (!id) {
      return
    }

    const alert = alerts.value.find((entry) => entry.id === id)
    if (!alert) {
      return
    }

    clearAutoDismiss(id)

    if (alert.state === 'queued') {
      removeAlert(id)
      return
    }

    if (alert.state === 'leaving') {
      return
    }

    alert.state = 'leaving'
    clearRemoval(id)
    removalHandles.set(
      id,
      window.setTimeout(() => {
        clearRemoval(id)
        removeAlert(id)
        activateNextAlert()
      }, EXIT_ANIMATION_MS),
    )
  }

  function clearAll() {
    for (const alert of alerts.value) {
      clearAutoDismiss(alert.id)
      clearRemoval(alert.id)
    }
    alerts.value = []
  }

  function pause(id = activeAlert.value?.id) {
    if (!id) {
      return
    }

    const handle = autoDismissHandles.get(id)
    const startedAt = timerStartedAt.get(id)
    const remaining = timerRemaining.get(id)
    if (handle == null || startedAt == null || remaining == null) {
      return
    }

    window.clearTimeout(handle)
    autoDismissHandles.delete(id)
    timerStartedAt.delete(id)
    timerRemaining.set(id, Math.max(0, remaining - (Date.now() - startedAt)))
  }

  function resume(id = activeAlert.value?.id) {
    if (!id || autoDismissHandles.has(id)) {
      return
    }

    const remaining = timerRemaining.get(id)
    if (remaining == null) {
      return
    }

    if (remaining <= 0) {
      dismiss(id)
      return
    }

    scheduleAutoDismiss(id, remaining)
  }

  async function executeAction(id = activeAlert.value?.id) {
    if (!id) {
      return
    }

    const alert = alerts.value.find((entry) => entry.id === id)
    if (!alert?.action) {
      return
    }

    try {
      await alert.action()
    } catch (error) {
      console.error('Admin alert action failed', error)
    }

    dismiss(id)
  }

  function activateNextAlert() {
    if (activeAlert.value) {
      return
    }

    const nextAlert = alerts.value.find((alert) => alert.state === 'queued')
    if (!nextAlert) {
      return
    }

    nextAlert.state = 'active'
    if (nextAlert.persistent) {
      return
    }

    const duration = nextAlert.duration ?? AUTO_DISMISS_MS[nextAlert.type]
    if (duration <= 0) {
      return
    }

    scheduleAutoDismiss(nextAlert.id, duration)
  }

  function scheduleAutoDismiss(id: string, duration: number) {
    clearAutoDismiss(id)
    timerRemaining.set(id, duration)
    timerStartedAt.set(id, Date.now())
    autoDismissHandles.set(
      id,
      window.setTimeout(() => {
        clearAutoDismiss(id)
        dismiss(id)
      }, duration),
    )
  }

  function clearAutoDismiss(id: string) {
    const handle = autoDismissHandles.get(id)
    if (handle != null) {
      window.clearTimeout(handle)
      autoDismissHandles.delete(id)
    }
    timerStartedAt.delete(id)
    timerRemaining.delete(id)
  }

  function clearRemoval(id: string) {
    const handle = removalHandles.get(id)
    if (handle != null) {
      window.clearTimeout(handle)
      removalHandles.delete(id)
    }
  }

  function removeAlert(id: string) {
    clearAutoDismiss(id)
    clearRemoval(id)
    alerts.value = alerts.value.filter((alert) => alert.id !== id)
  }

  return {
    alerts,
    activeAlert,
    queuedCount,
    showAlert,
    success,
    info,
    warning,
    error,
    dismiss,
    clearAll,
    pause,
    resume,
    executeAction,
  }
})

export function useAdminAlert() {
  return useAdminAlertStore()
}

function createAlertId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `admin-alert-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
