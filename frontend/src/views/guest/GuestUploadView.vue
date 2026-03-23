<script setup lang="ts">
import { ref } from 'vue'

import RavebergLogo from '../../components/branding/RavebergLogo.vue'
import { useGuestUploadFlow } from '../../composables/useGuestUploadFlow'

const isCommentFieldFocused = ref(false)

const {
  fileInput,
  cameraInput,
  isUploading,
  errorMessage,
  successNotice,
  pendingPreviewUrl,
  isPendingPreviewReady,
    commentDraft,
    step,
    commentLimit,
    commentLength,
    uploadMetaText,
    selectSubheadline,
    confirmSubheadline,
    uploadUiDisabled,
    blockingNoticeTitle,
    blockingNoticeText,
    handleFileSelection,
    confirmUpload,
    cancelConfirmation,
    openLibrary,
  openCamera,
  updateCommentDraft,
  handlePendingPreviewLoad,
} = useGuestUploadFlow()
</script>

<template>
  <section class="guest-upload-page safe-area-page">
    <div class="guest-upload-background" aria-hidden="true">
      <div class="guest-upload-background-layer guest-upload-background-base" />
      <div class="guest-upload-background-layer guest-upload-background-orb guest-upload-background-orb-a" />
      <div class="guest-upload-background-layer guest-upload-background-orb guest-upload-background-orb-b" />
      <div class="guest-upload-background-layer guest-upload-background-orb guest-upload-background-orb-c" />
      <div class="guest-upload-background-layer guest-upload-background-glow" />
    </div>

    <div class="guest-banner-stack" aria-live="polite" aria-atomic="true">
      <Transition name="guest-success-banner">
        <div v-if="blockingNoticeText" class="guest-banner-wrap">
          <div class="guest-success-banner guest-success-banner--warning" role="status">
            <div class="guest-success-banner__icon guest-success-banner__icon--warning">
              <v-icon :icon="blockingNoticeTitle.includes('abgelaufen') ? 'mdi-timer-off-outline' : 'mdi-pause-circle-outline'" size="20" />
            </div>
            <div class="guest-success-banner__copy">
              <div class="guest-success-banner__title">{{ blockingNoticeTitle }}</div>
              <div class="guest-success-banner__text">{{ blockingNoticeText }}</div>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="guest-success-banner">
        <div v-if="successNotice" class="guest-banner-wrap">
          <div class="guest-success-banner" role="status">
            <div class="guest-success-banner__icon">
              <v-icon icon="mdi-check-circle" size="20" />
            </div>
            <div class="guest-success-banner__copy">
              <div class="guest-success-banner__title">Bild hochgeladen</div>
              <div class="guest-success-banner__text">{{ successNotice }}</div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="guest-upload-stage">
      <div class="guest-upload-panel">
        <div class="guest-panel-stage">
          <Transition name="guest-panel-switch">
            <div v-if="step === 'select'" key="select" class="guest-form guest-panel-state">
            <div class="guest-select-header">
              <RavebergLogo mode="compact" class="guest-logo" />
              <div class="guest-confirm-copy guest-confirm-copy--select">
                <h1 class="guest-headline">Selfie auf dem Screen anzeigen</h1>
                <p class="guest-subheadline">{{ selectSubheadline }}</p>
              </div>
            </div>

            <div class="guest-actions">
              <v-btn
                color="primary"
                block
                rounded="xl"
                class="guest-submit guest-submit--primary"
                size="x-large"
                prepend-icon="mdi-camera"
                :class="{ 'guest-submit--disabled': uploadUiDisabled }"
                :disabled="uploadUiDisabled"
                @click="openCamera"
              >
                Kamera öffnen
              </v-btn>

              <v-btn
                variant="outlined"
                block
                rounded="xl"
                class="guest-submit guest-submit--secondary"
                size="x-large"
                prepend-icon="mdi-image-outline"
                :class="{ 'guest-submit--disabled': uploadUiDisabled }"
                :disabled="uploadUiDisabled"
                @click="openLibrary"
              >
                Bild auswählen
              </v-btn>
            </div>

            <div class="guest-meta">
              {{ uploadMetaText }}
            </div>
          </div>

            <div v-else key="confirm" class="guest-form guest-form--confirm guest-panel-state">
            <div class="guest-confirm-scroll">
              <Transition name="guest-preview" appear>
                <div
                  v-if="pendingPreviewUrl"
                  class="guest-preview-frame"
                  :class="{ 'guest-preview-frame--loading': !isPendingPreviewReady }"
                >
                  <img
                    class="guest-preview-image"
                    :class="{ 'guest-preview-image--ready': isPendingPreviewReady }"
                    :src="pendingPreviewUrl"
                    alt="Ausgewähltes Bild"
                    @load="handlePendingPreviewLoad"
                  />
                </div>
              </Transition>

              <div class="guest-confirm-copy">
                <h1 class="guest-headline guest-headline--confirm">Bild wirklich hochladen?</h1>
                <p class="guest-subheadline">{{ confirmSubheadline }}</p>
              </div>

              <v-text-field
                :model-value="commentDraft"
                :placeholder="commentDraft ? '' : 'Kommentar hinzufügen (optional)'"
                :maxlength="commentLimit"
                aria-label="Kommentar hinzufügen"
                variant="solo-filled"
                hide-details
                class="guest-field"
                :disabled="uploadUiDisabled"
                @update:model-value="updateCommentDraft"
                @keydown.enter.prevent
                @focusin="isCommentFieldFocused = true"
                @focusout="isCommentFieldFocused = false"
              />

              <Transition name="guest-counter">
                <div
                  v-if="isCommentFieldFocused"
                  class="guest-comment-counter"
                  aria-live="polite"
                >
                  {{ commentLength }} / {{ commentLimit }}
                </div>
              </Transition>

            </div>

            <div class="guest-confirm-actions">
              <v-btn
                variant="outlined"
                rounded="xl"
                class="guest-submit guest-submit--secondary"
                :disabled="isUploading"
                @click="cancelConfirmation"
              >
                Zurück
              </v-btn>

              <v-btn
                color="primary"
                rounded="xl"
                class="guest-submit guest-submit--primary"
                :class="{ 'guest-submit--disabled': uploadUiDisabled }"
                :disabled="uploadUiDisabled"
                :loading="isUploading"
                @click="confirmUpload"
              >
                Hochladen
              </v-btn>
            </div>
            </div>
          </Transition>
        </div>

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          class="guest-alert"
        >
          {{ errorMessage }}
        </v-alert>
      </div>
    </div>

    <input
      ref="cameraInput"
      class="hidden-input"
      type="file"
      accept=".jpg,.jpeg,.png,.webp,.heic,image/*"
      capture="environment"
      :disabled="uploadUiDisabled"
      @change="handleFileSelection"
    />
    <input
      ref="fileInput"
      class="hidden-input"
      type="file"
      accept=".jpg,.jpeg,.png,.webp,.heic,image/*"
      :disabled="uploadUiDisabled"
      @change="handleFileSelection"
    />
  </section>
</template>

<style scoped>
@keyframes guestPreviewShimmer {
  0% {
    background-position: 180% 0, 0 0;
  }

  100% {
    background-position: -40% 0, 0 0;
  }
}

@keyframes guestBgMove {
  0% {
    transform: translate3d(-10%, -7%, 0) scale(0.98);
    opacity: 0.72;
  }

  100% {
    transform: translate3d(12%, 10%, 0) scale(1.2);
    opacity: 1;
  }
}

@keyframes guestBgDrift {
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
  min-height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -8%, rgba(196, 231, 255, 0.08), transparent 20%),
    linear-gradient(180deg, #0f233b 0%, #091828 34%, #040c16 68%, #02060b 100%);
}

.guest-upload-stage {
  width: 100%;
  min-height: calc(100vh - var(--safe-area-top) - var(--safe-area-bottom));
  min-height: calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom));
  display: grid;
  place-items: center;
  padding: 1rem;
  transform: translateY(calc((var(--safe-area-bottom) - var(--safe-area-top)) / 2));
}

.guest-upload-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.guest-upload-background-layer {
  position: absolute;
  inset: 0;
}

.guest-upload-background-base {
  background:
    radial-gradient(circle at 48% 12%, rgba(178, 222, 255, 0.2), transparent 22%),
    radial-gradient(circle at 18% 24%, rgba(108, 226, 255, 0.08), transparent 18%),
    radial-gradient(circle at 84% 78%, rgba(0, 0, 0, 0.78), transparent 26%),
    radial-gradient(circle at 18% 88%, rgba(0, 0, 0, 0.62), transparent 22%),
    linear-gradient(180deg, rgba(33, 73, 120, 0.14), rgba(2, 7, 14, 0.58));
}

.guest-upload-background-orb {
  inset: -24%;
  filter: blur(40px);
  opacity: 0.98;
  will-change: transform;
}

.guest-upload-background-orb-a {
  background:
    radial-gradient(circle at 34% 24%, rgba(158, 222, 255, 0.48), transparent 14%),
    radial-gradient(circle at 42% 32%, rgba(67, 154, 255, 0.16), transparent 20%),
    radial-gradient(circle at 68% 72%, rgba(0, 0, 0, 0.42), transparent 26%);
  animation: guestBgMove 7s ease-in-out infinite alternate;
}

.guest-upload-background-orb-b {
  background:
    radial-gradient(circle at 72% 24%, rgba(41, 136, 255, 0.34), transparent 16%),
    radial-gradient(circle at 64% 18%, rgba(9, 29, 77, 0.58), transparent 22%),
    radial-gradient(circle at 32% 82%, rgba(0, 0, 0, 0.46), transparent 24%);
  animation: guestBgDrift 8.5s ease-in-out infinite alternate;
}

.guest-upload-background-orb-c {
  background:
    radial-gradient(circle at 46% 78%, rgba(96, 235, 255, 0.16), transparent 14%),
    radial-gradient(circle at 54% 72%, rgba(6, 20, 52, 0.58), transparent 22%),
    radial-gradient(circle at 74% 20%, rgba(0, 0, 0, 0.44), transparent 22%);
  animation: guestBgMove 10s ease-in-out infinite alternate-reverse;
}

.guest-upload-background-glow {
  inset: -8%;
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.06), transparent 10%),
    radial-gradient(circle at 52% 58%, rgba(37, 125, 255, 0.1), transparent 20%),
    radial-gradient(circle at 30% 84%, rgba(4, 16, 41, 0.54), transparent 16%),
    radial-gradient(circle at 78% 88%, rgba(0, 0, 0, 0.42), transparent 18%);
  filter: blur(22px);
  animation: guestBgDrift 11s ease-in-out infinite alternate-reverse;
}

.guest-upload-panel {
  position: relative;
  width: min(100%, 28rem);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: clamp(1.35rem, 4vw, 1.9rem);
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
  overflow: hidden;
}

.guest-panel-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
}

.guest-logo {
  width: min(100%, 12rem);
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 14px 30px rgba(56, 148, 255, 0.16));
}

.guest-headline {
  margin: 1rem 0 0;
  text-align: center;
  font-size: clamp(1.2rem, 4.4vw, 1.45rem);
  font-weight: 600;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 0 12px rgba(82, 178, 255, 0.08);
}

.guest-headline--confirm {
  margin-top: 0;
}

.guest-subheadline {
  margin: 0.08rem 0 0;
  text-align: center;
  font-size: 0.94rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.74);
}

.guest-form {
  display: grid;
  gap: 0.9rem;
  min-height: 0;
}

.guest-panel-state {
  grid-area: 1 / 1;
  width: 100%;
  align-self: start;
}

.guest-form--confirm {
  flex: 1 1 auto;
  align-self: stretch;
}

.guest-actions {
  display: grid;
  gap: 0.9rem;
}

.guest-confirm-scroll {
  display: grid;
  gap: 0.9rem;
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
}

.guest-confirm-scroll::-webkit-scrollbar {
  display: none;
}

.guest-preview-frame {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at 18% 20%, rgba(143, 210, 255, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.guest-preview-frame--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.16) 48%, transparent 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  background-size: 220% 100%, 100% 100%;
  animation: guestPreviewShimmer 1.1s linear infinite;
  pointer-events: none;
}

.guest-preview-image {
  display: block;
  width: 100%;
  max-height: 13rem;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.035);
  filter: saturate(0.92) blur(3px);
  transition:
    opacity 320ms ease,
    transform 520ms cubic-bezier(0.2, 0.76, 0.24, 1),
    filter 360ms ease;
}

.guest-preview-image--ready {
  opacity: 1;
  transform: scale(1);
  filter: saturate(1) blur(0);
}

.guest-confirm-copy {
  display: grid;
  gap: 0;
}

.guest-select-header {
  display: block;
}

.guest-confirm-copy--select {
  margin-top: 0;
}

.guest-field :deep(.v-field) {
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 24px rgba(0, 0, 0, 0.12);
}

.guest-field :deep(.v-field__overlay) {
  opacity: 0.04;
}

.guest-field :deep(.v-field__input),
.guest-field :deep(.v-label),
.guest-field :deep(.v-field__prepend-inner) {
  color: rgba(241, 246, 255, 0.86);
}

.guest-field :deep(.v-field__overlay) {
  opacity: 0.04;
}

.guest-comment-counter {
  margin-top: -0.3rem;
  text-align: right;
  font-size: 0.74rem;
  line-height: 1.2;
  color: rgba(214, 224, 235, 0.58);
}

.guest-counter-enter-active,
.guest-counter-leave-active {
  overflow: hidden;
  transition:
    max-height 220ms ease,
    opacity 180ms ease,
    transform 220ms ease,
    margin-top 220ms ease;
}

.guest-counter-enter-from,
.guest-counter-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
  margin-top: -0.55rem;
}

.guest-counter-enter-to,
.guest-counter-leave-from {
  max-height: 1rem;
  opacity: 1;
  transform: translateY(0);
  margin-top: -0.3rem;
}

.guest-confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.guest-submit {
  min-height: 3.5rem;
  margin-top: 0.1rem;
}

.guest-submit--disabled {
  box-shadow: none !important;
}

.guest-submit:disabled {
  opacity: 0.5;
  cursor: default;
}

.guest-submit--primary {
  box-shadow: 0 16px 36px rgba(0, 146, 255, 0.24);
}

.guest-submit :deep(.v-btn__content) {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.guest-meta {
  margin-top: 0.1rem;
  text-align: center;
  font-size: 0.88rem;
  line-height: 1.35;
  color: rgba(214, 224, 235, 0.72);
}

.guest-alert {
  margin-top: 0.9rem;
}

.hidden-input {
  display: none;
}

.guest-banner-stack {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 0.8rem);
  left: 0.75rem;
  right: 0.75rem;
  display: grid;
  gap: 0.65rem;
  z-index: 30;
  pointer-events: none;
}

.guest-banner-wrap {
  min-width: 0;
}

.guest-success-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(138, 226, 177, 0.18);
  background:
    linear-gradient(180deg, rgba(24, 34, 43, 0.92), rgba(12, 18, 24, 0.96)),
    rgba(11, 17, 23, 0.94);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(154, 235, 193, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}

.guest-success-banner--warning {
  border-color: rgba(255, 201, 112, 0.22);
  background:
    linear-gradient(180deg, rgba(42, 33, 20, 0.92), rgba(21, 17, 11, 0.96)),
    rgba(16, 13, 9, 0.94);
}

.guest-success-banner__icon {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: rgba(166, 244, 199, 0.98);
  background: radial-gradient(circle at 30% 30%, rgba(124, 236, 176, 0.22), rgba(50, 115, 78, 0.12));
}

.guest-success-banner__icon--warning {
  color: rgba(255, 220, 154, 0.98);
  background: radial-gradient(circle at 30% 30%, rgba(255, 209, 104, 0.28), rgba(106, 68, 15, 0.16));
}

.guest-success-banner__copy {
  min-width: 0;
}

.guest-success-banner__title {
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(244, 249, 246, 0.96);
}

.guest-success-banner__text {
  margin-top: 0.18rem;
  font-size: 0.855rem;
  line-height: 1.35;
  color: rgba(219, 231, 223, 0.8);
}

.guest-success-banner-enter-active,
.guest-success-banner-leave-active {
  transition:
    opacity 220ms ease,
    transform 240ms cubic-bezier(0.2, 0.76, 0.24, 1);
}

.guest-panel-switch-enter-active {
  transition:
    opacity 320ms ease,
    transform 420ms cubic-bezier(0.2, 0.76, 0.24, 1),
    filter 320ms ease;
  will-change: opacity, transform, filter;
}

.guest-panel-switch-leave-active {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition:
    opacity 220ms ease,
    transform 260ms cubic-bezier(0.4, 0, 0.2, 1),
    filter 220ms ease;
  will-change: opacity, transform, filter;
}

.guest-success-banner-enter-from,
.guest-success-banner-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

.guest-preview-enter-active,
.guest-preview-leave-active {
  transition:
    opacity 240ms ease,
    transform 320ms cubic-bezier(0.2, 0.76, 0.24, 1),
    filter 240ms ease;
}

.guest-preview-enter-from,
.guest-preview-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
  filter: blur(8px);
}

.guest-panel-switch-enter-from,
.guest-panel-switch-leave-to {
  opacity: 0;
  filter: blur(8px);
}

.guest-panel-switch-enter-from {
  transform: translateY(18px) scale(0.985);
}

.guest-panel-switch-leave-to {
  transform: translateY(-10px) scale(0.992);
}

.guest-panel-switch-enter-to,
.guest-panel-switch-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .guest-upload-panel {
    background: linear-gradient(180deg, rgba(20, 39, 63, 0.82), rgba(10, 24, 42, 0.9));
  }
}

@media (min-width: 640px) {
  .guest-upload-stage {
    padding: 1.4rem;
  }
}

@media (max-height: 520px) {
  .guest-upload-stage {
    padding: 0.75rem;
    transform: translateY(calc((var(--safe-area-bottom) - var(--safe-area-top)) / 3));
  }

  .guest-upload-panel {
    padding: 1rem;
  }

  .guest-logo {
    width: min(100%, 9.8rem);
  }

  .guest-headline {
    margin-top: 0.7rem;
    font-size: 1.08rem;
  }

  .guest-subheadline {
    font-size: 0.86rem;
  }

  .guest-form {
    margin-top: 0.95rem;
    gap: 0.75rem;
  }

  .guest-submit {
    min-height: 2.95rem;
  }

  .guest-preview-image {
    max-height: 7.5rem;
  }
}
</style>
