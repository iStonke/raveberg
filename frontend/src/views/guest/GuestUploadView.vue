<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import RavebergLogo from '../../components/branding/RavebergLogo.vue'
import { uploadGuestImage } from '../../services/api'
import { usePublicRuntimeStore } from '../../stores/publicRuntime'

const publicRuntimeStore = usePublicRuntimeStore()
const fileInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const progress = ref(0)
const successMessage = ref('')
const errorMessage = ref('')
const uploadedPreviewUrl = ref<string | null>(null)
const pendingPreviewUrl = ref<string | null>(null)
const pendingFile = ref<File | null>(null)
const isConfirmDialogOpen = ref(false)
const commentDraft = ref('')
const isFlashActive = ref(false)

const guestHeadline = 'Selfie auf den Screen'
const guestSubheadline = 'Foto machen oder hochladen'

const uploadMetaText = computed(() => `1 Bild zurzeit · Max. ${publicRuntimeStore.uploadMaxMegabytes} MB`)

const successDetail = 'Dein Bild erscheint gleich auf dem Screen'
let flashTimeoutId: ReturnType<typeof setTimeout> | null = null
const commentLimit = 40

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
  clearFlashTimeout()
  clearPendingSelection()
  revokePreview()
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
  progress.value = 0
  isConfirmDialogOpen.value = true
}

async function confirmUpload() {
  if (!pendingFile.value || !pendingPreviewUrl.value) {
    return
  }

  const file = pendingFile.value
  const previewUrl = pendingPreviewUrl.value
  const comment = normalizeComment(commentDraft.value)
  pendingFile.value = null
  pendingPreviewUrl.value = null
  isConfirmDialogOpen.value = false
  progress.value = 0
  isUploading.value = true

  try {
    await uploadGuestImage(file, comment, (nextProgress) => {
      progress.value = nextProgress
    })
    uploadedPreviewUrl.value = previewUrl
    successMessage.value = 'Bild hochgeladen'
    await nextTick()
    triggerThumbnailFlash()
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    errorMessage.value = humanizeUploadError(error)
  } finally {
    isUploading.value = false
  }
}

function cancelUploadConfirmation() {
  isConfirmDialogOpen.value = false
  clearPendingSelection()
}

function openLibrary() {
  fileInput.value?.click()
}

function openCamera() {
  cameraInput.value?.click()
}

function clearMessages() {
  successMessage.value = ''
  errorMessage.value = ''
  revokePreview()
}

function revokePreview() {
  if (uploadedPreviewUrl.value) {
    URL.revokeObjectURL(uploadedPreviewUrl.value)
    uploadedPreviewUrl.value = null
  }
}

function clearPendingSelection() {
  pendingFile.value = null
  commentDraft.value = ''
  if (pendingPreviewUrl.value) {
    URL.revokeObjectURL(pendingPreviewUrl.value)
    pendingPreviewUrl.value = null
  }
}

function updateCommentDraft(value: string) {
  commentDraft.value = normalizeComment(value, { preserveTrailingSpace: true })
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

function commentCounter(value: string) {
  return Array.from(value).length
}

function triggerThumbnailFlash() {
  clearFlashTimeout()
  isFlashActive.value = false

  flashTimeoutId = setTimeout(() => {
    requestAnimationFrame(() => {
      isFlashActive.value = true
      flashTimeoutId = setTimeout(() => {
        isFlashActive.value = false
        flashTimeoutId = null
      }, 420)
    })
  }, 70)
}

function clearFlashTimeout() {
  if (flashTimeoutId) {
    clearTimeout(flashTimeoutId)
    flashTimeoutId = null
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
</script>

<template>
  <section class="guest-upload-page">
    <div class="guest-background" aria-hidden="true">
      <div class="guest-background-layer guest-background-base" />
      <div class="guest-background-layer guest-background-orb guest-background-orb-a" />
      <div class="guest-background-layer guest-background-orb guest-background-orb-b" />
      <div class="guest-background-layer guest-background-orb guest-background-orb-c" />
      <div class="guest-background-layer guest-background-glow" />
    </div>
    <div class="guest-upload-panel">
      <div class="guest-header">
        <RavebergLogo mode="compact" class="guest-logo" />
        <h1 class="guest-headline">{{ guestHeadline }}</h1>
        <p class="guest-subheadline">{{ guestSubheadline }}</p>
      </div>

      <div class="guest-actions">
        <v-btn
          size="x-large"
          color="primary"
          rounded="xl"
          block
          class="guest-action-primary"
          prepend-icon="mdi-camera"
          :loading="isUploading"
          @click="openCamera"
        >
          Kamera öffnen
        </v-btn>
        <v-btn
          size="x-large"
          variant="outlined"
          rounded="xl"
          block
          class="guest-action-secondary"
          prepend-icon="mdi-image-outline"
          :disabled="isUploading"
          @click="openLibrary"
        >
          Bild auswählen
        </v-btn>
      </div>

      <div class="guest-meta" aria-live="polite">
        <p class="guest-meta-line">{{ uploadMetaText }}</p>
      </div>

      <div v-if="successMessage && uploadedPreviewUrl" class="guest-divider" aria-hidden="true" />

      <v-dialog
        v-model="isConfirmDialogOpen"
        max-width="24rem"
        :persistent="isUploading"
        scrim="rgba(3, 7, 12, 0.76)"
      >
        <v-card class="upload-confirm-card" rounded="xl">
          <div v-if="pendingPreviewUrl" class="upload-confirm-preview-frame">
            <img class="upload-confirm-preview" :src="pendingPreviewUrl" alt="Ausgewähltes Bild" />
          </div>
          <div class="upload-confirm-title">Bild wirklich hochladen?</div>
          <div class="upload-confirm-copy">
            Das ausgewählte Foto wird direkt an den Screen-Upload gesendet.
          </div>
          <v-text-field
            :model-value="commentDraft"
            label="Kommentar hinzufügen (optional)"
            placeholder="z.B. Beste Nacht! 🎉"
            variant="solo-filled"
            :counter="commentLimit"
            :counter-value="commentCounter"
            single-line
            class="upload-confirm-field"
            @update:model-value="updateCommentDraft"
            @keydown.enter.prevent
          />
          <div class="upload-confirm-actions">
            <v-btn
              variant="outlined"
              rounded="xl"
              class="upload-confirm-cancel"
              :disabled="isUploading"
              @click="cancelUploadConfirmation"
            >
              Abbrechen
            </v-btn>
            <v-btn
              color="primary"
              rounded="xl"
              class="upload-confirm-submit"
              :loading="isUploading"
              @click="confirmUpload"
            >
              Hochladen
            </v-btn>
          </div>
        </v-card>
      </v-dialog>

      <input
        ref="cameraInput"
        class="hidden-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,image/*"
        capture="environment"
        @change="handleFileSelection"
      />
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,image/*"
        @change="handleFileSelection"
      />

      <v-progress-linear
        v-if="isUploading"
        class="guest-progress"
        color="primary"
        height="10"
        rounded
        :model-value="progress"
      />

      <Transition name="success-card">
        <div v-if="successMessage && uploadedPreviewUrl" class="upload-feedback success-feedback">
        <div class="upload-thumbnail-frame">
          <img class="upload-thumbnail" :src="uploadedPreviewUrl" alt="Hochgeladenes Bild" />
          <div class="thumbnail-flash-overlay" :class="{ 'flash-active': isFlashActive }" />
        </div>
        <div class="feedback-title">{{ successMessage }}</div>
        <div class="feedback-copy">{{ successDetail }}</div>
      </div>
      </Transition>

      <v-alert v-if="errorMessage" class="guest-alert" type="error" variant="tonal">
        {{ errorMessage }}
      </v-alert>
    </div>
  </section>
</template>

<style scoped>
.thumbnail-flash-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.98);
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  border-radius: 18px;
  will-change: opacity;
}

.flash-active {
  animation: cameraFlash 360ms cubic-bezier(0.16, 0.84, 0.32, 1);
}

@keyframes cameraFlash {
  0% {
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  52% {
    opacity: 0.42;
  }

  100% {
    opacity: 0;
  }
}

@keyframes confirmDialogJump {
  0% {
    opacity: 0;
    transform: translateY(22px) scale(0.92);
  }

  55% {
    opacity: 1;
    transform: translateY(-8px) scale(1.02);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes bgMove {
  0% {
    transform: translate3d(-10%, -7%, 0) scale(0.98);
    opacity: 0.72;
  }

  100% {
    transform: translate3d(12%, 10%, 0) scale(1.2);
    opacity: 1;
  }
}

@keyframes bgDrift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.42;
  }

  100% {
    transform: translate3d(-16%, 12%, 0) scale(1.22);
    opacity: 0.86;
  }
}

.guest-upload-page {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -8%, rgba(196, 231, 255, 0.14), transparent 24%),
    linear-gradient(180deg, #1b3d63 0%, #122f50 34%, #081c33 68%, #040d18 100%);
}

.guest-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.guest-background-layer {
  position: absolute;
  inset: 0;
}

.guest-background-base {
  background:
    radial-gradient(circle at 48% 12%, rgba(178, 222, 255, 0.32), transparent 26%),
    radial-gradient(circle at 18% 24%, rgba(108, 226, 255, 0.12), transparent 20%),
    radial-gradient(circle at 84% 78%, rgba(2, 8, 18, 0.62), transparent 28%),
    radial-gradient(circle at 18% 88%, rgba(0, 0, 0, 0.46), transparent 24%),
    linear-gradient(180deg, rgba(58, 107, 166, 0.18), rgba(6, 14, 26, 0.42));
}

.guest-background-orb {
  inset: -24%;
  filter: blur(40px);
  opacity: 0.98;
  will-change: transform;
}

.guest-background-orb-a {
  background:
    radial-gradient(circle at 34% 24%, rgba(158, 222, 255, 0.72), transparent 16%),
    radial-gradient(circle at 42% 32%, rgba(67, 154, 255, 0.24), transparent 24%),
    radial-gradient(circle at 68% 72%, rgba(0, 0, 0, 0.26), transparent 30%);
  animation: bgMove 7s ease-in-out infinite alternate;
}

.guest-background-orb-b {
  background:
    radial-gradient(circle at 72% 24%, rgba(41, 136, 255, 0.5), transparent 18%),
    radial-gradient(circle at 64% 18%, rgba(9, 29, 77, 0.52), transparent 24%),
    radial-gradient(circle at 32% 82%, rgba(0, 0, 0, 0.34), transparent 28%);
  animation: bgDrift 8.5s ease-in-out infinite alternate;
}

.guest-background-orb-c {
  background:
    radial-gradient(circle at 46% 78%, rgba(96, 235, 255, 0.24), transparent 16%),
    radial-gradient(circle at 54% 72%, rgba(6, 20, 52, 0.5), transparent 24%),
    radial-gradient(circle at 74% 20%, rgba(0, 0, 0, 0.32), transparent 26%);
  animation: bgMove 10s ease-in-out infinite alternate-reverse;
}

.guest-background-glow {
  inset: -8%;
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.1), transparent 12%),
    radial-gradient(circle at 52% 58%, rgba(37, 125, 255, 0.14), transparent 22%),
    radial-gradient(circle at 30% 84%, rgba(4, 16, 41, 0.42), transparent 18%),
    radial-gradient(circle at 78% 88%, rgba(0, 0, 0, 0.3), transparent 20%);
  filter: blur(22px);
  animation: bgDrift 11s ease-in-out infinite alternate-reverse;
}

.guest-upload-panel {
  width: min(100%, 34rem);
  padding: clamp(1.2rem, 4vw, 1.8rem);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(25, 34, 46, 0.14), rgba(8, 12, 18, 0.34)),
    rgba(10, 15, 20, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 24px 72px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
}

.guest-header {
  display: grid;
  justify-items: center;
  gap: 0.28rem;
}

.guest-logo {
  width: min(100%, 12rem);
  margin-bottom: 0.72rem;
  filter: drop-shadow(0 14px 30px rgba(56, 148, 255, 0.16));
}

.guest-headline {
  margin: 0;
  max-width: none;
  font-size: clamp(1.15rem, 4.2vw, 1.375rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 0 12px rgba(82, 178, 255, 0.08);
  white-space: nowrap;
}

.guest-subheadline {
  margin: 0;
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.75);
  white-space: nowrap;
}

.guest-actions {
  display: grid;
  gap: 0.9rem;
  margin-top: 2.05rem;
}

.guest-action-primary,
.guest-action-secondary {
  min-height: 3.7rem;
  border-radius: 1.35rem;
}

.guest-action-primary {
  box-shadow: 0 16px 36px rgba(0, 146, 255, 0.24);
}

.guest-meta {
  margin-top: 0.65rem;
  display: grid;
  justify-items: center;
}

.guest-meta-line {
  margin: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.875rem;
  line-height: 1.4;
}

.guest-progress {
  margin-top: 1.15rem;
  opacity: 0.95;
}

.upload-feedback {
  margin-top: 0;
  padding: 0;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.6rem;
  overflow: hidden;
  transform-origin: top center;
}

.guest-divider {
  width: 60%;
  height: 1px;
  margin: 1.45rem auto;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.18), transparent);
}

.success-card-enter-active,
.success-card-leave-active {
  transition:
    opacity 280ms ease,
    transform 320ms cubic-bezier(0.2, 0.9, 0.2, 1),
    max-height 320ms cubic-bezier(0.2, 0.9, 0.2, 1),
    margin-top 320ms cubic-bezier(0.2, 0.9, 0.2, 1),
    filter 280ms ease;
}

.success-card-enter-from,
.success-card-leave-to {
  opacity: 0;
  transform: translateY(-10px) scaleY(0.94);
  max-height: 0;
  margin-top: 0;
  filter: blur(8px);
}

.success-card-enter-to,
.success-card-leave-from {
  opacity: 1;
  transform: translateY(0) scaleY(1);
  max-height: 28rem;
  margin-top: 0;
  filter: blur(0);
}

.success-feedback {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.upload-thumbnail {
  width: min(42vw, 156px);
  max-height: 156px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.03);
}

.upload-thumbnail-frame {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
}

.feedback-title {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.25;
  color: rgba(241, 249, 245, 0.94);
}

.feedback-copy {
  margin-top: -0.2rem;
  max-width: 18rem;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 400;
  line-height: 1.4;
  color: rgba(241, 249, 245, 0.75);
}

.guest-alert {
  margin-top: 1rem;
}

.upload-confirm-card {
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(24, 33, 46, 0.92), rgba(9, 13, 20, 0.96)),
    rgba(10, 15, 20, 0.94);
  box-shadow:
    0 26px 80px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  transform-origin: center bottom;
  animation: confirmDialogJump 420ms cubic-bezier(0.2, 0.9, 0.22, 1);
}

.upload-confirm-preview-frame {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.upload-confirm-preview {
  display: block;
  width: 100%;
  max-height: 13rem;
  object-fit: cover;
}

.upload-confirm-title {
  margin-top: 0.95rem;
  text-align: center;
  font-size: 1.08rem;
  font-weight: 600;
  line-height: 1.25;
  color: rgba(247, 250, 255, 0.94);
}

.upload-confirm-copy {
  margin-top: 0.45rem;
  text-align: center;
  font-size: 0.92rem;
  line-height: 1.45;
  color: rgba(226, 235, 247, 0.74);
}

.upload-confirm-field {
  margin-top: 0.95rem;
}

.upload-confirm-field :deep(.v-field) {
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 24px rgba(0, 0, 0, 0.12);
}

.upload-confirm-field :deep(.v-field__input),
.upload-confirm-field :deep(.v-label),
.upload-confirm-field :deep(.v-field__prepend-inner) {
  color: rgba(241, 246, 255, 0.86);
}

.upload-confirm-field :deep(.v-counter) {
  color: rgba(226, 235, 247, 0.58);
}

.upload-confirm-actions {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.upload-confirm-cancel,
.upload-confirm-submit {
  min-height: 3rem;
}

.hidden-input {
  display: none;
}

.guest-action-primary :deep(.v-btn__content),
.guest-action-secondary :deep(.v-btn__content) {
  gap: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.guest-action-primary :deep(.v-btn__prepend),
.guest-action-secondary :deep(.v-btn__prepend) {
  margin-inline-end: 0.42rem;
}

.guest-action-primary :deep(.v-btn__overlay) {
  opacity: 0.08;
}

.guest-action-secondary :deep(.v-btn__underlay) {
  background: transparent;
}

.guest-action-secondary :deep(.v-btn__content) {
  color: rgba(241, 246, 255, 0.86);
}

.guest-action-secondary :deep(.v-btn__prepend .v-icon) {
  color: rgba(156, 215, 255, 0.88);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .guest-upload-panel {
    background: linear-gradient(180deg, rgba(20, 39, 63, 0.82), rgba(10, 24, 42, 0.9));
  }

  .success-feedback {
    background: linear-gradient(180deg, rgba(47, 93, 73, 0.34), rgba(16, 28, 22, 0.84));
  }
}

@media (min-width: 640px) {
  .guest-upload-page {
    padding: 1.4rem;
  }

  .guest-upload-panel {
    width: min(100%, 35rem);
    padding: 1.65rem 1.7rem 1.75rem;
  }

  .guest-actions {
    margin-top: 2.15rem;
  }

  .guest-meta {
    margin-top: 0.7rem;
  }
}
</style>
