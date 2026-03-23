<script setup lang="ts">
import type { AppMode } from '../../services/api'

type ModeOption = {
  label: string
  value: AppMode
}

type ContextAction = {
  id: string
  label: string
  color: 'primary' | 'secondary'
  loading: boolean
  disabled: boolean
  active?: boolean
}

const props = defineProps<{
  currentMode: AppMode
  modeOptions: ModeOption[]
  contextActions: ContextAction[]
  isBooting: boolean
  isSwitchingMode: boolean
}>()

const emit = defineEmits<{
  'switch-mode': [mode: AppMode]
  'run-action': [actionId: string]
}>()

function handleModeChange(value: AppMode | null) {
  if (!value || props.isBooting || props.isSwitchingMode || value === props.currentMode) {
    return
  }
  emit('switch-mode', value)
}

function actionIcon(actionId: string) {
  if (actionId === 'selfie:toggle') return 'mdi-pause-circle-outline'
  if (actionId === 'selfie:next') return 'mdi-skip-next-circle-outline'
  if (actionId === 'selfie:reload_pool') return 'mdi-refresh-circle'
  if (actionId === 'selfie:moderation') return 'mdi-shield-check-outline'
  if (actionId === 'selfie:shuffle') return 'mdi-shuffle-variant'
  if (actionId === 'selfie:vintage') return 'mdi-image-filter-vintage'
  if (actionId === 'selfie:overlay-mode') return 'mdi-layers-triple-outline'
  if (actionId === 'video:upload') return 'mdi-video-plus-outline'
  if (actionId === 'video:playlist') return 'mdi-playlist-play'
  if (actionId === 'video:vintage') return 'mdi-image-filter-vintage'
  if (actionId === 'video:transition') return 'mdi-transition'
  if (actionId === 'video:overlay-mode') return 'mdi-layers-triple-outline'
  if (actionId === 'visualizer:next-preset') return 'mdi-palette-swatch-outline'
  if (actionId === 'visualizer:auto-cycle') return 'mdi-autorenew'
  if (actionId === 'visualizer:overlay-mode') return 'mdi-layers-triple-outline'
  return 'mdi-lightning-bolt-outline'
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
  <section class="show-control-header">
    <div class="mode-block">
      <div class="mode-grid" role="group" aria-label="Modusauswahl">
        <v-btn
          v-for="mode in modeOptions"
          :key="mode.value"
          class="mode-grid__btn"
          :class="[
            `mode-grid__btn--${mode.value}`,
            {
              'mode-grid__btn--active': currentMode === mode.value,
              'mode-grid__btn--inactive': currentMode !== mode.value,
            },
          ]"
          variant="flat"
          @click="handleModeChange(mode.value)"
        >
          <span class="mode-grid__content">
            <v-icon :icon="modeIcon(mode.value)" size="16" />
            <span>{{ mode.label }}</span>
          </span>
        </v-btn>
      </div>
    </div>

    <div
      v-show="contextActions.length"
      class="context-actions-row"
      :class="`context-actions-row--${currentMode}`"
    >
      <div class="context-actions-title">Aktionen</div>
      <div class="context-actions-list">
        <v-btn
          v-for="action in contextActions"
          :key="action.id"
          variant="text"
          class="context-action-btn"
          :class="[
            `context-action-btn--${currentMode}`,
            {
              'context-action-btn--busy': action.loading,
              'context-action-btn--state-on': action.active === true,
              'context-action-btn--state-off': action.active === false,
            },
          ]"
          :prepend-icon="actionIcon(action.id)"
          :disabled="action.disabled || action.loading"
          @click="emit('run-action', action.id)"
        >
          {{ action.label }}
        </v-btn>
      </div>
    </div>
  </section>
</template>

<style scoped>
.show-control-header {
  display: grid;
  gap: 1.45rem;
  width: 100%;
  min-width: 0;
  margin-bottom: 0.9rem;
  padding: 0;
}

.mode-block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  gap: 0;
}

.context-actions-title {
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
}

.mode-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.82rem;
}

.mode-grid__btn {
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

.mode-grid__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.52rem;
  width: 100%;
  min-height: 100%;
  line-height: 1;
}

.mode-grid__btn:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.mode-grid__btn:active {
  transform: scale(0.985);
}

.mode-grid__btn--active {
  color: #f8fbff;
  box-shadow:
    0 10px 20px rgba(6, 17, 26, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.025),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.mode-grid__btn--inactive {
  background: rgba(255, 255, 255, 0.03) !important;
}

.mode-grid__btn--blackout.mode-grid__btn--active {
  border-color: rgba(215, 106, 106, 0.22);
  background: linear-gradient(180deg, rgba(108, 50, 55, 0.94), rgba(79, 36, 40, 0.94));
}

.mode-grid__btn--idle.mode-grid__btn--active {
  border-color: rgba(138, 153, 171, 0.2);
  background: linear-gradient(180deg, rgba(66, 79, 94, 0.94), rgba(49, 61, 74, 0.94));
}

.mode-grid__btn--visualizer.mode-grid__btn--active {
  border-color: rgba(105, 170, 230, 0.24);
  background: linear-gradient(180deg, rgba(69, 108, 149, 0.82), rgba(42, 70, 102, 0.82));
}

.mode-grid__btn--selfie.mode-grid__btn--active {
  border-color: rgba(84, 196, 175, 0.24);
  background: linear-gradient(180deg, rgba(52, 126, 116, 0.82), rgba(31, 91, 83, 0.82));
}

.mode-grid__btn--video.mode-grid__btn--active {
  border-color: rgba(214, 157, 104, 0.22);
  background: linear-gradient(180deg, rgba(164, 118, 72, 0.84), rgba(126, 82, 44, 0.84));
}

.context-actions-row {
  display: grid;
  gap: 0.72rem;
}

.context-actions-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  min-width: 0;
}

.context-actions-list > * {
  min-width: 0;
}

.context-action-btn {
  --action-text-inactive: rgba(231, 239, 246, 0.9);
  --action-border-inactive: rgba(156, 183, 214, 0.08);
  --action-bg-inactive: rgba(18, 28, 40, 0.16);
  --action-text-active: rgba(245, 250, 255, 0.98);
  --action-border-active: rgba(255, 255, 255, 0.18);
  --action-bg-active: rgba(44, 90, 140, 0.32);
  min-height: 2.8rem;
  padding-inline: 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--action-border-inactive);
  text-transform: none;
  font-weight: 650;
  font-size: 0.76rem;
  letter-spacing: 0.01em;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  justify-content: flex-start;
  text-align: left;
  white-space: normal;
  color: var(--action-text-inactive);
  background: var(--action-bg-inactive);
  transition:
    transform 150ms ease,
    box-shadow 180ms ease,
    background-color 160ms ease,
    color 160ms ease,
    border-color 160ms ease;
}

.context-action-btn:active {
  transform: scale(0.985);
}

.context-action-btn--busy {
  opacity: 0.72;
}

.context-action-btn--state-on {
  color: var(--action-text-active);
  background: var(--action-bg-active);
  border-color: var(--action-border-active);
  box-shadow:
    0 10px 20px rgba(6, 17, 26, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.context-action-btn--state-off {
  color: var(--action-text-inactive);
  background: var(--action-bg-inactive);
  border-color: var(--action-border-inactive);
  opacity: 0.88;
}

.show-control-header :deep(.v-btn__overlay),
.show-control-header :deep(.v-ripple__container),
.show-control-header :deep(.v-btn__loader) {
  display: none !important;
  opacity: 0 !important;
}

.context-actions-row--visualizer .context-actions-title {
  color: rgba(137, 189, 255, 0.84);
}

.context-actions-row--selfie .context-actions-title {
  color: rgba(108, 231, 206, 0.84);
}

.context-actions-row--video .context-actions-title {
  color: rgba(255, 191, 122, 0.84);
}

.context-actions-row--idle .context-actions-title {
  color: rgba(197, 208, 220, 0.74);
}

.context-actions-row--blackout .context-actions-title {
  color: rgba(255, 156, 156, 0.84);
}

.context-action-btn--visualizer {
  --action-text-inactive: rgba(199, 220, 245, 0.86);
  --action-border-inactive: rgba(86, 162, 255, 0.14);
  --action-bg-inactive: rgba(41, 89, 159, 0.14);
  --action-text-active: rgba(230, 240, 255, 0.98);
  --action-border-active: rgba(124, 190, 255, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(71, 122, 195, 0.42), rgba(42, 86, 153, 0.34));
}

.context-action-btn--selfie {
  --action-text-inactive: rgba(214, 245, 238, 0.86);
  --action-border-inactive: rgba(62, 214, 183, 0.14);
  --action-bg-inactive: rgba(27, 124, 108, 0.14);
  --action-text-active: rgba(233, 253, 248, 0.98);
  --action-border-active: rgba(98, 231, 202, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(46, 158, 139, 0.42), rgba(28, 114, 99, 0.34));
}

.context-action-btn--video {
  --action-text-inactive: rgba(245, 226, 208, 0.88);
  --action-border-inactive: rgba(255, 165, 86, 0.14);
  --action-bg-inactive: rgba(154, 82, 24, 0.14);
  --action-text-active: rgba(255, 240, 226, 0.98);
  --action-border-active: rgba(255, 188, 120, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(184, 112, 56, 0.42), rgba(145, 86, 38, 0.34));
}

.context-action-btn--idle {
  --action-text-inactive: rgba(229, 236, 244, 0.86);
  --action-border-inactive: rgba(144, 159, 178, 0.14);
  --action-bg-inactive: rgba(82, 96, 113, 0.14);
  --action-text-active: rgba(245, 249, 253, 0.98);
  --action-border-active: rgba(177, 191, 208, 0.24);
  --action-bg-active: linear-gradient(180deg, rgba(99, 114, 133, 0.4), rgba(78, 91, 108, 0.32));
}

.context-action-btn--blackout {
  --action-text-inactive: rgba(255, 226, 226, 0.9);
  --action-border-inactive: rgba(236, 106, 106, 0.14);
  --action-bg-inactive: rgba(149, 49, 49, 0.16);
  --action-text-active: rgba(255, 240, 240, 0.98);
  --action-border-active: rgba(244, 128, 128, 0.26);
  --action-bg-active: linear-gradient(180deg, rgba(166, 62, 62, 0.42), rgba(133, 48, 48, 0.34));
}

.context-action-btn :deep(.v-btn__content) {
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
  line-height: 1.24;
  overflow-wrap: anywhere;
}

.context-action-btn :deep(.v-btn__prepend) {
  flex: 0 0 auto;
}

.context-action-btn :deep(.v-icon) {
  flex-shrink: 0;
}

@media (max-width: 720px) {
  .mode-grid {
    gap: 0.72rem;
  }

  .mode-grid__btn {
    min-height: 3.7rem;
    border-radius: 15px !important;
    font-size: 0.92rem;
  }

  .show-control-header {
    gap: 1.15rem;
    margin-bottom: 0.75rem;
  }

  .context-actions-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .context-action-btn {
    min-height: 2.9rem;
    padding-inline: 0.92rem;
  }
}

@media (max-width: 560px) {
  .context-actions-list {
    grid-template-columns: 1fr;
  }
}
</style>
