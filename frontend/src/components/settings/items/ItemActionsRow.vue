<template>
  <div class="item-actions-row">
    <slot />
  </div>
</template>

<style scoped>
.item-actions-row {
  display: flex;
  justify-content: flex-start;
  gap: 0.12rem;
  min-width: 0;
}

:deep(.item-action-btn) {
  opacity: 0.78;
}

:deep(.item-action-btn.v-btn) {
  min-width: 1.85rem;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 999px;
}

:deep(.item-action-btn--wide.v-btn) {
  width: auto;
  min-width: 0;
  padding-inline: 0.55rem 0.68rem;
  border-radius: 999px;
  text-transform: none;
  letter-spacing: 0.01em;
  font-size: 0.71rem;
  font-weight: 650;
}

:deep(.item-action-btn:hover) {
  background: rgba(255, 255, 255, 0.045);
  opacity: 1;
}

:deep(.item-action-btn--danger) {
  opacity: 0.72;
}
</style>
