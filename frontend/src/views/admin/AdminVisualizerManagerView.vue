<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AdminVisualizerPresetList from '../../components/admin/AdminVisualizerPresetList.vue'
import { visualizerPresetLabels } from '../../constants/visualizerPresets'
import { useAdminVisualizerPresetSequence } from '../../composables/useAdminVisualizerPresetSequence'
import { useAdminAlert } from '../../stores/adminAlert'
import { useVisualizerStore } from '../../stores/visualizer'

const adminAlert = useAdminAlert()
const visualizerStore = useVisualizerStore()

const {
  busyActions,
  orderedPresets,
  skippedPresets,
  initializeVisualizerSequence,
  movePreset,
  setActivePreset,
  toggleSkippedPreset,
} = useAdminVisualizerPresetSequence()

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

onMounted(async () => {
  try {
    await initializeVisualizerSequence()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Visualizer-Reihenfolge konnte nicht geladen werden',
    )
  }
})
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
            <v-btn
              color="primary"
              variant="outlined"
              class="video-manager-heading__upload video-manager-heading__upload--ghost"
              prepend-icon="mdi-upload"
              tabindex="-1"
              aria-hidden="true"
            >
              Video hochladen
            </v-btn>
          </div>
        </div>
      </section>

      <section class="video-manager-library">
        <AdminVisualizerPresetList
          v-if="orderedPresets.length"
          :presets="orderedPresets"
          :active-preset="visualizerStore.activePreset"
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

.video-manager-heading__upload--ghost {
  visibility: hidden;
  pointer-events: none;
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
    flex-shrink: 1;
  }

  .video-manager-heading__upload {
    width: auto;
  }
}
</style>
