<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import type { AppMode, ModerationMode, SelfiePlaybackEvent, UploadItem } from '../../services/api'
import { fetchPublicUploads } from '../../services/api'
import { usePublicRuntimeStore } from '../../stores/publicRuntime'
import IdleRenderer from './IdleRenderer.vue'
import SelfiePolaroidStage from './selfie/SelfiePolaroidStage.vue'

const props = defineProps<{
  mode: AppMode
  refreshToken: number
  standbyReactionToken: number
  settings: {
    slideshow_enabled: boolean
    slideshow_interval_seconds: number
    slideshow_max_visible_photos: number
    slideshow_shuffle: boolean
    vintage_look_enabled: boolean
    moderation_mode: ModerationMode
    slideshow_updated_at: string | null
  }
  playbackCommand: SelfiePlaybackEvent | null
}>()

const publicRuntimeStore = usePublicRuntimeStore()
const uploads = ref<UploadItem[]>([])
const isLoading = ref(true)
let lastPlaybackSequence = 0
const manualAdvanceToken = ref(0)
const isPaused = computed(() => !props.settings.slideshow_enabled)
const eligibleUploadCount = computed(() => uploads.value.filter((upload) => Boolean(upload.display_url)).length)
const shouldShowStandby = computed(
  () => props.settings.slideshow_enabled && eligibleUploadCount.value < 3,
)

onMounted(async () => {
  await reloadUploads()
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
      manualAdvanceToken.value += 1
      return
    }

    await reloadUploads()
  },
)

watch(
  () => [
    props.settings.slideshow_shuffle,
  ],
  () => {
    void reloadUploads()
  },
)

async function reloadUploads() {
  isLoading.value = true
  try {
    const latestUploads = await fetchPublicUploads(100)
    uploads.value = props.settings.slideshow_shuffle ? shuffle(latestUploads) : latestUploads
  } catch {
    // Keep the current feed when a transient reload fails.
  } finally {
    isLoading.value = false
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
  <IdleRenderer
    v-if="shouldShowStandby"
    :event-name="publicRuntimeStore.eventName"
    :event-tagline="publicRuntimeStore.eventTagline"
    :guest-upload-url="publicRuntimeStore.urls.guest_upload_url"
    :reaction-token="props.standbyReactionToken"
  />
  <SelfiePolaroidStage
    v-else
    :uploads="uploads"
    :loading="isLoading"
    :paused="isPaused"
    :interval-seconds="props.settings.slideshow_interval_seconds"
    :max-visible-photos="props.settings.slideshow_max_visible_photos"
    :vintage-look-enabled="props.settings.vintage_look_enabled"
    :moderation-mode="props.settings.moderation_mode"
    :manual-advance-token="manualAdvanceToken"
  />
</template>
