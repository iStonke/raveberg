<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  variant?: 'active' | 'muted'
}>(), {
  variant: 'active',
})
</script>

<template>
  <div
    class="status-badge"
    :class="{
      'status-badge--active': variant === 'active',
      'status-badge--muted': variant === 'muted',
    }"
  >
    {{ label }}
  </div>
</template>

<style scoped>
.status-badge {
  flex: 0 0 auto;
  padding: 0.18rem 0.38rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.1;
}

.status-badge--active {
  background: rgba(70, 206, 182, 0.16);
  color: rgba(150, 237, 198, 0.96);
}

.status-badge--muted {
  background: rgba(167, 184, 203, 0.12);
  color: rgba(212, 222, 232, 0.84);
}
</style>
