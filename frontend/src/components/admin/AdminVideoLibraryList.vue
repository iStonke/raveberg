<script setup lang="ts">
import type { PropType } from 'vue'

import type { VideoAsset } from '../../services/api'

const props = defineProps({
  assets: {
    type: Array as PropType<VideoAsset[]>,
    required: true,
  },
  activeVideoId: {
    type: Number as PropType<number | null>,
    default: null,
  },
  durations: {
    type: Object as PropType<Record<number, string>>,
    required: true,
  },
  metadataLoading: {
    type: Object as PropType<Record<number, boolean>>,
    required: true,
  },
  busyActions: {
    type: Object as PropType<Record<string, boolean>>,
    default: () => ({}),
  },
})

const emit = defineEmits<{
  select: [asset: VideoAsset]
  move: [asset: VideoAsset, direction: -1 | 1]
  remove: [asset: VideoAsset]
}>()

function isBusy(key: string) {
  return Boolean(props.busyActions[key])
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatVideoMimeLabel(value: string) {
  if (value === 'video/mp4') {
    return 'MP4'
  }
  if (value === 'video/webm') {
    return 'WebM'
  }

  const subtype = value.split('/')[1]
  return subtype ? subtype.toUpperCase() : value.toUpperCase()
}
</script>

<template>
  <div v-if="assets.length" class="video-library-list">
    <div
      v-for="(asset, index) in assets"
      :key="asset.id"
      class="video-library-item"
      :class="{ 'video-library-item--active': activeVideoId === asset.id }"
      @click="emit('select', asset)"
    >
      <div class="video-library-item__thumb">
        <div class="video-library-item__order">{{ index + 1 }}</div>
        <div class="video-library-item__placeholder">
          <v-icon icon="mdi-play-circle-outline" size="24" />
        </div>
      </div>

      <div class="video-library-item__body">
        <div class="video-library-item__content">
          <div class="video-library-item__title-row">
            <div class="video-library-item__title">{{ asset.filename_original }}</div>
            <div v-if="activeVideoId === asset.id" class="video-library-item__badge">Aktiv</div>
          </div>
          <div class="video-library-item__meta">
            <span>{{ durations[asset.id] || (metadataLoading[asset.id] ? 'Wird gelesen' : 'Unbekannt') }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatBytes(asset.size) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatVideoMimeLabel(asset.mime_type) }}</span>
          </div>
        </div>

        <div class="video-library-item__actions">
          <v-btn
            size="small"
            variant="text"
            class="video-library-action"
            icon="mdi-arrow-up"
            :disabled="index === 0"
            :loading="isBusy(`video:move:${asset.id}`)"
            @click.stop="emit('move', asset, -1)"
          />
          <v-btn
            size="small"
            variant="text"
            class="video-library-action"
            icon="mdi-arrow-down"
            :disabled="index === assets.length - 1"
            :loading="isBusy(`video:move:${asset.id}`)"
            @click.stop="emit('move', asset, 1)"
          />
          <v-btn
            size="small"
            color="error"
            variant="text"
            class="video-library-action video-library-action--danger"
            icon="mdi-trash-can-outline"
            :loading="isBusy(`video:delete:${asset.id}`)"
            @click.stop="emit('remove', asset)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-library-list {
  display: grid;
  gap: 0.45rem;
}

.video-library-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 0.68rem;
  align-items: stretch;
  padding: 0.62rem;
  border-radius: 15px;
  background: rgba(12, 20, 30, 0.34);
  border: 1px solid rgba(160, 194, 226, 0.06);
  min-width: 0;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.video-library-item:hover {
  border-color: rgba(102, 215, 231, 0.1);
  background: rgba(15, 24, 35, 0.44);
}

.video-library-item--active {
  border-color: rgba(102, 215, 231, 0.14);
  background: rgba(16, 27, 39, 0.5);
}

.video-library-item__thumb {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 64px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(24, 35, 48, 0.56), rgba(16, 25, 37, 0.62));
  border: 1px solid rgba(255, 255, 255, 0.025);
  overflow: hidden;
}

.video-library-item__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: rgba(160, 193, 224, 0.48);
}

.video-library-item__order {
  position: absolute;
  top: 0.34rem;
  left: 0.34rem;
  display: grid;
  place-items: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(7, 12, 18, 0.42);
  color: rgba(239, 245, 250, 0.7);
  font-size: 0.62rem;
  font-weight: 700;
}

.video-library-item__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.4rem;
}

.video-library-item__content {
  min-width: 0;
  display: grid;
  gap: 0.22rem;
}

.video-library-item__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.55rem;
  min-width: 0;
}

.video-library-item__title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.92rem;
  font-weight: 620;
  line-height: 1.2;
}

.video-library-item__badge {
  flex: 0 0 auto;
  padding: 0.18rem 0.38rem;
  border-radius: 999px;
  background: rgba(70, 206, 182, 0.16);
  color: rgba(150, 237, 198, 0.96);
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.1;
}

.video-library-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.24rem;
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.71rem;
  line-height: 1.25;
}

.video-library-item__actions {
  display: flex;
  justify-content: flex-start;
  gap: 0.12rem;
  min-width: 0;
}

.video-library-action {
  opacity: 0.78;
}

:deep(.video-library-action.v-btn) {
  min-width: 1.85rem;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
}

:deep(.video-library-action:hover) {
  background: rgba(255, 255, 255, 0.045);
  opacity: 1;
}

.video-library-action--danger {
  opacity: 0.72;
}

@media (max-width: 959px) {
  .video-library-item {
    grid-template-columns: 66px minmax(0, 1fr);
  }

  .video-library-item__thumb {
    min-height: 60px;
  }

  .video-library-item__actions {
    justify-content: flex-start;
  }
}
</style>
