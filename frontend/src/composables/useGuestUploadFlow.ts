import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { uploadGuestImage } from '../services/api'
import { usePublicRuntimeStore } from '../stores/publicRuntime'

export type GuestStep = 'select' | 'confirm'
type UploadBlockReason = 'expired' | 'disabled' | 'invalid' | null

export function useGuestUploadFlow() {
  const route = useRoute()
  const router = useRouter()
  const publicRuntimeStore = usePublicRuntimeStore()
  const fileInput = ref<HTMLInputElement | null>(null)
  const cameraInput = ref<HTMLInputElement | null>(null)
  const isUploading = ref(false)
  const progress = ref(0)
  const errorMessage = ref('')
  const successNotice = ref('')
  const pendingPreviewUrl = ref<string | null>(null)
  const isPendingPreviewReady = ref(false)
  const pendingFile = ref<File | null>(null)
  const commentDraft = ref('')
  const step = ref<GuestStep>('select')
  const nowTimestamp = ref(Date.now())

  const commentLimit = 30
  const commentLength = computed(() => Array.from(commentDraft.value).length)
  const uploadMetaText = computed(() => `1 Bild zurzeit · Max. ${publicRuntimeStore.uploadMaxMegabytes} MB`)
  const selectSubheadline = computed(() => 'Foto machen oder auswählen')
  const confirmSubheadline = computed(() =>
    publicRuntimeStore.guestUploadRequiresApproval
      ? 'Das Bild wird nach Prüfung auf dem Screen angezeigt.'
      : 'Das Bild wird direkt auf dem Screen angezeigt.',
  )
  const uploadProgressValue = computed(() => {
    if (!isUploading.value) {
      return 0
    }

    return progress.value > 0 ? progress.value : 8
  })
  const sessionExpiresAt = computed(() => {
    const rawValue = publicRuntimeStore.guestUploadSessionExpiresAt
    if (!rawValue) {
      return null
    }

    const candidate = new Date(rawValue)
    return Number.isNaN(candidate.getTime()) ? null : candidate
  })
  const sessionReachedLocally = computed(() =>
    Boolean(sessionExpiresAt.value && nowTimestamp.value >= sessionExpiresAt.value.getTime()),
  )
  const routeSessionToken = computed(() => {
    const rawValue = route.query.t
    return typeof rawValue === 'string' ? rawValue.trim() : ''
  })
  const runtimeSessionToken = computed(() => {
    const rawValue = publicRuntimeStore.urls.guest_upload_url
    if (!rawValue) {
      return ''
    }

    try {
      return new URL(rawValue, window.location.origin).searchParams.get('t')?.trim() ?? ''
    } catch {
      return ''
    }
  })
  const sessionIsExpired = computed(() =>
    publicRuntimeStore.guestUploadSessionExpired || sessionReachedLocally.value,
  )
  const canRefreshSessionLink = computed(() =>
    publicRuntimeStore.isLoaded
    && publicRuntimeStore.guestUploadEnabled
    && !sessionIsExpired.value
    && Boolean(runtimeSessionToken.value),
  )
  const resolvedSessionToken = computed(() =>
    runtimeSessionToken.value || routeSessionToken.value,
  )
  const sessionTokenInvalid = computed(() => {
    if (!publicRuntimeStore.isLoaded || canRefreshSessionLink.value) {
      return false
    }

    return routeSessionToken.value !== runtimeSessionToken.value
  })
  const uploadBlockReason = computed<UploadBlockReason>(() => {
    if (sessionTokenInvalid.value) {
      return 'invalid'
    }
    if (sessionIsExpired.value) {
      return 'expired'
    }
    if (!publicRuntimeStore.guestUploadEnabled) {
      return 'disabled'
    }
    return null
  })
  const uploadUiDisabled = computed(() =>
    isUploading.value || uploadBlockReason.value !== null,
  )
  const sessionNotice = computed(() => {
    if (uploadBlockReason.value !== null || !sessionExpiresAt.value) {
      return ''
    }
    return formatSessionNotice(sessionExpiresAt.value)
  })
  const blockingNoticeTitle = computed(() =>
    uploadBlockReason.value === 'expired'
      ? 'Upload-Session abgelaufen'
      : uploadBlockReason.value === 'invalid'
        ? 'Upload-Link nicht mehr gültig'
        : 'Gäste-Upload pausiert',
  )
  const blockingNoticeText = computed(() => {
    if (uploadBlockReason.value === 'expired') {
      return 'Diese Upload-Session ist leider abgelaufen. Bitte wende dich an den Veranstalter.'
    }
    if (uploadBlockReason.value === 'invalid') {
      return 'Dieser Upload-Link ist nicht mehr gültig. Bitte scanne den aktuellen QR-Code erneut.'
    }
    if (uploadBlockReason.value === 'disabled') {
      return 'Der Gäste-Upload ist momentan pausiert. Bitte versuche es später erneut.'
    }
    return ''
  })

  let successNoticeTimeoutId: ReturnType<typeof setTimeout> | null = null
  let runtimeRefreshIntervalId: ReturnType<typeof setInterval> | null = null
  let sessionClockIntervalId: ReturnType<typeof setInterval> | null = null
  let runtimeReconnectTimeoutId: ReturnType<typeof setTimeout> | null = null
  let eventSource: EventSource | null = null

  async function refreshRuntimeInfo(options: { silent?: boolean } = {}) {
    try {
      await publicRuntimeStore.refresh()
      await syncRouteToCurrentSession()
    } catch {
      if (!options.silent && !publicRuntimeStore.isLoaded) {
        errorMessage.value = 'Upload-Status konnte gerade nicht geladen werden. Bitte versuche es gleich erneut.'
      }
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      void refreshRuntimeInfo({ silent: true })
    }
  }

  function applyRuntimeEvent(event: MessageEvent<string>) {
    try {
      publicRuntimeStore.applyRuntimeInfo(JSON.parse(event.data))
      updateTimestamp()
      void syncRouteToCurrentSession()
    } catch {
      // Ignore malformed event payloads and continue with polling fallback.
    }
  }

  async function syncRouteToCurrentSession() {
    if (
      !canRefreshSessionLink.value
      || !runtimeSessionToken.value
      || routeSessionToken.value === runtimeSessionToken.value
    ) {
      return
    }

    await router.replace({
      query: {
        ...route.query,
        t: runtimeSessionToken.value,
      },
    })
  }

  function closeRuntimeEvents() {
    eventSource?.close()
    eventSource = null
  }

  function scheduleRuntimeReconnect() {
    if (runtimeReconnectTimeoutId) {
      return
    }

    runtimeReconnectTimeoutId = setTimeout(() => {
      runtimeReconnectTimeoutId = null
      connectRuntimeEvents()
    }, 2500)
  }

  function connectRuntimeEvents() {
    closeRuntimeEvents()
    const source = new EventSource('/api/events/stream')
    source.addEventListener('public_runtime_snapshot', applyRuntimeEvent as EventListener)
    source.addEventListener('public_runtime_updated', applyRuntimeEvent as EventListener)
    source.onerror = () => {
      closeRuntimeEvents()
      scheduleRuntimeReconnect()
    }
    eventSource = source
  }

  onMounted(async () => {
    await refreshRuntimeInfo({ silent: true })
    connectRuntimeEvents()
    runtimeRefreshIntervalId = setInterval(() => {
      void refreshRuntimeInfo({ silent: true })
    }, 30000)
    sessionClockIntervalId = setInterval(() => {
      nowTimestamp.value = Date.now()
    }, 15000)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    clearSuccessNoticeTimeout()
    clearPendingSelection()
    if (runtimeRefreshIntervalId) {
      clearInterval(runtimeRefreshIntervalId)
    }
    if (sessionClockIntervalId) {
      clearInterval(sessionClockIntervalId)
    }
    if (runtimeReconnectTimeoutId) {
      clearTimeout(runtimeReconnectTimeoutId)
    }
    closeRuntimeEvents()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  async function handleFileSelection(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''

    if (!file) {
      return
    }
    if (!ensureUploadAvailable()) {
      return
    }

    clearMessages()
    clearPendingSelection()
    pendingFile.value = file
    pendingPreviewUrl.value = URL.createObjectURL(file)
    isPendingPreviewReady.value = false
    progress.value = 0
    step.value = 'confirm'
  }

  async function confirmUpload() {
    if (!pendingFile.value || !ensureUploadAvailable()) {
      return
    }

    clearMessages()
    isUploading.value = true
    progress.value = 0

    try {
      await uploadGuestImage(
        pendingFile.value,
        normalizeComment(commentDraft.value),
        (nextProgress) => {
          progress.value = nextProgress
        },
        resolvedSessionToken.value,
      )

      clearPendingSelection()
      showSuccessNotice(
        publicRuntimeStore.guestUploadRequiresApproval
          ? 'Bild hochgeladen. Erscheint nach Freigabe auf dem Screen.'
          : 'Bild hochgeladen. Erscheint gleich auf dem Screen.',
      )
      await refreshRuntimeInfo({ silent: true })
    } catch (error) {
      errorMessage.value = humanizeUploadError(error)
      await refreshRuntimeInfo({ silent: true })
    } finally {
      isUploading.value = false
    }
  }

  function cancelConfirmation() {
    if (isUploading.value) {
      return
    }

    clearMessages()
    clearPendingSelection()
  }

  function openLibrary() {
    if (!ensureUploadAvailable()) {
      return
    }

    fileInput.value?.click()
  }

  function openCamera() {
    if (!ensureUploadAvailable()) {
      return
    }

    cameraInput.value?.click()
  }

  function ensureUploadAvailable() {
    if (isUploading.value) {
      return false
    }
    if (uploadBlockReason.value === null) {
      return true
    }

    errorMessage.value = blockingNoticeText.value
    return false
  }

  function clearMessages() {
    errorMessage.value = ''
    successNotice.value = ''
  }

  function clearPendingSelection() {
    step.value = 'select'
    isPendingPreviewReady.value = false
    pendingFile.value = null
    commentDraft.value = ''
    progress.value = 0

    if (pendingPreviewUrl.value) {
      URL.revokeObjectURL(pendingPreviewUrl.value)
      pendingPreviewUrl.value = null
    }
  }

  function updateCommentDraft(value: string) {
    updateTimestamp()
    commentDraft.value = normalizeComment(value, { preserveTrailingSpace: true })
  }

  function handlePendingPreviewLoad() {
    isPendingPreviewReady.value = true
  }

  function normalizeComment(
    value: string,
    options: { preserveTrailingSpace?: boolean } = {},
  ) {
    const hadTrailingWhitespace = /\s$/u.test(value)
    const singleLine = value.replace(/\s+/gu, ' ')
    let limited = Array.from(singleLine).slice(0, commentLimit).join('')

    if (
      options.preserveTrailingSpace &&
      hadTrailingWhitespace &&
      !limited.endsWith(' ') &&
      Array.from(limited).length < commentLimit
    ) {
      limited += ' '
    }

    return options.preserveTrailingSpace ? limited : limited.trim()
  }

  function showSuccessNotice(message: string) {
    clearSuccessNoticeTimeout()
    successNotice.value = message
    successNoticeTimeoutId = setTimeout(() => {
      successNotice.value = ''
      successNoticeTimeoutId = null
    }, 2600)
  }

  function clearSuccessNoticeTimeout() {
    if (successNoticeTimeoutId) {
      clearTimeout(successNoticeTimeoutId)
      successNoticeTimeoutId = null
    }
  }

  function humanizeUploadError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload fehlgeschlagen'

    if (/Guest upload is currently disabled/i.test(message)) {
      return 'Der Gäste-Upload ist momentan pausiert. Bitte versuche es später erneut.'
    }
    if (/Guest upload session has expired/i.test(message)) {
      return 'Diese Upload-Session ist leider abgelaufen. Bitte wende dich an den Veranstalter.'
    }
    if (/Zu viele Uploads/i.test(message)) {
      return 'Kurz Pause. Bitte gleich noch einmal versuchen.'
    }
    if (/Unsupported file extension|Unsupported MIME type/i.test(message)) {
      return 'Dieses Bildformat wird nicht unterstützt.'
    }
    if (/File too large/i.test(message)) {
      return `Bild ist größer als ${publicRuntimeStore.uploadMaxMegabytes} MB.`
    }
    if (/Invalid or damaged image|Image processing failed/i.test(message)) {
      return 'Dieses Bild konnte nicht verarbeitet werden.'
    }
    if (/Empty upload|Filename missing/i.test(message)) {
      return 'Bitte wähle zuerst ein Foto aus.'
    }

    return 'Upload gerade nicht möglich. Bitte gleich noch einmal versuchen.'
  }

  function updateTimestamp() {
    nowTimestamp.value = Date.now()
  }

  return {
    fileInput,
    cameraInput,
    isUploading,
    progress,
    errorMessage,
    successNotice,
    pendingPreviewUrl,
    isPendingPreviewReady,
    pendingFile,
    commentDraft,
    step,
    commentLimit,
    commentLength,
    uploadMetaText,
    selectSubheadline,
    confirmSubheadline,
    uploadProgressValue,
    uploadUiDisabled,
    sessionNotice,
    blockingNoticeTitle,
    blockingNoticeText,
    sessionIsExpired,
    handleFileSelection,
    confirmUpload,
    cancelConfirmation,
    openLibrary,
    openCamera,
    clearMessages,
    clearPendingSelection,
    updateCommentDraft,
    handlePendingPreviewLoad,
    normalizeComment,
    humanizeUploadError,
  }
}

function formatSessionNotice(expiresAt: Date) {
  const now = new Date()
  const sameDay = expiresAt.toDateString() === now.toDateString()
  const timeLabel = expiresAt.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (sameDay) {
    return `Upload möglich bis heute ${timeLabel} Uhr`
  }

  return `Upload möglich bis ${expiresAt.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })}, ${timeLabel} Uhr`
}
