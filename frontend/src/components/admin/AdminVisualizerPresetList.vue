<script setup lang="ts">
import type { PropType } from 'vue'

import ItemActionsRow from '../settings/items/ItemActionsRow.vue'
import ItemMetaBlock from '../settings/items/ItemMetaBlock.vue'
import ItemThumbnail from '../settings/items/ItemThumbnail.vue'
import OrderedItemCard from '../settings/items/OrderedItemCard.vue'
import StatusBadge from '../settings/items/StatusBadge.vue'
import { visualizerPresetLabels } from '../../constants/visualizerPresets'
import type { VisualizerPreset } from '../../services/api'

const props = defineProps({
  presets: {
    type: Array as PropType<VisualizerPreset[]>,
    required: true,
  },
  activePreset: {
    type: String as PropType<VisualizerPreset>,
    required: true,
  },
  activeBadgeLabel: {
    type: String,
    default: 'Aktiv',
  },
  skippedPresets: {
    type: Array as PropType<VisualizerPreset[]>,
    default: () => [],
  },
  busyActions: {
    type: Object as PropType<Record<string, boolean>>,
    default: () => ({}),
  },
})

const emit = defineEmits<{
  select: [preset: VisualizerPreset]
  move: [preset: VisualizerPreset, direction: -1 | 1]
  toggleSkip: [preset: VisualizerPreset]
}>()

function isBusy(key: string) {
  return Boolean(props.busyActions[key])
}

function isSkipped(preset: VisualizerPreset) {
  return props.skippedPresets.includes(preset)
}
</script>

<template>
  <div v-if="presets.length" class="ordered-item-list">
    <OrderedItemCard
      v-for="(preset, index) in presets"
      :key="preset"
      :active="activePreset === preset"
      :skipped="isSkipped(preset)"
      @click="emit('select', preset)"
    >
      <template #thumbnail>
        <ItemThumbnail
          :order="index + 1"
          icon="mdi-animation-play-outline"
        />
      </template>

      <template #body>
        <ItemMetaBlock
          :title="visualizerPresetLabels[preset] ?? preset"
          :meta-items="[preset]"
        >
          <template #badge>
            <StatusBadge
              v-if="activePreset === preset"
              :label="activeBadgeLabel"
            />
            <StatusBadge
              v-else-if="isSkipped(preset)"
              label="Überspringen"
              variant="muted"
            />
          </template>
        </ItemMetaBlock>
      </template>

      <template #actions>
        <ItemActionsRow>
          <v-btn
            size="small"
            variant="text"
            class="item-action-btn"
            :icon="isSkipped(preset) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :loading="isBusy(`visualizer:skip:${preset}`)"
            @click.stop="emit('toggleSkip', preset)"
          />
          <v-btn
            size="small"
            variant="text"
            class="item-action-btn"
            icon="mdi-arrow-up"
            :disabled="index === 0"
            :loading="isBusy(`visualizer:move:${preset}`)"
            @click.stop="emit('move', preset, -1)"
          />
          <v-btn
            size="small"
            variant="text"
            class="item-action-btn"
            icon="mdi-arrow-down"
            :disabled="index === presets.length - 1"
            :loading="isBusy(`visualizer:move:${preset}`)"
            @click.stop="emit('move', preset, 1)"
          />
        </ItemActionsRow>
      </template>
    </OrderedItemCard>
  </div>
</template>

<style scoped>
.ordered-item-list {
  display: grid;
  gap: 0.7rem;
}
</style>
