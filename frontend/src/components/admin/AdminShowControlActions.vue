<script setup lang="ts">
import type { AppMode } from '../../services/api'

type ContextAction = {
  id: string
  label: string
  color: 'primary' | 'secondary'
  loading: boolean
  disabled: boolean
  active?: boolean
}

defineProps<{
  currentMode: AppMode
  contextActions: ContextAction[]
}>()

const emit = defineEmits<{
  'run-action': [actionId: string]
}>()

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
</script>

<template>
  <section
    v-if="contextActions.length"
    class="show-control-actions"
    :class="`show-control-actions--${currentMode}`"
  >
    <div class="show-control-actions__title">Aktionen</div>
    <div class="show-control-actions__list">
      <v-btn
        v-for="action in contextActions"
        :key="action.id"
        variant="text"
        class="show-control-actions__btn"
        :class="[
          `show-control-actions__btn--${currentMode}`,
          {
            'show-control-actions__btn--busy': action.loading,
            'show-control-actions__btn--state-on': action.active === true,
            'show-control-actions__btn--state-off': action.active === false,
          },
        ]"
        :prepend-icon="actionIcon(action.id)"
        :disabled="action.disabled || action.loading"
        @click="emit('run-action', action.id)"
      >
        {{ action.label }}
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
.show-control-actions {
  display: grid;
  gap: 0.72rem;
  width: 100%;
  min-width: 0;
  margin-bottom: 0.8rem;
}

.show-control-actions__title {
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
}

.show-control-actions__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  min-width: 0;
}

.show-control-actions__list > * {
  min-width: 0;
}

.show-control-actions__btn {
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

.show-control-actions__btn:active {
  transform: scale(0.985);
}

.show-control-actions__btn--busy {
  opacity: 0.72;
}

.show-control-actions__btn--state-on {
  color: var(--action-text-active);
  background: var(--action-bg-active);
  border-color: var(--action-border-active);
  box-shadow:
    0 10px 20px rgba(6, 17, 26, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.show-control-actions__btn--state-off {
  color: var(--action-text-inactive);
  background: var(--action-bg-inactive);
  border-color: var(--action-border-inactive);
  opacity: 0.88;
}

.show-control-actions--visualizer .show-control-actions__title {
  color: rgba(137, 189, 255, 0.84);
}

.show-control-actions--selfie .show-control-actions__title {
  color: rgba(108, 231, 206, 0.84);
}

.show-control-actions--video .show-control-actions__title {
  color: rgba(255, 191, 122, 0.84);
}

.show-control-actions--idle .show-control-actions__title {
  color: rgba(197, 208, 220, 0.74);
}

.show-control-actions--blackout .show-control-actions__title {
  color: rgba(255, 156, 156, 0.84);
}

.show-control-actions__btn--visualizer {
  --action-text-inactive: rgba(199, 220, 245, 0.86);
  --action-border-inactive: rgba(86, 162, 255, 0.14);
  --action-bg-inactive: rgba(41, 89, 159, 0.14);
  --action-text-active: rgba(230, 240, 255, 0.98);
  --action-border-active: rgba(124, 190, 255, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(71, 122, 195, 0.42), rgba(42, 86, 153, 0.34));
}

.show-control-actions__btn--selfie {
  --action-text-inactive: rgba(214, 245, 238, 0.86);
  --action-border-inactive: rgba(62, 214, 183, 0.14);
  --action-bg-inactive: rgba(27, 124, 108, 0.14);
  --action-text-active: rgba(233, 253, 248, 0.98);
  --action-border-active: rgba(98, 231, 202, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(46, 158, 139, 0.42), rgba(28, 114, 99, 0.34));
}

.show-control-actions__btn--video {
  --action-text-inactive: rgba(245, 226, 208, 0.88);
  --action-border-inactive: rgba(255, 165, 86, 0.14);
  --action-bg-inactive: rgba(154, 82, 24, 0.14);
  --action-text-active: rgba(255, 240, 226, 0.98);
  --action-border-active: rgba(255, 188, 120, 0.28);
  --action-bg-active: linear-gradient(180deg, rgba(184, 112, 56, 0.42), rgba(145, 86, 38, 0.34));
}

.show-control-actions__btn--idle {
  --action-text-inactive: rgba(229, 236, 244, 0.86);
  --action-border-inactive: rgba(144, 159, 178, 0.14);
  --action-bg-inactive: rgba(82, 96, 113, 0.14);
  --action-text-active: rgba(245, 249, 253, 0.98);
  --action-border-active: rgba(177, 191, 208, 0.24);
  --action-bg-active: linear-gradient(180deg, rgba(99, 114, 133, 0.4), rgba(78, 91, 108, 0.32));
}

.show-control-actions__btn--blackout {
  --action-text-inactive: rgba(255, 226, 226, 0.9);
  --action-border-inactive: rgba(236, 106, 106, 0.14);
  --action-bg-inactive: rgba(149, 49, 49, 0.16);
  --action-text-active: rgba(255, 240, 240, 0.98);
  --action-border-active: rgba(244, 128, 128, 0.26);
  --action-bg-active: linear-gradient(180deg, rgba(166, 62, 62, 0.42), rgba(133, 48, 48, 0.34));
}

.show-control-actions :deep(.v-btn__content) {
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
  line-height: 1.24;
  overflow-wrap: anywhere;
}

.show-control-actions :deep(.v-btn__prepend) {
  flex: 0 0 auto;
}

.show-control-actions :deep(.v-icon),
.show-control-actions :deep(.v-btn__overlay),
.show-control-actions :deep(.v-ripple__container),
.show-control-actions :deep(.v-btn__loader) {
  flex-shrink: 0;
}

.show-control-actions :deep(.v-btn__overlay),
.show-control-actions :deep(.v-ripple__container),
.show-control-actions :deep(.v-btn__loader) {
  display: none !important;
  opacity: 0 !important;
}

@media (max-width: 720px) {
  .show-control-actions__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .show-control-actions__btn {
    min-height: 2.9rem;
    padding-inline: 0.92rem;
  }
}

@media (max-width: 560px) {
  .show-control-actions__list {
    grid-template-columns: 1fr;
  }
}
</style>
