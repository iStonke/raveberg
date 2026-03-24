<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    active?: boolean
    visible?: boolean
    durationMs?: number
    zIndex?: number
  }>(),
  {
    active: false,
    visible: true,
    durationMs: 360,
    zIndex: 1,
  },
)

const layerStyle = computed(() => ({
  '--display-switch-duration': `${props.durationMs}ms`,
  zIndex: String(props.zIndex),
}))
</script>

<template>
  <div
    class="display-switch-layer"
    :class="{
      'display-switch-layer--active': props.active,
      'display-switch-layer--hidden': !props.visible,
    }"
    :style="layerStyle"
  >
    <slot />
  </div>
</template>

<style scoped>
.display-switch-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  filter: blur(10px) brightness(0.9);
  transform: scale(1.01);
  transform-origin: center;
  pointer-events: none;
  transition:
    opacity var(--display-switch-duration) cubic-bezier(0.22, 0.84, 0.28, 1),
    filter var(--display-switch-duration) cubic-bezier(0.22, 0.84, 0.28, 1),
    transform var(--display-switch-duration) cubic-bezier(0.22, 0.84, 0.28, 1);
  will-change: opacity, filter, transform;
  backface-visibility: hidden;
}

.display-switch-layer--active {
  opacity: 1;
  filter: blur(0) brightness(1);
  transform: scale(1);
}

.display-switch-layer--hidden {
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .display-switch-layer {
    filter: none;
    transform: none;
    transition: opacity calc(var(--display-switch-duration) * 0.72) ease;
    will-change: opacity;
  }

  .display-switch-layer--active {
    filter: none;
    transform: none;
  }
}
</style>
