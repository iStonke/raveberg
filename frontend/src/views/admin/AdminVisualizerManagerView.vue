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
const scrollArea = ref<HTMLElement | null>(null)
const headerScrolled = ref(false)
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

function handleScroll() {
  headerScrolled.value = (scrollArea.value?.scrollTop ?? 0) > 6
}

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
  <section class="settings-page">
    <div ref="scrollArea" class="settings-scroll-area" @scroll.passive="handleScroll">
      <section
        class="settings-subpage-sticky-header"
        :class="{ 'is-scrolled': headerScrolled }"
      >
        <div class="settings-content-shell settings-content-shell--header">
          <v-row class="settings-subpage-grid settings-content-grid">
            <v-col cols="12">
              <div class="subpage-header-top">
                <router-link
                  :to="{ name: 'admin-dashboard', hash: '#modus' }"
                  class="subpage-back-button"
                >
                  <v-icon icon="mdi-arrow-left" size="18" class="subpage-back-button__icon" />
                  <span>Zurück</span>
                </router-link>
              </div>

              <section class="subpage-title-block">
                <div class="video-manager-heading__topline">
                  <div class="video-manager-heading__copy">
                    <div class="video-manager-heading__title">Visualizer</div>
                    <div class="video-manager-heading__meta">{{ libraryMetaLabel }}</div>
                  </div>
                  <div class="video-manager-heading__actions">
                    <div
                      v-if="visualizerStore.autoCycleEnabled"
                      class="video-manager-heading__interval"
                    >
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
            </v-col>
          </v-row>
        </div>
      </section>

      <main class="settings-subpage-content">
        <div class="settings-content-shell settings-content-shell--content">
          <v-row class="settings-subpage-grid settings-content-grid">
            <v-col cols="12">
              <section class="video-manager-library visualizer-list">
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
            </v-col>
          </v-row>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-scroll-area {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.settings-subpage-content {
  padding-top: 1rem;
  padding-bottom: 2.5rem;
  padding-left: 0;
  padding-right: 0;
}

.settings-subpage-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  padding: 0;
  background:
    linear-gradient(
      180deg,
      rgba(4, 10, 18, 0.99) 0%,
      rgba(5, 14, 28, 0.975) 72%,
      rgba(5, 14, 28, 0.95) 100%
    );
  border-bottom: 1px solid rgba(120, 170, 220, 0.14);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.settings-subpage-sticky-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -12px;
  height: 12px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0) 100%);
}

.settings-subpage-sticky-header.is-scrolled {
  background:
    linear-gradient(
      180deg,
      rgba(4, 10, 18, 0.995) 0%,
      rgba(5, 14, 28, 0.985) 72%,
      rgba(5, 14, 28, 0.965) 100%
    );
  border-bottom-color: rgba(120, 170, 220, 0.18);
  box-shadow:
    0 14px 28px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.settings-content-shell--header {
  padding-top: 0.9rem;
  padding-bottom: 0.9rem;
}

.settings-content-shell--content {
  padding-bottom: 0;
}

.settings-subpage-grid {
  margin: 0;
}

.subpage-header-top {
  display: flex;
  align-items: center;
  margin-bottom: 0.85rem;
}

.subpage-back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.35rem;
  padding: 0 0.82rem;
  border-radius: 14px;
  border: 1px solid rgba(120, 170, 220, 0.12);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(225, 233, 244, 0.78);
  text-decoration: none;
  font-size: 0.96rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.2;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.subpage-back-button:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(120, 170, 220, 0.18);
  color: rgba(240, 245, 250, 0.94);
}

.subpage-back-button:active {
  transform: translateY(1px);
}

.subpage-back-button__icon {
  color: currentColor;
  opacity: 0.9;
}

.subpage-title-block {
  display: grid;
  gap: 0.34rem;
}

.video-manager-library {
  display: grid;
  gap: 0.7rem;
}

.visualizer-list {
  margin-top: 0;
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
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.1;
}

.video-manager-heading__meta {
  color: rgba(208, 220, 232, 0.6);
  font-size: 0.875rem;
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

@media (max-width: 760px) {
  .settings-content-shell--header {
    padding-top: 0.78rem;
    padding-bottom: 0.75rem;
  }

  .subpage-header-top {
    margin-bottom: 0.78rem;
  }

  .subpage-back-button {
    min-height: 2.2rem;
    padding-inline: 0.74rem;
    font-size: 0.92rem;
  }

  .video-manager-heading__topline {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .video-manager-heading__actions {
    width: 100%;
    flex-shrink: 1;
  }

  .video-manager-heading__interval {
    width: min(10.25rem, 100%);
  }
}
</style>
