<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AdminVisualizerPresetList from '../../components/admin/AdminVisualizerPresetList.vue'
import { visualizerPresetLabels } from '../../constants/visualizerPresets'
import { useAdminVisualizerPresetSequence } from '../../composables/useAdminVisualizerPresetSequence'
import { useAdminAlert } from '../../stores/adminAlert'
import { useVisualizerStore } from '../../stores/visualizer'

const adminAlert = useAdminAlert()
const visualizerStore = useVisualizerStore()
const now = ref(Date.now())
let countdownTimer: number | undefined

const {
  busyActions,
  orderedPresets,
  skippedPresets,
  initializeVisualizerSequence,
  movePreset,
  setActivePreset,
  toggleSkippedPreset,
  setAutoCycleIntervalMinutes,
} = useAdminVisualizerPresetSequence()

const autoCycleIntervalOptions = computed(() =>
  Array.from({ length: 26 }, (_, index) => {
    const value = index + 5
    return {
      title: `${value} min`,
      value,
    }
  }),
)

const autoCycleIntervalMinutes = computed({
  get: () => Math.max(5, Math.min(30, Math.round(visualizerStore.autoCycleIntervalSeconds / 60))),
  set: (value: number) => {
    void setAutoCycleIntervalMinutes(value)
  },
})

const presetCountLabel = computed(() => {
  const count = orderedPresets.value.length
  if (count === 1) {
    return '1 Stil'
  }
  return `${count} Stile`
})

const activePresetLabel = computed(
  () => visualizerPresetLabels[visualizerStore.activePreset] ?? visualizerStore.activePreset,
)

const libraryMetaLabel = computed(() => `${presetCountLabel.value} · Aktiv: ${activePresetLabel.value}`)

const activeBadgeLabel = computed(() => {
  if (!visualizerStore.autoCycleEnabled) {
    return 'Aktiv'
  }

  const updatedAt = visualizerStore.updatedAt ? Date.parse(visualizerStore.updatedAt) : Number.NaN
  if (!Number.isFinite(updatedAt)) {
    return `Aktiv · ${formatRemainingTime(visualizerStore.autoCycleIntervalSeconds)}`
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.value - updatedAt) / 1000))
  const remainingSeconds = Math.max(0, visualizerStore.autoCycleIntervalSeconds - elapsedSeconds)
  return `Aktiv · ${formatRemainingTime(remainingSeconds)}`
})

onMounted(async () => {
  countdownTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)

  try {
    await initializeVisualizerSequence()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Visualizer-Reihenfolge konnte nicht geladen werden',
    )
  }
})

onBeforeUnmount(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }
})

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>

<template>
  <section class="video-manager-shell">
    <div class="video-manager-stack">
      <section class="video-manager-heading">
        <div class="video-manager-heading__topline">
          <div class="video-manager-heading__copy">
            <div class="video-manager-heading__title">Visualizer</div>
            <div class="video-manager-heading__meta">{{ libraryMetaLabel }}</div>
          </div>
          <div class="video-manager-heading__actions">
            <div class="video-manager-heading__interval">
              <div class="video-manager-heading__interval-label">Stilwechsel</div>
              <v-select
                v-model="autoCycleIntervalMinutes"
                class="video-manager-heading__interval-select"
                :items="autoCycleIntervalOptions"
                item-title="title"
                item-value="value"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="video-manager-library">
        <AdminVisualizerPresetList
          v-if="orderedPresets.length"
          :presets="orderedPresets"
          :active-preset="visualizerStore.activePreset"
          :active-badge-label="activeBadgeLabel"
          :skipped-presets="skippedPresets"
          :busy-actions="busyActions"
          @select="setActivePreset"
          @move="movePreset"
          @toggle-skip="toggleSkippedPreset"
        />
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

.video-manager-heading__interval {
  display: grid;
  gap: 0.35rem;
  width: 10.25rem;
}

.video-manager-heading__interval-label {
  color: rgba(208, 220, 232, 0.6);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.2;
}

.video-manager-heading__interval-select {
  min-width: 0;
}

.video-manager-heading__interval-select :deep(.v-field) {
  min-height: 2.92rem;
  border-radius: 14px;
  background: rgba(13, 22, 33, 0.78);
  box-shadow: inset 0 0 0 1px rgba(126, 189, 226, 0.12);
}

.video-manager-heading__interval-select :deep(.v-field__outline) {
  display: none;
}

.video-manager-heading__interval-select :deep(.v-field__input) {
  padding-top: 0;
  padding-bottom: 0;
  color: rgba(240, 246, 252, 0.96);
  font-weight: 620;
}

.video-manager-heading__interval-select :deep(.v-select__selection-text) {
  color: rgba(240, 246, 252, 0.96);
}

@media (max-width: 959px) {
  .video-manager-stack {
    gap: 0.9rem;
  }

  .video-manager-stack > * {
    padding-inline: 0.75rem;
  }
}

@media (max-width: 460px) {
  .video-manager-heading__topline {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .video-manager-heading__actions {
    width: 100%;
    flex-shrink: 1;
  }

  .video-manager-heading__interval {
    width: 10.25rem;
  }
}
</style>
