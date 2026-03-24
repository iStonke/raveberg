<script setup lang="ts">
import type { PropType } from 'vue'

import ItemActionsRow from '../settings/items/ItemActionsRow.vue'
import ItemMetaBlock from '../settings/items/ItemMetaBlock.vue'
import ItemThumbnail from '../settings/items/ItemThumbnail.vue'
import OrderedItemCard from '../settings/items/OrderedItemCard.vue'
import StatusBadge from '../settings/items/StatusBadge.vue'
import type { VideoAsset } from '../../services/api'

const props = defineProps({
  assets: {
    type: Array as PropType<VideoAsset[]>,
    required: true,
  },
  activeVideoId: {
    type: Number as PropType<number | null>,
    default: null,
  },
  loopVideoId: {
    type: Number as PropType<number | null>,
    default: null,
  },
  durations: {
    type: Object as PropType<Record<number, string>>,
    required: true,
  },
  metadataLoading: {
    type: Object as PropType<Record<number, boolean>>,
    required: true,
  },
  busyActions: {
    type: Object as PropType<Record<string, boolean>>,
    default: () => ({}),
  },
})

const emit = defineEmits<{
  select: [asset: VideoAsset]
  toggleLoop: [asset: VideoAsset]
  move: [asset: VideoAsset, direction: -1 | 1]
  remove: [asset: VideoAsset]
}>()

function isBusy(key: string) {
  return Boolean(props.busyActions[key])
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatVideoMimeLabel(value: string) {
  if (value === 'video/mp4') {
    return 'MP4'
  }
  if (value === 'video/webm') {
    return 'WebM'
  }

  const subtype = value.split('/')[1]
  return subtype ? subtype.toUpperCase() : value.toUpperCase()
}
</script>

<template>
  <div v-if="assets.length" class="ordered-item-list">
    <OrderedItemCard
      v-for="(asset, index) in assets"
      :key="asset.id"
      :active="activeVideoId === asset.id"
      @click="emit('select', asset)"
    >
      <template #thumbnail>
        <ItemThumbnail
          :order="index + 1"
          icon="mdi-play-circle-outline"
        />
      </template>

      <template #body>
        <ItemMetaBlock
          :title="asset.filename_original"
          :meta-items="[
            durations[asset.id] || (metadataLoading[asset.id] ? 'Wird gelesen' : 'Unbekannt'),
            formatBytes(asset.size),
            formatVideoMimeLabel(asset.mime_type),
          ]"
        >
          <template #badge>
            <StatusBadge
              v-if="loopVideoId === asset.id"
              label="Loop aktiv"
            />
            <StatusBadge
              v-else-if="activeVideoId === asset.id"
              label="Aktiv"
            />
          </template>
        </ItemMetaBlock>
      </template>

      <template #actions>
        <ItemActionsRow>
          <v-btn
            size="small"
            :variant="loopVideoId === asset.id ? 'tonal' : 'text'"
            :color="loopVideoId === asset.id ? 'primary' : undefined"
            class="item-action-btn item-action-btn--wide"
            :prepend-icon="loopVideoId === asset.id ? 'mdi-repeat' : 'mdi-repeat-off'"
            :loading="isBusy(`video:loop:${asset.id}`)"
            :aria-label="loopVideoId === asset.id ? 'Endlosschleife deaktivieren' : 'Endlosschleife aktivieren'"
            @click.stop="emit('toggleLoop', asset)"
          >
            {{ loopVideoId === asset.id ? 'Loop an' : 'Loop aus' }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            class="item-action-btn"
            icon="mdi-arrow-up"
            :disabled="index === 0"
            :loading="isBusy(`video:move:${asset.id}`)"
            @click.stop="emit('move', asset, -1)"
          />
          <v-btn
            size="small"
            variant="text"
            class="item-action-btn"
            icon="mdi-arrow-down"
            :disabled="index === assets.length - 1"
            :loading="isBusy(`video:move:${asset.id}`)"
            @click.stop="emit('move', asset, 1)"
          />
          <v-btn
            size="small"
            color="error"
            variant="text"
            class="item-action-btn item-action-btn--danger"
            icon="mdi-trash-can-outline"
            :loading="isBusy(`video:delete:${asset.id}`)"
            @click.stop="emit('remove', asset)"
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
