<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  metaItems: string[]
}>()

const filteredMetaItems = computed(() => props.metaItems.filter((entry) => entry.trim().length > 0))
</script>

<template>
  <div class="item-meta-block">
    <div class="item-meta-block__title-row">
      <div class="item-meta-block__title">{{ title }}</div>
      <slot name="badge" />
    </div>
    <div v-if="filteredMetaItems.length" class="item-meta-block__meta">
      <template v-for="(entry, index) in filteredMetaItems" :key="`${entry}:${index}`">
        <span v-if="index > 0" aria-hidden="true">·</span>
        <span>{{ entry }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.item-meta-block {
  min-width: 0;
  display: grid;
  gap: 0.22rem;
}

.item-meta-block__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.55rem;
  min-width: 0;
}

.item-meta-block__title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.92rem;
  font-weight: 620;
  line-height: 1.2;
}

.item-meta-block__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.24rem;
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.71rem;
  line-height: 1.25;
}
</style>
