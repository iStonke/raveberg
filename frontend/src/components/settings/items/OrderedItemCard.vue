<script setup lang="ts">
defineProps<{
  active?: boolean
  skipped?: boolean
}>()
</script>

<template>
  <div
    class="ordered-item-card"
    :class="{
      'ordered-item-card--active': active,
      'ordered-item-card--skipped': skipped,
    }"
  >
    <div class="ordered-item-card__thumb">
      <slot name="thumbnail" />
    </div>

    <div class="ordered-item-card__body">
      <div class="ordered-item-card__content">
        <slot name="body" />
      </div>

      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.ordered-item-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 0.68rem;
  align-items: stretch;
  padding: 0.62rem;
  border-radius: 15px;
  background:
    radial-gradient(circle at top right, rgba(85, 198, 255, 0.1), transparent 42%),
    linear-gradient(180deg, rgba(20, 31, 44, 0.88), rgba(12, 20, 31, 0.94));
  border: 1px solid rgba(160, 194, 226, 0.14);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
  min-width: 0;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.ordered-item-card--active {
  border-color: rgba(102, 215, 231, 0.3);
  background:
    radial-gradient(circle at top right, rgba(88, 216, 242, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(25, 40, 56, 0.98), rgba(15, 27, 40, 0.98));
  box-shadow:
    0 16px 30px rgba(4, 12, 20, 0.28),
    0 0 0 1px rgba(91, 228, 242, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

.ordered-item-card--skipped {
  opacity: 0.74;
}

.ordered-item-card__thumb {
  min-width: 0;
}

.ordered-item-card__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.4rem;
}

.ordered-item-card__content {
  min-width: 0;
  display: grid;
  gap: 0.22rem;
}

@media (max-width: 959px) {
  .ordered-item-card {
    grid-template-columns: 66px minmax(0, 1fr);
  }
}
</style>
