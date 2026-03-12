import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { uploadGuestImage } from '../services/api'
import { usePublicRuntimeStore } from '../stores/publicRuntime'

export type GuestStep = 'select' | 'confirm'

export function useGuestUploadFlow() {
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

  const commentLimit = 30
  const commentLength = computed(() => Array.from(commentDraft.value).length)
  const uploadMetaText = computed(() => `1 Bild zurzeit · Max. ${publicRuntimeStore.uploadMaxMegabytes} MB`)
  const uploadProgressValue = computed(() => {
    if (!isUploading.value) {
      return 0
    }

    return progress.value > 0 ? progress.value : 8
  })

  let successNoticeTimeoutId: ReturnType<typeof setTimeout> | null = null

  onMounted(async () => {
    if (!publicRuntimeStore.isLoaded) {
      try {
        await publicRuntimeStore.refresh()
      } catch {
        // Keep the guest upload flow usable even if runtime info is temporarily unavailable.
      }
    }
  })

  onBeforeUnmount(() => {
    clearSuccessNoticeTimeout()
    clearPendingSelection()
  })

  async function handleFileSelection(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''

    if (!file) {
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
    if (!pendingFile.value) {
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
      )

      clearPendingSelection()
      showSuccessNotice('Bild hochgeladen. Erscheint gleich auf dem Screen.')
    } catch (error) {
      errorMessage.value = humanizeUploadError(error)
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
    if (isUploading.value) {
      return
    }

    fileInput.value?.click()
  }

  function openCamera() {
    if (isUploading.value) {
      return
    }

    cameraInput.value?.click()
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
    uploadProgressValue,
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
