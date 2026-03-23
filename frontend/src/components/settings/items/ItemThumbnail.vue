<script setup lang="ts">
withDefaults(defineProps<{
  order: number
  icon?: string
  iconSize?: number
  imageSrc?: string
}>(), {
  icon: '',
  iconSize: 24,
  imageSrc: '',
})
</script>

<template>
  <div class="item-thumbnail">
    <div class="item-thumbnail__order">{{ order }}</div>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      alt=""
      class="item-thumbnail__image"
    >
    <div v-else class="item-thumbnail__placeholder">
      <slot>
        <v-icon :icon="icon" :size="iconSize" />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.item-thumbnail {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 64px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 30% 24%, rgba(109, 214, 255, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(30, 44, 60, 0.86), rgba(18, 28, 41, 0.92));
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.item-thumbnail__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: rgba(160, 193, 224, 0.48);
}

.item-thumbnail__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-thumbnail__order {
  position: absolute;
  top: 0.34rem;
  left: 0.34rem;
  display: grid;
  place-items: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(7, 12, 18, 0.42);
  color: rgba(239, 245, 250, 0.7);
  font-size: 0.62rem;
  font-weight: 700;
}

@media (max-width: 959px) {
  .item-thumbnail {
    min-height: 60px;
  }
}
</style>
