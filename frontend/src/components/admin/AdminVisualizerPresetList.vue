<script setup lang="ts">
import type { PropType } from 'vue'

import { visualizerPresetLabels } from '../../constants/visualizerPresets'
import type { VisualizerPreset } from '../../services/api'

const props = defineProps({
  presets: {
    type: Array as PropType<VisualizerPreset[]>,
    required: true,
  },
  activePreset: {
    type: String as PropType<VisualizerPreset>,
    required: true,
  },
  activeBadgeLabel: {
    type: String,
    default: 'Aktiv',
  },
  skippedPresets: {
    type: Array as PropType<VisualizerPreset[]>,
    default: () => [],
  },
  busyActions: {
    type: Object as PropType<Record<string, boolean>>,
    default: () => ({}),
  },
})

const emit = defineEmits<{
  select: [preset: VisualizerPreset]
  move: [preset: VisualizerPreset, direction: -1 | 1]
  toggleSkip: [preset: VisualizerPreset]
}>()

function isBusy(key: string) {
  return Boolean(props.busyActions[key])
}

function isSkipped(preset: VisualizerPreset) {
  return props.skippedPresets.includes(preset)
}
</script>

<template>
  <div v-if="presets.length" class="video-library-list">
    <div
      v-for="(preset, index) in presets"
      :key="preset"
      class="video-library-item"
      :class="{
        'video-library-item--active': activePreset === preset,
        'video-library-item--skipped': isSkipped(preset),
      }"
      @click="emit('select', preset)"
    >
      <div class="video-library-item__thumb">
        <div class="video-library-item__order">{{ index + 1 }}</div>
        <div class="video-library-item__placeholder">
          <v-icon icon="mdi-animation-play-outline" size="24" />
        </div>
      </div>

      <div class="video-library-item__body">
        <div class="video-library-item__content">
          <div class="video-library-item__title-row">
            <div class="video-library-item__title">{{ visualizerPresetLabels[preset] ?? preset }}</div>
            <div v-if="activePreset === preset" class="video-library-item__badge">{{ activeBadgeLabel }}</div>
            <div v-else-if="isSkipped(preset)" class="video-library-item__badge video-library-item__badge--skipped">
              Überspringen
            </div>
          </div>
          <div class="video-library-item__meta">
            <span>{{ preset }}</span>
          </div>
        </div>

        <div class="video-library-item__actions">
          <v-btn
            size="small"
            variant="text"
            class="video-library-action"
            :icon="isSkipped(preset) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :loading="isBusy(`visualizer:skip:${preset}`)"
            @click.stop="emit('toggleSkip', preset)"
          />
          <v-btn
            size="small"
            variant="text"
            class="video-library-action"
            icon="mdi-arrow-up"
            :disabled="index === 0"
            :loading="isBusy(`visualizer:move:${preset}`)"
            @click.stop="emit('move', preset, -1)"
          />
          <v-btn
            size="small"
            variant="text"
            class="video-library-action"
            icon="mdi-arrow-down"
            :disabled="index === presets.length - 1"
            :loading="isBusy(`visualizer:move:${preset}`)"
            @click.stop="emit('move', preset, 1)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-library-list {
  display: grid;
  gap: 0.7rem;
}

.video-library-item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 0.68rem;
  align-items: stretch;
  padding: 0.62rem;
  border-radius: 15px;
  background:
    radial-gradient(circle at top right, rgba(85, 198, 255, 0.1), transparent 42%),
    linear-gradient(180deg, rgba(20, 31, 44, 0.88), rgba(12, 20, 31, 0.94));
  border: 1px solid rgba(160, 194, 226, 0.14);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
  min-width: 0;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.video-library-item--active {
  border-color: rgba(102, 215, 231, 0.3);
  background:
    radial-gradient(circle at top right, rgba(88, 216, 242, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(25, 40, 56, 0.98), rgba(15, 27, 40, 0.98));
  box-shadow:
    0 16px 30px rgba(4, 12, 20, 0.28),
    0 0 0 1px rgba(91, 228, 242, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

.video-library-item--skipped {
  opacity: 0.74;
}

.video-library-item__thumb {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 64px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 24%, rgba(109, 214, 255, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(30, 44, 60, 0.86), rgba(18, 28, 41, 0.92));
  border: 1px solid rgba(255, 255, 255, 0.06);
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

.video-library-item__badge--skipped {
  background: rgba(167, 184, 203, 0.12);
  color: rgba(212, 222, 232, 0.84);
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
