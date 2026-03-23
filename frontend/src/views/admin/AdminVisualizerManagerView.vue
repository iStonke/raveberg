<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AdminVisualizerPresetList from '../../components/admin/AdminVisualizerPresetList.vue'
import { visualizerPresetLabels } from '../../constants/visualizerPresets'
import { useAdminVisualizerPresetSequence } from '../../composables/useAdminVisualizerPresetSequence'
import type { VisualizerPreset } from '../../services/api'
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

const presetCountDisplay = computed(() => String(orderedPresets.value.length).padStart(2, '0'))

const rotationPresets = computed(() => {
  const activePresets = orderedPresets.value.filter((preset) => !skippedPresets.value.includes(preset))
  return activePresets.length ? activePresets : [...orderedPresets.value]
})

function resolveNextRotatingPreset(startPreset: VisualizerPreset) {
  if (!orderedPresets.value.length) {
    return visualizerStore.activePreset
  }

  const startIndex = orderedPresets.value.indexOf(startPreset)
  for (let offset = 1; offset <= orderedPresets.value.length; offset += 1) {
    const candidate = orderedPresets.value[(Math.max(startIndex, 0) + offset) % orderedPresets.value.length]
    if (!skippedPresets.value.includes(candidate)) {
      return candidate
    }
  }

  return orderedPresets.value[0]
}

const cycleProgress = computed(() => {
  const intervalSeconds = Math.max(1, Math.floor(visualizerStore.autoCycleIntervalSeconds))
  const updatedAt = visualizerStore.updatedAt ? Date.parse(visualizerStore.updatedAt) : Number.NaN

  if (!Number.isFinite(updatedAt)) {
    return {
      cyclesElapsed: 0,
      remainingSeconds: intervalSeconds,
    }
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.value - updatedAt) / 1000))
  return {
    cyclesElapsed: Math.floor(elapsedSeconds / intervalSeconds),
    remainingSeconds: intervalSeconds - (elapsedSeconds % intervalSeconds || 0),
  }
})

const displayedActivePreset = computed(() => {
  if (!visualizerStore.autoCycleEnabled || !rotationPresets.value.length) {
    return visualizerStore.activePreset
  }

  if (cycleProgress.value.cyclesElapsed <= 0) {
    return visualizerStore.activePreset
  }

  if (rotationPresets.value.includes(visualizerStore.activePreset)) {
    const currentIndex = rotationPresets.value.indexOf(visualizerStore.activePreset)
    const nextIndex = (currentIndex + cycleProgress.value.cyclesElapsed) % rotationPresets.value.length
    return rotationPresets.value[nextIndex]
  }

  const nextPreset = resolveNextRotatingPreset(visualizerStore.activePreset)
  if (cycleProgress.value.cyclesElapsed === 1) {
    return nextPreset
  }

  const nextIndex = rotationPresets.value.indexOf(nextPreset)
  if (nextIndex < 0) {
    return nextPreset
  }

  return rotationPresets.value[(nextIndex + cycleProgress.value.cyclesElapsed - 1) % rotationPresets.value.length]
})

const activePresetLabel = computed(
  () => visualizerPresetLabels[displayedActivePreset.value] ?? displayedActivePreset.value,
)

const libraryMetaLabel = computed(() => `${presetCountLabel.value} · Aktiv: ${activePresetLabel.value}`)

const activeBadgeLabel = computed(() => {
  if (!visualizerStore.autoCycleEnabled) {
    return 'Aktiv'
  }

  return `Aktiv · ${formatRemainingTime(cycleProgress.value.remainingSeconds)}`
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
        <div class="app-shell settings-content-shell--header">
          <v-row class="settings-subpage-grid app-content-grid">
            <v-col cols="12">
              <section class="subpage-header-hero">
                <div class="subpage-header-top">
                  <router-link
                    :to="{ name: 'admin-dashboard', hash: '#modus' }"
                    class="subpage-back-button"
                  >
                    <v-icon icon="mdi-arrow-left" size="18" class="subpage-back-button__icon" />
                    <span>Zurück</span>
                  </router-link>
                </div>

                <div class="subpage-hero-main">
                  <div class="subpage-hero-orb" aria-hidden="true">
                    <div class="subpage-hero-orb__halo" />
                    <div class="subpage-hero-orb__core">
                      <div class="subpage-hero-orb__content">
                        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--1" />
                        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--2" />
                        <span class="subpage-hero-orb__cloud subpage-hero-orb__cloud--3" />
                      </div>
                    </div>
                  </div>

                  <section class="subpage-title-block">
                    <div class="video-manager-heading__title">{{ presetCountDisplay }} Visualizer</div>
                  </section>

                  <div
                    v-if="visualizerStore.autoCycleEnabled"
                    class="video-manager-heading__actions"
                  >
                    <div class="video-manager-heading__interval">
                      <div class="video-manager-heading__interval-label">Stilwechsel alle</div>
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
        <div class="app-shell settings-content-shell--content">
          <v-row class="settings-subpage-grid app-content-grid">
            <v-col cols="12">
              <section class="video-manager-library visualizer-list">
                <AdminVisualizerPresetList
                  v-if="orderedPresets.length"
                  :presets="orderedPresets"
                  :active-preset="displayedActivePreset"
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

.subpage-header-hero {
  position: relative;
  display: grid;
  gap: 0.62rem;
}

.subpage-header-hero::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 2.9rem;
  width: 14rem;
  height: 6.5rem;
  transform: translateX(-50%);
  pointer-events: none;
  background:
    radial-gradient(circle at center, rgba(74, 194, 255, 0.12), rgba(74, 194, 255, 0) 72%);
  filter: blur(18px);
  opacity: 0.88;
}

.subpage-header-top {
  display: flex;
  align-items: center;
}

.subpage-back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.2rem;
  padding: 0 0.76rem;
  border-radius: 14px;
  border: 1px solid rgba(126, 182, 222, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
  color: rgba(228, 236, 246, 0.82);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 560;
  letter-spacing: 0;
  line-height: 1.2;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.subpage-back-button:hover {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.024));
  border-color: rgba(120, 170, 220, 0.2);
  color: rgba(241, 246, 252, 0.96);
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
  gap: 0.22rem;
  justify-items: center;
  text-align: center;
}

.subpage-hero-main {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.72rem;
  padding-top: 0.08rem;
}

.subpage-hero-orb {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  display: grid;
  place-items: center;
}

.subpage-hero-orb__halo {
  position: absolute;
  inset: 0.2rem;
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 34%, rgba(129, 214, 255, 0.2), transparent 42%),
    radial-gradient(circle at 50% 68%, rgba(39, 93, 176, 0.18), transparent 70%);
  filter: blur(14px);
  opacity: 0.72;
}

.subpage-hero-orb__core {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  border: 1px solid rgba(166, 203, 232, 0.16);
  background:
    radial-gradient(circle at 50% 34%, rgba(84, 116, 165, 0.32), rgba(20, 32, 48, 0.06) 34%),
    linear-gradient(180deg, rgba(23, 34, 49, 0.96), rgba(10, 17, 27, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 -10px 18px rgba(0, 0, 0, 0.2),
    0 14px 30px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.subpage-hero-orb__content {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at 28% 30%, rgba(92, 228, 255, 0.46), transparent 48%),
    radial-gradient(circle at 72% 34%, rgba(167, 92, 255, 0.36), transparent 52%),
    radial-gradient(circle at 52% 76%, rgba(255, 102, 186, 0.34), transparent 48%),
    linear-gradient(160deg, rgba(42, 112, 210, 0.72), rgba(49, 22, 122, 0.82) 54%, rgba(150, 34, 107, 0.74));
  animation: subpageHeroOrbContentPulse 7.2s ease-in-out infinite;
  transform-origin: center;
}

.subpage-hero-orb__content::before,
.subpage-hero-orb__content::after {
  content: '';
  position: absolute;
  inset: -18%;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(18px);
}

.subpage-hero-orb__content::before {
  background:
    radial-gradient(circle at 34% 32%, rgba(88, 237, 255, 0.34), transparent 34%),
    radial-gradient(circle at 64% 70%, rgba(255, 114, 198, 0.26), transparent 38%);
  opacity: 0.82;
  animation: subpageHeroOrbWashA 9.8s ease-in-out infinite;
}

.subpage-hero-orb__content::after {
  background:
    radial-gradient(circle at 68% 28%, rgba(170, 108, 255, 0.3), transparent 36%),
    radial-gradient(circle at 28% 74%, rgba(74, 163, 255, 0.24), transparent 42%);
  opacity: 0.78;
  animation: subpageHeroOrbWashB 11.2s ease-in-out infinite;
}

.subpage-hero-orb__cloud {
  position: absolute;
  border-radius: 999px;
  filter: blur(14px);
  mix-blend-mode: screen;
  pointer-events: none;
}

.subpage-hero-orb__cloud--1 {
  top: -0.9rem;
  left: -1.1rem;
  width: 5.8rem;
  height: 5.2rem;
  background:
    radial-gradient(circle at 40% 46%, rgba(86, 232, 255, 0.96), rgba(86, 232, 255, 0.3) 58%, transparent 82%);
  opacity: 0.78;
  animation: subpageHeroOrbCloudA 7.4s ease-in-out infinite;
}

.subpage-hero-orb__cloud--2 {
  right: -1.05rem;
  bottom: -0.9rem;
  width: 5.6rem;
  height: 5.45rem;
  background:
    radial-gradient(circle at 54% 46%, rgba(162, 98, 255, 0.88), rgba(162, 98, 255, 0.26) 58%, transparent 80%);
  opacity: 0.7;
  animation: subpageHeroOrbCloudB 8.2s ease-in-out infinite;
}

.subpage-hero-orb__cloud--3 {
  left: -0.4rem;
  bottom: -1.2rem;
  width: 5.3rem;
  height: 4.8rem;
  background:
    radial-gradient(circle at 48% 48%, rgba(255, 116, 191, 0.84), rgba(255, 116, 191, 0.24) 56%, transparent 80%);
  opacity: 0.66;
  animation: subpageHeroOrbCloudC 9.6s ease-in-out infinite;
  animation-delay: 0.5s;
}

@keyframes subpageHeroOrbContentPulse {
  0% {
    transform: scale(1);
    opacity: 0.94;
  }

  50% {
    transform: scale(1.03);
    opacity: 1;
  }

  100% {
    transform: scale(1);
    opacity: 0.94;
  }
}

@keyframes subpageHeroOrbCloudA {
  0% {
    transform: translate3d(-14px, 10px, 0) scale(1);
    opacity: 0.66;
  }

  50% {
    transform: translate3d(18px, -20px, 0) scale(1.18);
    opacity: 0.94;
  }

  100% {
    transform: translate3d(-14px, 10px, 0) scale(1);
    opacity: 0.66;
  }
}

@keyframes subpageHeroOrbCloudB {
  0% {
    transform: translate3d(15px, -12px, 0) scale(1);
    opacity: 0.58;
  }

  50% {
    transform: translate3d(-18px, 16px, 0) scale(1.2);
    opacity: 0.88;
  }

  100% {
    transform: translate3d(15px, -12px, 0) scale(1);
    opacity: 0.58;
  }
}

@keyframes subpageHeroOrbCloudC {
  0% {
    transform: translate3d(-12px, 12px, 0) scale(0.98);
    opacity: 0.52;
  }

  50% {
    transform: translate3d(18px, -18px, 0) scale(1.22);
    opacity: 0.84;
  }

  100% {
    transform: translate3d(-12px, 12px, 0) scale(0.98);
    opacity: 0.52;
  }
}

@keyframes subpageHeroOrbWashA {
  0% {
    transform: translate3d(-6px, -4px, 0) scale(1);
    opacity: 0.72;
  }

  50% {
    transform: translate3d(8px, 6px, 0) scale(1.08);
    opacity: 0.96;
  }

  100% {
    transform: translate3d(-6px, -4px, 0) scale(1);
    opacity: 0.72;
  }
}

@keyframes subpageHeroOrbWashB {
  0% {
    transform: translate3d(7px, 5px, 0) scale(1.02);
    opacity: 0.66;
  }

  50% {
    transform: translate3d(-9px, -8px, 0) scale(1.1);
    opacity: 0.9;
  }

  100% {
    transform: translate3d(7px, 5px, 0) scale(1.02);
    opacity: 0.66;
  }
}

.video-manager-library {
  display: grid;
  gap: 0.7rem;
}

.visualizer-list {
  margin-top: 0;
}

.video-manager-heading__title {
  color: rgba(245, 249, 255, 0.98);
  font-size: 1.46rem;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.video-manager-heading__meta {
  color: rgba(208, 220, 232, 0.6);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.28;
  max-width: 28rem;
}

.video-manager-heading__actions {
  display: grid;
  justify-items: center;
  width: 100%;
}

.video-manager-heading__interval {
  display: grid;
  gap: 0.3rem;
  width: min(10.25rem, 100%);
  justify-items: center;
}

.video-manager-heading__interval-label {
  color: rgba(188, 205, 221, 0.58);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.video-manager-heading__interval-select {
  min-width: 0;
  width: 100%;
}

.video-manager-heading__interval-select :deep(.v-field) {
  min-height: 2.75rem;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.012));
  box-shadow: inset 0 0 0 1px rgba(120, 170, 220, 0.08);
}

.video-manager-heading__interval-select :deep(.v-field__outline) {
  display: none;
}

.video-manager-heading__interval-select :deep(.v-field__input) {
  min-height: 2.75rem;
  padding-top: 0;
  padding-bottom: 0;
  color: rgba(230, 238, 250, 0.84);
  font-size: 1rem;
  font-weight: 500;
}

.video-manager-heading__interval-select :deep(.v-select__selection-text) {
  color: rgba(230, 238, 250, 0.84);
}

.video-manager-heading__interval-select :deep(.v-field__append-inner) {
  color: rgba(197, 212, 228, 0.6);
}

.video-manager-heading__interval-select :deep(.mdi-menu-down) {
  opacity: 0.6;
  transform: scale(0.9);
}

.video-manager-heading__interval-select :deep(.v-field:hover) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.024), rgba(255, 255, 255, 0.018));
  box-shadow: inset 0 0 0 1px rgba(120, 170, 220, 0.12);
}

.video-manager-heading__interval-select :deep(.v-field--focused) {
  box-shadow:
    inset 0 0 0 1px rgba(120, 170, 220, 0.22),
    0 0 0 1px rgba(120, 170, 220, 0.1);
}

@media (max-width: 760px) {
  .settings-content-shell--header {
    padding-top: 0.78rem;
    padding-bottom: 0.75rem;
  }

  .subpage-header-hero {
    gap: 0.56rem;
  }

  .subpage-header-hero::before {
    top: 2.7rem;
    width: 11.5rem;
    height: 5.4rem;
  }

  .subpage-header-top {
    margin-bottom: 0;
  }

  .subpage-back-button {
    min-height: 2.2rem;
    padding-inline: 0.74rem;
    font-size: 0.92rem;
  }

  .subpage-hero-main {
    gap: 0.6rem;
  }

  .subpage-hero-orb {
    width: 5rem;
    height: 5rem;
  }

  .video-manager-heading__title {
    font-size: 1.34rem;
  }

  .video-manager-heading__meta {
    font-size: 0.78rem;
  }

}

@media (prefers-reduced-motion: reduce) {
  .subpage-hero-orb__content,
  .subpage-hero-orb__cloud {
    animation: none !important;
    transition: none !important;
  }
}
</style>
