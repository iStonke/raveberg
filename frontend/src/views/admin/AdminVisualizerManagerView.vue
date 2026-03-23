<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AdminVisualizerPresetList from '../../components/admin/AdminVisualizerPresetList.vue'
import SubpageContent from '../../components/settings/subpage/SubpageContent.vue'
import SubpageHeader from '../../components/settings/subpage/SubpageHeader.vue'
import SubpageHero from '../../components/settings/subpage/SubpageHero.vue'
import SubpageLayout from '../../components/settings/subpage/SubpageLayout.vue'
import { useAdminVisualizerPresetSequence } from '../../composables/useAdminVisualizerPresetSequence'
import type { VisualizerPreset } from '../../services/api'
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
  <SubpageLayout>
    <template #header>
      <SubpageHeader
        :back-to="{ name: 'admin-dashboard', hash: '#modus' }"
        :title="`${presetCountDisplay} Visualizer`"
        variant="hero"
      >
        <template #hero>
          <SubpageHero />
        </template>

        <template #action>
          <div
            class="visualizer-header-interval"
            :class="{ 'visualizer-header-interval--disabled': !visualizerStore.autoCycleEnabled }"
          >
            <div class="visualizer-header-interval__label">
              {{ visualizerStore.autoCycleEnabled ? 'Stilwechsel alle' : 'Stilwechsel aus' }}
            </div>
            <v-select
              v-model="autoCycleIntervalMinutes"
              class="visualizer-header-interval__select"
              :items="autoCycleIntervalOptions"
              item-title="title"
              item-value="value"
              :disabled="!visualizerStore.autoCycleEnabled"
              hide-details
              variant="solo"
              density="comfortable"
            />
          </div>
        </template>
      </SubpageHeader>
    </template>

    <SubpageContent class="visualizer-content">
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
    </SubpageContent>
  </SubpageLayout>
</template>

<style scoped>
.visualizer-content {
  gap: 0;
}

.visualizer-header-interval {
  display: grid;
  gap: 0.3rem;
  width: min(10.25rem, 100%);
  justify-items: center;
}

.visualizer-header-interval__label {
  color: rgba(188, 205, 221, 0.58);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.visualizer-header-interval__select {
  min-width: 0;
  width: 100%;
}

.visualizer-header-interval--disabled .visualizer-header-interval__label {
  color: rgba(178, 194, 211, 0.58);
}

.visualizer-header-interval__select :deep(.v-field) {
  min-height: 2.75rem;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0.012));
  box-shadow: inset 0 0 0 1px rgba(120, 170, 220, 0.08);
}

.visualizer-header-interval__select :deep(.v-field__outline) {
  display: none;
}

.visualizer-header-interval__select :deep(.v-field__input) {
  min-height: 2.75rem;
  padding-top: 0;
  padding-bottom: 0;
  color: rgba(230, 238, 250, 0.84);
  font-size: 1rem;
  font-weight: 500;
}

.visualizer-header-interval__select :deep(.v-select__selection-text) {
  color: rgba(230, 238, 250, 0.84);
}

.visualizer-header-interval__select :deep(.v-field__append-inner) {
  color: rgba(197, 212, 228, 0.6);
}

.visualizer-header-interval__select :deep(.mdi-menu-down) {
  opacity: 0.6;
  transform: scale(0.9);
}

.visualizer-header-interval--disabled .visualizer-header-interval__select :deep(.v-field) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.014));
  box-shadow: inset 0 0 0 1px rgba(120, 170, 220, 0.09);
}

.visualizer-header-interval--disabled .visualizer-header-interval__select :deep(.v-field__input),
.visualizer-header-interval--disabled .visualizer-header-interval__select :deep(.v-select__selection-text),
.visualizer-header-interval--disabled .visualizer-header-interval__select :deep(.v-field__append-inner) {
  color: rgba(200, 213, 228, 0.6);
}

.visualizer-header-interval--disabled .visualizer-header-interval__select :deep(.mdi-menu-down) {
  opacity: 0.48;
}

.visualizer-header-interval__select :deep(.v-field:hover) {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.024), rgba(255, 255, 255, 0.018));
  box-shadow: inset 0 0 0 1px rgba(120, 170, 220, 0.12);
}

.visualizer-header-interval__select :deep(.v-field--focused) {
  box-shadow:
    inset 0 0 0 1px rgba(120, 170, 220, 0.22),
    0 0 0 1px rgba(120, 170, 220, 0.1);
}

@media (max-width: 760px) {
  .visualizer-header-interval {
    width: min(10.25rem, 100%);
  }
}
</style>
