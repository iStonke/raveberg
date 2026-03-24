<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    active?: boolean
    visible?: boolean
    durationMs?: number
    zIndex?: number
    staggeredIn?: boolean
  }>(),
  {
    active: false,
    visible: true,
    durationMs: 360,
    zIndex: 1,
    staggeredIn: false,
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
      'display-switch-layer--staggered-in': props.staggeredIn,
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
  filter: blur(11px) brightness(0.86) saturate(0.94);
  transform: scale(1.012);
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
  filter: blur(0) brightness(1) saturate(1);
  transform: scale(1);
}

.display-switch-layer--active.display-switch-layer--staggered-in {
  transition-delay: 54ms;
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

  .display-switch-layer--active.display-switch-layer--staggered-in {
    transition-delay: 0ms;
  }
}
</style>
