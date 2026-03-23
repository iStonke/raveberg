<script setup lang="ts">
const props = withDefaults(defineProps<{
  icon?: string
  label: string
  loading?: boolean
  disabled?: boolean
}>(), {
  icon: '',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <v-btn
    color="primary"
    variant="outlined"
    class="primary-header-action"
    :prepend-icon="props.icon || undefined"
    :loading="props.loading"
    :disabled="props.disabled"
    @click="emit('click')"
  >
    {{ props.label }}
  </v-btn>
</template>

<style scoped>
.primary-header-action {
  min-height: 2.1rem;
  padding-inline: 0.82rem;
  border-radius: 14px;
  border-color: rgba(120, 170, 220, 0.14);
  color: rgba(219, 231, 242, 0.84) !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.022), rgba(255, 255, 255, 0.014));
  text-transform: none;
  font-weight: 620;
  box-shadow: none;
  letter-spacing: 0.01em;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.primary-header-action:hover {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.018));
  border-color: rgba(120, 170, 220, 0.18);
  color: rgba(232, 240, 248, 0.92) !important;
}

.primary-header-action :deep(.v-icon) {
  opacity: 0.8;
}

@media (max-width: 760px) {
  .primary-header-action {
    min-height: 2.12rem;
    padding-inline: 0.82rem;
  }
}
</style>
