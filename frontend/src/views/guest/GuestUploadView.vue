<script setup lang="ts">
import { ref } from 'vue'

import { uploadGuestImage } from '../../services/api'

const fileInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const progress = ref(0)
const successMessage = ref('')
const errorMessage = ref('')

async function handleFileSelection(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''

  if (!file) {
    return
  }

  successMessage.value = ''
  errorMessage.value = ''
  progress.value = 0
  isUploading.value = true

  try {
    const upload = await uploadGuestImage(file, (nextProgress) => {
      progress.value = nextProgress
    })
    successMessage.value =
      upload.moderation_status === 'approved'
        ? `Upload erfolgreich und direkt sichtbar: ${upload.filename_original}`
        : `Upload erfolgreich empfangen und wartet auf Freigabe: ${upload.filename_original}`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Upload fehlgeschlagen'
  } finally {
    isUploading.value = false
  }
}

function openLibrary() {
  fileInput.value?.click()
}

function openCamera() {
  cameraInput.value?.click()
}
</script>

<template>
  <section class="guest-upload-page">
    <div class="guest-upload-panel">
      <div class="text-overline mb-3">Guest Upload</div>
      <h1 class="text-h3 mb-4">Selfie direkt ans Display senden</h1>
      <p class="text-body-1 guest-copy">
        Lade ein Bild direkt vom Smartphone hoch. Unterstuetzt werden JPG, PNG, WEBP und HEIC bis
        15 MB. Je nach Moderationsmodus wird dein Bild sofort angezeigt oder wartet kurz auf
        Freigabe.
      </p>

      <div class="guest-actions">
        <v-btn
          size="x-large"
          color="primary"
          rounded="xl"
          block
          :loading="isUploading"
          @click="openCamera"
        >
          Kamera oeffnen
        </v-btn>
        <v-btn
          size="x-large"
          variant="outlined"
          rounded="xl"
          block
          :disabled="isUploading"
          @click="openLibrary"
        >
          Bild auswaehlen
        </v-btn>
      </div>

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
        class="mt-6"
        color="primary"
        height="14"
        rounded
        :model-value="progress"
      />

      <v-alert v-if="successMessage" class="mt-6" type="success" variant="tonal">
        {{ successMessage }}
      </v-alert>

      <v-alert v-if="errorMessage" class="mt-6" type="error" variant="tonal">
        {{ errorMessage }}
      </v-alert>
    </div>
  </section>
</template>

<style scoped>
.guest-upload-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top, rgba(103, 212, 255, 0.18), transparent 34%),
    linear-gradient(180deg, #0a0d12 0%, #111722 100%);
}

.guest-upload-panel {
  width: min(100%, 34rem);
  padding: clamp(1.75rem, 4vw, 3rem);
  border-radius: 32px;
  background: rgba(16, 21, 29, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
}

.guest-copy {
  color: rgba(255, 255, 255, 0.76);
  margin-bottom: 2rem;
}

.guest-actions {
  display: grid;
  gap: 0.9rem;
}

.hidden-input {
  display: none;
}
</style>
