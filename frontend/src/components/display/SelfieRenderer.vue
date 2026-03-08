<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { AppMode, ModerationMode, SelfiePlaybackEvent, UploadItem } from '../../services/api'
import { fetchPublicUploads } from '../../services/api'

const props = defineProps<{
  mode: AppMode
  refreshToken: number
  settings: {
    slideshow_enabled: boolean
    slideshow_interval_seconds: number
    slideshow_shuffle: boolean
    moderation_mode: ModerationMode
    slideshow_updated_at: string | null
  }
  playbackCommand: SelfiePlaybackEvent | null
}>()

const uploads = ref<UploadItem[]>([])
const currentIndex = ref(0)
const isLoading = ref(true)

let rotationTimer: number | undefined
let lastPlaybackSequence = 0

const currentUpload = computed(() => uploads.value[currentIndex.value] ?? null)
const isPaused = computed(() => !props.settings.slideshow_enabled)

onMounted(async () => {
  await reloadUploads()
  syncRotation()
})

onBeforeUnmount(() => {
  stopRotation()
})

watch(
  () => props.refreshToken,
  async () => {
    await reloadUploads()
  },
)

watch(
  () => props.playbackCommand,
  async (command) => {
    if (!command || command.sequence <= lastPlaybackSequence) {
      return
    }

    lastPlaybackSequence = command.sequence
    if (command.action === 'next') {
      advanceNow()
      return
    }

    await reloadUploads()
  },
)

watch(
  () => [
    props.settings.slideshow_enabled,
    props.settings.slideshow_interval_seconds,
    props.settings.slideshow_shuffle,
    uploads.value.length,
  ],
  () => {
    syncRotation()
  },
)

async function reloadUploads() {
  isLoading.value = true
  try {
    const latestUploads = await fetchPublicUploads(100)
    uploads.value = props.settings.slideshow_shuffle ? shuffle(latestUploads) : latestUploads
    currentIndex.value = Math.min(currentIndex.value, Math.max(uploads.value.length - 1, 0))
  } catch {
    // Keep the current slideshow pool when a transient reload fails.
  } finally {
    isLoading.value = false
    syncRotation()
  }
}

function advanceNow() {
  if (uploads.value.length <= 1) {
    return
  }
  currentIndex.value = (currentIndex.value + 1) % uploads.value.length
  syncRotation()
}

function syncRotation() {
  stopRotation()
  if (isPaused.value || uploads.value.length <= 1) {
    return
  }

  rotationTimer = window.setTimeout(() => {
    advanceNow()
  }, props.settings.slideshow_interval_seconds * 1000)
}

function stopRotation() {
  if (rotationTimer) {
    window.clearTimeout(rotationTimer)
    rotationTimer = undefined
  }
}

function shuffle(items: UploadItem[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}
</script>

<template>
  <div>
    <h1 class="display-headline">Selfie Mode aktiv</h1>
    <p v-if="isLoading" class="display-copy">
      Bilder werden geladen.
    </p>
    <p v-else-if="isPaused" class="display-copy">
      Slideshow ist pausiert. Neue freigegebene Bilder bleiben gespeichert und werden nach dem
      Aktivieren wieder angezeigt.
    </p>
    <p v-else-if="!currentUpload" class="display-copy">
      Noch keine freigegebenen Uploads vorhanden.
    </p>
    <div v-else class="slideshow-frame">
      <transition name="fade" mode="out-in">
        <img
          :key="currentUpload.id"
          class="slideshow-image"
          :src="currentUpload.display_url ?? ''"
          :alt="currentUpload.filename_original"
        />
      </transition>
      <p class="display-copy mt-6">
        {{ props.settings.slideshow_shuffle ? 'Shuffle aktiv' : 'Chronologische Reihenfolge aktiv' }}
        · Intervall {{ props.settings.slideshow_interval_seconds }}s · Eingehender Globalmodus:
        {{ mode }}.
      </p>
    </div>
  </div>
</template>

<style scoped>
.display-headline {
  font-size: clamp(2.5rem, 8vw, 6rem);
  line-height: 0.96;
  margin: 0 0 1.5rem;
}

.display-copy {
  margin: 0 auto;
  max-width: 40rem;
  color: rgba(255, 255, 255, 0.72);
  font-size: 1.125rem;
}

.slideshow-frame {
  display: grid;
  gap: 1rem;
}

.slideshow-image {
  display: block;
  width: min(100%, 56rem);
  max-height: 68vh;
  margin: 0 auto;
  object-fit: contain;
  border-radius: 24px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.9s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
