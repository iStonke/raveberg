<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AdminVideoLibraryList from '../../components/admin/AdminVideoLibraryList.vue'
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
  <section class="video-manager-shell">
    <input
      ref="videoFileInput"
      type="file"
      class="sr-only"
      accept="video/mp4,video/webm,.mp4,.webm"
      multiple
      @change="handleVideoFileSelection"
    >

    <div class="video-manager-stack">
      <section class="video-manager-heading">
        <div class="video-manager-heading__topline">
          <div class="video-manager-heading__copy">
            <div class="video-manager-heading__title">Videos</div>
            <div class="video-manager-heading__meta">{{ libraryMetaLabel }}</div>
          </div>
          <div class="video-manager-heading__actions">
            <v-btn
              color="primary"
              variant="outlined"
              class="video-manager-heading__upload"
              prepend-icon="mdi-upload"
              :loading="isUploadingVideos"
              @click="openVideoPicker"
            >
              Video hochladen
            </v-btn>
          </div>
        </div>

        <div v-if="isUploadingVideos" class="video-manager-upload-status">
          <v-progress-linear indeterminate color="primary" rounded />
          <div class="video-manager-upload-status__label">
            {{ videoUploadLabel || 'Videos werden hochgeladen …' }}
          </div>
        </div>
      </section>

      <section class="video-manager-library">
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
      </section>
    </div>
  </section>
</template>

<style scoped>
.video-manager-shell {
  width: 100%;
  min-width: 0;
  padding-inline: 0;
}

.video-manager-stack {
  display: grid;
  gap: 1rem;
}

.video-manager-stack > * {
  padding-inline: 1rem;
}

.video-manager-library {
  display: grid;
  gap: 0.7rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(153, 191, 223, 0.08);
}

.video-manager-empty-state__action {
  min-height: 2.3rem;
  border-radius: 12px;
  text-transform: none;
  letter-spacing: 0.01em;
  font-weight: 700;
}

.video-manager-heading {
  display: grid;
  gap: 0.34rem;
  padding: 0;
}

.video-manager-heading__topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem 1rem;
}

.video-manager-heading__copy {
  min-width: 0;
  display: grid;
  gap: 0.28rem;
}

.video-manager-heading__title {
  color: rgba(245, 249, 255, 0.98);
  font-size: 1.24rem;
  font-weight: 700;
  line-height: 1.1;
}

.video-manager-heading__meta {
  color: rgba(208, 220, 232, 0.6);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.28;
}

.video-manager-heading__actions {
  display: flex;
  flex-shrink: 0;
  align-self: center;
}

.video-manager-heading__upload {
  min-height: 2.05rem;
  padding-inline: 0.82rem;
  border-radius: 12px;
  border-color: rgba(101, 215, 255, 0.28);
  color: rgba(228, 246, 255, 0.96) !important;
  background: rgba(42, 74, 104, 0.42);
  text-transform: none;
  font-weight: 650;
  box-shadow: none;
  letter-spacing: 0.01em;
  transition:
    filter 140ms ease,
    background-color 140ms ease,
    border-color 140ms ease,
    transform 140ms ease;
}

.video-manager-heading__upload:hover {
  filter: brightness(1.03);
  background: rgba(49, 87, 121, 0.5);
  border-color: rgba(101, 215, 255, 0.36);
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
  border-top: 1px solid rgba(153, 191, 223, 0.08);
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

@media (max-width: 959px) {
  .video-manager-stack {
    gap: 0.9rem;
  }

  .video-manager-stack > * {
    padding-inline: 0.75rem;
  }

  .video-manager-toolbar__inner {
    padding-inline: 0.75rem;
  }
}

@media (max-width: 460px) {
  .video-manager-heading__topline {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .video-manager-heading__actions {
    flex-shrink: 1;
  }

  .video-manager-heading__upload {
    width: auto;
  }
}
</style>
