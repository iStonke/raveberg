<script setup lang="ts">
import { ref } from 'vue'

const scrollArea = ref<HTMLElement | null>(null)
const headerScrolled = ref(false)

function handleScroll() {
  headerScrolled.value = (scrollArea.value?.scrollTop ?? 0) > 6
}
</script>

<template>
  <section class="settings-page">
    <div ref="scrollArea" class="settings-scroll-area" @scroll.passive="handleScroll">
      <section
        class="settings-subpage-sticky-header"
        :class="{ 'is-scrolled': headerScrolled }"
      >
        <div class="app-shell settings-content-shell--header">
          <v-row class="settings-subpage-grid app-content-grid">
            <v-col cols="12">
              <slot name="header" />
            </v-col>
          </v-row>
        </div>
      </section>

      <main class="settings-subpage-content">
        <div class="app-shell settings-content-shell--content">
          <v-row class="settings-subpage-grid app-content-grid">
            <v-col cols="12">
              <slot />
            </v-col>
          </v-row>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.settings-scroll-area {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.settings-subpage-content {
  padding-top: 1rem;
  padding-bottom: 2.5rem;
  padding-left: 0;
  padding-right: 0;
}

.settings-subpage-sticky-header {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  padding: 0;
  background:
    linear-gradient(
      180deg,
      rgba(4, 10, 18, 0.99) 0%,
      rgba(5, 14, 28, 0.975) 72%,
      rgba(5, 14, 28, 0.95) 100%
    );
  border-bottom: 1px solid rgba(120, 170, 220, 0.14);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.settings-subpage-sticky-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -12px;
  height: 12px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0) 100%);
}

.settings-subpage-sticky-header.is-scrolled {
  background:
    linear-gradient(
      180deg,
      rgba(4, 10, 18, 0.995) 0%,
      rgba(5, 14, 28, 0.985) 72%,
      rgba(5, 14, 28, 0.965) 100%
    );
  border-bottom-color: rgba(120, 170, 220, 0.18);
  box-shadow:
    0 14px 28px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.settings-content-shell--header {
  padding-top: 0.9rem;
  padding-bottom: 0.9rem;
}

.settings-content-shell--content {
  padding-bottom: 0;
}

.settings-subpage-grid {
  margin: 0;
}

@media (max-width: 760px) {
  .settings-content-shell--header {
    padding-top: 0.78rem;
    padding-bottom: 0.75rem;
  }
}
</style>
