<script setup lang="ts">
import type { AppMode } from '../../services/api'

type ModeOption = {
  label: string
  value: AppMode
}

const props = defineProps<{
  currentMode: AppMode
  modeOptions: ModeOption[]
  isBooting: boolean
  isSwitchingMode: boolean
}>()

const emit = defineEmits<{
  'switch-mode': [mode: AppMode]
}>()

function handleModeChange(value: AppMode | null) {
  if (!value || props.isBooting || props.isSwitchingMode || value === props.currentMode) {
    return
  }
  emit('switch-mode', value)
}

function modeIcon(mode: AppMode) {
  if (mode === 'blackout') return 'mdi-lightbulb-off-outline'
  if (mode === 'idle') return 'mdi-power-sleep'
  if (mode === 'visualizer') return 'mdi-chart-bubble'
  if (mode === 'selfie') return 'mdi-image-multiple-outline'
  return 'mdi-play-box-outline'
}
</script>

<template>
  <section class="admin-mode-stage">
    <div class="admin-mode-stage__grid" role="group" aria-label="Modusauswahl">
      <v-btn
        v-for="mode in modeOptions"
        :key="mode.value"
        class="admin-mode-stage__btn"
        :class="[
          `admin-mode-stage__btn--${mode.value}`,
          {
            'admin-mode-stage__btn--active': currentMode === mode.value,
            'admin-mode-stage__btn--inactive': currentMode !== mode.value,
          },
        ]"
        variant="flat"
        @click="handleModeChange(mode.value)"
      >
        <span class="admin-mode-stage__content">
          <v-icon :icon="modeIcon(mode.value)" size="16" />
          <span>{{ mode.label }}</span>
        </span>
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
.admin-mode-stage {
  width: 100%;
  min-width: 0;
}

.admin-mode-stage__grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.82rem;
}

.admin-mode-stage__btn {
  width: 100%;
  min-width: 0;
  min-height: 3.95rem;
  padding-inline: 1.15rem;
  border-radius: 16px !important;
  color: rgba(221, 232, 242, 0.64);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.018),
    0 1px 0 rgba(255, 255, 255, 0.012);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease,
    color 160ms ease;
}

.admin-mode-stage__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.52rem;
  width: 100%;
  min-height: 100%;
  line-height: 1;
}

.admin-mode-stage__btn:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.admin-mode-stage__btn:active {
  transform: scale(0.985);
}

.admin-mode-stage__btn--active {
  color: #f8fbff;
  box-shadow:
    0 10px 20px rgba(6, 17, 26, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.025),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.admin-mode-stage__btn--inactive {
  background: rgba(255, 255, 255, 0.03) !important;
}

.admin-mode-stage__btn--blackout.admin-mode-stage__btn--active {
  border-color: rgba(215, 106, 106, 0.22);
  background: linear-gradient(180deg, rgba(108, 50, 55, 0.94), rgba(79, 36, 40, 0.94));
}

.admin-mode-stage__btn--idle.admin-mode-stage__btn--active {
  border-color: rgba(138, 153, 171, 0.2);
  background: linear-gradient(180deg, rgba(66, 79, 94, 0.94), rgba(49, 61, 74, 0.94));
}

.admin-mode-stage__btn--visualizer.admin-mode-stage__btn--active {
  border-color: rgba(105, 170, 230, 0.24);
  background: linear-gradient(180deg, rgba(69, 108, 149, 0.82), rgba(42, 70, 102, 0.82));
}

.admin-mode-stage__btn--selfie.admin-mode-stage__btn--active {
  border-color: rgba(84, 196, 175, 0.24);
  background: linear-gradient(180deg, rgba(52, 126, 116, 0.82), rgba(31, 91, 83, 0.82));
}

.admin-mode-stage__btn--video.admin-mode-stage__btn--active {
  border-color: rgba(214, 157, 104, 0.22);
  background: linear-gradient(180deg, rgba(164, 118, 72, 0.84), rgba(126, 82, 44, 0.84));
}

.admin-mode-stage :deep(.v-btn__overlay),
.admin-mode-stage :deep(.v-ripple__container),
.admin-mode-stage :deep(.v-btn__loader) {
  display: none !important;
  opacity: 0 !important;
}

@media (max-width: 720px) {
  .admin-mode-stage__grid {
    gap: 0.72rem;
  }

  .admin-mode-stage__btn {
    min-height: 3.7rem;
    border-radius: 15px !important;
    font-size: 0.92rem;
  }
}
</style>
