<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AdminVideoLibraryList from '../../components/admin/AdminVideoLibraryList.vue'
import PrimaryHeaderAction from '../../components/settings/subpage/PrimaryHeaderAction.vue'
import SubpageContent from '../../components/settings/subpage/SubpageContent.vue'
import SubpageHeader from '../../components/settings/subpage/SubpageHeader.vue'
import SubpageHero from '../../components/settings/subpage/SubpageHero.vue'
import SubpageLayout from '../../components/settings/subpage/SubpageLayout.vue'
import { useAdminVideoLibrary } from '../../composables/useAdminVideoLibrary'
import { useAdminAlert } from '../../stores/adminAlert'
import { useVideoStore } from '../../stores/video'

const adminAlert = useAdminAlert()
const videoStore = useVideoStore()

const {
  videoFileInput,
  busyActions,
  isUploadingVideos,
  videoUploadLabel,
  videoDurations,
  videoMetadataLoading,
  orderedVideoAssets,
  totalVideoDurationSeconds,
  initializeVideoLibrary,
  openVideoPicker,
  handleVideoFileSelection,
  moveVideo,
  removeVideo,
  setActiveVideo,
} = useAdminVideoLibrary()

const videoCountLabel = computed(() => {
  const count = orderedVideoAssets.value.length
  if (count === 0) {
    return 'Keine Clips'
  }
  if (count === 1) {
    return '1 Clip'
  }
  return `${count} Clips`
})

const totalDurationLabel = computed(() => {
  if (totalVideoDurationSeconds.value <= 0) {
    return ''
  }
  return formatCompactDuration(totalVideoDurationSeconds.value)
})

const libraryMetaLabel = computed(() => {
  if (!orderedVideoAssets.value.length) {
    return 'Keine Clips'
  }

  const parts = [videoCountLabel.value]
  if (totalDurationLabel.value) {
    parts.push(totalDurationLabel.value)
  }
  return parts.join(' · ')
})

onMounted(async () => {
  try {
    await initializeVideoLibrary()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Videoverwaltung konnte nicht geladen werden',
    )
  }
})

function formatCompactDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  const totalSeconds = Math.round(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}h`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return `${seconds}s`
}
</script>

<template>
  <section class="video-manager-page">
    <input
      ref="videoFileInput"
      type="file"
      class="sr-only"
      accept="video/mp4,video/webm,.mp4,.webm"
      multiple
      @change="handleVideoFileSelection"
    >

    <SubpageLayout>
      <template #header>
        <SubpageHeader
          :back-to="{ name: 'admin-dashboard', hash: '#modus' }"
          title="Videos"
          :meta="libraryMetaLabel"
          variant="hero"
        >
          <template #hero>
            <SubpageHero />
          </template>

          <template #action>
            <PrimaryHeaderAction
              icon="mdi-upload"
              label="Video hochladen"
              :loading="isUploadingVideos"
              @click="openVideoPicker"
            />
          </template>

          <template #below>
            <div v-if="isUploadingVideos" class="video-manager-upload-status">
              <v-progress-linear indeterminate color="primary" rounded />
              <div class="video-manager-upload-status__label">
                {{ videoUploadLabel || 'Videos werden hochgeladen …' }}
              </div>
            </div>
          </template>
        </SubpageHeader>
      </template>

      <SubpageContent class="video-manager-content">
        <AdminVideoLibraryList
          v-if="orderedVideoAssets.length"
          :assets="orderedVideoAssets"
          :active-video-id="videoStore.activeVideoId"
          :durations="videoDurations"
          :metadata-loading="videoMetadataLoading"
          :busy-actions="busyActions"
          @select="setActiveVideo"
          @move="moveVideo"
          @remove="removeVideo"
        />

        <div v-else class="video-manager-empty-state">
          <div class="video-manager-empty-state__icon-shell" aria-hidden="true">
            <v-icon icon="mdi-play-box-outline" size="32" class="video-manager-empty-state__icon" />
          </div>
          <div class="video-manager-empty-state__title">Noch keine Videos vorhanden</div>
          <div class="video-manager-empty-state__copy">
            Lade dein erstes Video hoch, damit es hier sortiert, ausgewählt und gelöscht werden kann.
          </div>
          <v-btn
            color="primary"
            variant="flat"
            class="video-manager-empty-state__action"
            prepend-icon="mdi-upload"
            @click="openVideoPicker"
          >
            Erstes Video hochladen
          </v-btn>
        </div>
      </SubpageContent>
    </SubpageLayout>
  </section>
</template>

<style scoped>
.video-manager-page {
  width: 100%;
  min-width: 0;
}

.video-manager-content {
  gap: 0.7rem;
}

.video-manager-upload-status {
  display: grid;
  gap: 0.4rem;
  width: min(100%, 30rem);
}

.video-manager-upload-status__label,
.video-manager-library__hint {
  color: rgba(205, 218, 231, 0.64);
  font-size: 0.82rem;
  line-height: 1.4;
}

.video-manager-empty-state {
  display: grid;
  justify-items: center;
  gap: 0.7rem;
  padding: 1.2rem 0.2rem 0.3rem;
  text-align: center;
}

.video-manager-empty-state__icon-shell {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(132, 182, 224, 0.12);
  background:
    radial-gradient(circle at top, rgba(101, 198, 255, 0.12), transparent 62%),
    rgba(10, 18, 28, 0.58);
}

.video-manager-empty-state__icon {
  color: rgba(137, 203, 255, 0.88);
}

.video-manager-empty-state__title {
  color: rgba(244, 249, 255, 0.94);
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.25;
}

.video-manager-empty-state__copy {
  max-width: 26rem;
  color: rgba(201, 214, 228, 0.6);
  font-size: 0.86rem;
  line-height: 1.45;
}

.video-manager-empty-state__action {
  min-height: 2.3rem;
  border-radius: 12px;
  text-transform: none;
  letter-spacing: 0.01em;
  font-weight: 700;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
