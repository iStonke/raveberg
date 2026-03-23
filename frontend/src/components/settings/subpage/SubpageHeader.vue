<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

withDefaults(defineProps<{
  backTo: RouteLocationRaw
  title: string
  backLabel?: string
  meta?: string
  variant?: 'hero' | 'stacked' | 'toolbar'
}>(), {
  backLabel: 'Zurück',
  meta: '',
  variant: 'hero',
})
</script>

<template>
  <section
    class="subpage-header"
    :class="{
      'subpage-header--hero': variant === 'hero',
      'subpage-header--stacked': variant === 'stacked',
      'subpage-header--toolbar': variant === 'toolbar',
    }"
  >
    <div class="subpage-header-top">
      <router-link
        :to="backTo"
        class="subpage-back-button"
      >
        <v-icon icon="mdi-arrow-left" size="18" class="subpage-back-button__icon" />
        <span>{{ backLabel }}</span>
      </router-link>
    </div>

    <div v-if="variant !== 'toolbar'" class="subpage-hero-main">
      <div v-if="variant === 'hero' && $slots.hero" class="subpage-header__hero-slot">
        <slot name="hero" />
      </div>

      <section class="subpage-title-block">
        <div class="subpage-header__title">{{ title }}</div>
        <div v-if="meta" class="subpage-header__meta">{{ meta }}</div>
      </section>

      <div v-if="$slots.action" class="subpage-header__actions subpage-header__actions--hero">
        <slot name="action" />
      </div>
    </div>

    <div v-else class="subpage-toolbar-main">
      <section class="subpage-title-block subpage-title-block--toolbar">
        <div class="subpage-header__title">{{ title }}</div>
        <div v-if="meta" class="subpage-header__meta">{{ meta }}</div>
      </section>

      <div v-if="$slots.action" class="subpage-header__actions subpage-header__actions--toolbar">
        <slot name="action" />
      </div>
    </div>

    <div v-if="$slots.below" class="subpage-header__below">
      <slot name="below" />
    </div>
  </section>
</template>

<style scoped>
.subpage-header {
  position: relative;
  display: grid;
  gap: 0.62rem;
}

.subpage-header--hero::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 2.9rem;
  width: 14rem;
  height: 6.5rem;
  transform: translateX(-50%);
  pointer-events: none;
  background:
    radial-gradient(circle at center, rgba(74, 194, 255, 0.12), rgba(74, 194, 255, 0) 72%);
  filter: blur(18px);
  opacity: 0.88;
}

.subpage-header-top {
  display: flex;
  align-items: center;
}

.subpage-back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.2rem;
  padding: 0 0.76rem;
  border-radius: 14px;
  border: 1px solid rgba(126, 182, 222, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015));
  color: rgba(228, 236, 246, 0.82);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 560;
  letter-spacing: 0;
  line-height: 1.2;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.subpage-back-button:hover {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.024));
  border-color: rgba(120, 170, 220, 0.2);
  color: rgba(241, 246, 252, 0.96);
}

.subpage-back-button:active {
  transform: translateY(1px);
}

.subpage-back-button__icon {
  color: currentColor;
  opacity: 0.9;
}

.subpage-hero-main {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.72rem;
  padding-top: 0.08rem;
}

.subpage-toolbar-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.subpage-title-block {
  display: grid;
  gap: 0.22rem;
  justify-items: center;
  text-align: center;
}

.subpage-title-block--toolbar {
  justify-items: start;
  text-align: left;
}

.subpage-header__hero-slot {
  display: grid;
  place-items: center;
}

.subpage-header__title {
  color: rgba(245, 249, 255, 0.98);
  font-size: 1.46rem;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.subpage-header__meta {
  color: rgba(208, 220, 232, 0.6);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.28;
  max-width: 28rem;
}

.subpage-header__actions {
  display: grid;
}

.subpage-header__actions--hero {
  justify-items: center;
  width: 100%;
}

.subpage-header__actions--toolbar {
  flex: 0 0 auto;
  justify-items: end;
  align-self: center;
}

.subpage-header__below {
  width: min(100%, 30rem);
  justify-self: center;
}

@media (max-width: 760px) {
  .subpage-header {
    gap: 0.56rem;
  }

  .subpage-header--hero::before {
    top: 2.7rem;
    width: 11.5rem;
    height: 5.4rem;
  }

  .subpage-back-button {
    min-height: 2.2rem;
    padding-inline: 0.74rem;
    font-size: 0.92rem;
  }

  .subpage-hero-main {
    gap: 0.6rem;
  }

  .subpage-toolbar-main {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .subpage-header__actions--toolbar {
    width: 100%;
    justify-items: start;
  }

  .subpage-header__title {
    font-size: 1.34rem;
  }

  .subpage-header__meta {
    font-size: 0.78rem;
  }
}
</style>
