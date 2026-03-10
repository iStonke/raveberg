<script setup lang="ts">
import logoUrl from '../../assets/raveberg-logo.png'

withDefaults(
  defineProps<{
    mode?: 'full' | 'compact'
    muted?: boolean
  }>(),
  {
    mode: 'full',
    muted: false,
  },
)
</script>

<template>
  <div class="brandmark" :data-mode="mode" :data-muted="muted ? 'true' : 'false'">
    <img class="brandmark-image" :src="logoUrl" alt="RAVEBERG" />
  </div>
</template>

<style scoped>
.brandmark {
  display: inline-flex;
}

.brandmark[data-muted='true'] {
  opacity: 0.82;
}

.brandmark-image {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.24));
}

.brandmark[data-mode='full'] {
  width: min(100%, 26rem);
}

.brandmark[data-mode='compact'] {
  width: min(100%, 12rem);
}
</style>
