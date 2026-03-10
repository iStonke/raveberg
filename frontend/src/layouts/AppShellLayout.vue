<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import { usePublicRuntimeStore } from '../stores/publicRuntime'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const publicRuntimeStore = usePublicRuntimeStore()
const isGuestRoute = computed(() => route.path.startsWith('/guest'))
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isAdminLogin = computed(() => route.name === 'admin-login')
const isAdminDashboard = computed(() => route.name === 'admin-dashboard')

const adminWorkspaceItems = [
  { label: 'Modus', hash: '#modus' },
  { label: 'Uploads', hash: '#uploads' },
  { label: 'Status', hash: '#status' },
] as const

const activeAdminSection = computed(() => {
  const hash = route.hash.replace('#', '')
  return hash === 'status' || hash === 'uploads' ? hash : 'modus'
})

onMounted(async () => {
  if (!publicRuntimeStore.isLoaded) {
    try {
      await publicRuntimeStore.refresh()
    } catch {
      // Keep shell rendering with defaults if public runtime info is temporarily unavailable.
    }
  }
})

async function logout() {
  await authStore.logout()
  await router.push('/admin/login')
}
</script>

<template>
  <v-layout class="min-height-screen">
    <v-app-bar
      v-if="!isGuestRoute && !isAdminLogin"
      color="surface"
      class="app-shell-bar"
      flat
      height="44"
    >
      <div class="utility-bar">
        <div class="utility-bar__title" aria-hidden="true">
          <span class="utility-dot" />
          <span class="utility-title-text">Einstellungen</span>
        </div>
        <div v-if="isAdminDashboard" class="utility-bar__user">
          <v-btn
            variant="text"
            class="logout-btn"
            prepend-icon="mdi-logout"
            @click="logout()"
          >
            Logout
          </v-btn>
        </div>
      </div>
    </v-app-bar>

    <div
      v-if="isAdminDashboard"
      class="admin-nav-strip"
      role="navigation"
      aria-label="Admin Bereiche"
    >
      <div class="admin-nav-strip__inner">
        <router-link
          v-for="item in adminWorkspaceItems"
          :key="item.hash"
          :to="{ name: 'admin-dashboard', hash: item.hash }"
          class="admin-nav-link"
          :class="{ 'admin-nav-link--active': activeAdminSection === item.hash.replace('#', '') }"
        >
          {{ item.label }}
        </router-link>
      </div>
    </div>

    <v-main :class="[{ 'guest-main': isGuestRoute, 'admin-main': isAdminRoute }]">
      <router-view v-if="isGuestRoute" />
      <v-container
        v-else
        class="shell-container"
        :class="{
          'admin-shell-container': isAdminRoute,
          'admin-workspace-container': isAdminDashboard,
          'admin-login-shell-container': isAdminLogin,
        }"
      >
        <router-view />
      </v-container>
    </v-main>
  </v-layout>
</template>

<style scoped>
.min-height-screen {
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 18% -4%, rgba(47, 166, 255, 0.08), transparent 24%),
    radial-gradient(circle at 82% 8%, rgba(52, 215, 188, 0.05), transparent 20%),
    radial-gradient(circle at 50% 100%, rgba(33, 89, 168, 0.04), transparent 26%),
    linear-gradient(180deg, #070d15 0%, #0a121b 52%, #0d1520 100%);
}

.min-height-screen::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.025) 0.55px, transparent 0.55px);
  background-size: 12px 12px;
  opacity: 0.08;
  mix-blend-mode: soft-light;
}

.guest-main {
  min-height: 100vh;
}

.app-shell-bar {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1006;
  border-bottom: 1px solid rgba(164, 195, 223, 0.08);
  backdrop-filter: blur(18px);
  background: rgba(7, 13, 21, 0.84) !important;
}

.utility-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0 0.8rem;
}

.utility-bar__title,
.utility-bar__user {
  display: flex;
  align-items: center;
}

.utility-bar__title {
  gap: 0.45rem;
}

.utility-title-text {
  color: rgba(230, 239, 248, 0.82);
  font-size: 0.79rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.utility-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: rgba(74, 213, 229, 0.96);
  box-shadow: 0 0 0 0.18rem rgba(74, 213, 229, 0.16);
}

.utility-bar__user {
  gap: 0.65rem;
}

.logout-btn {
  min-height: 1.85rem;
  padding-inline: 0.35rem;
  color: rgb(255, 108, 108);
  text-transform: none;
  font-size: 0.83rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition:
    color 150ms ease,
    transform 150ms ease;
}

.logout-btn:hover {
  color: rgb(255, 138, 138);
}

.logout-btn:active {
  transform: scale(0.985);
}

.admin-nav-strip {
  position: fixed;
  top: 44px;
  left: 0;
  right: 0;
  z-index: 1005;
  padding: 0.25rem 0.75rem;
  background: rgba(7, 13, 21, 0.8);
  border-bottom: 1px solid rgba(164, 195, 223, 0.08);
  backdrop-filter: blur(18px);
  overflow-x: hidden;
}

.admin-nav-strip__inner {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.25rem;
  max-width: 31rem;
  margin: 0 auto;
  padding: 0;
  min-width: 0;
}

.admin-nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 1.95rem;
  padding: 0 0.55rem;
  border-radius: 0;
  color: rgba(217, 229, 240, 0.66);
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 600;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.admin-nav-link:hover {
  color: rgba(243, 248, 253, 0.9);
  background: rgba(17, 31, 46, 0.42);
}

.admin-nav-link:active {
  transform: scale(0.985);
}

.admin-nav-link--active {
  background: rgba(66, 207, 226, 0.08);
  color: #f8fbff;
  box-shadow:
    inset 0 -2px 0 rgba(91, 228, 242, 0.88),
    0 8px 18px rgba(10, 23, 37, 0.14);
}

.shell-container {
  width: 100%;
  max-width: none !important;
  min-width: 0;
  padding: 3.4rem 1rem 0.5rem;
  overflow-x: hidden;
  box-sizing: border-box;
}

.admin-shell-container {
  padding-top: 5rem;
}

.admin-login-shell-container {
  padding: 0;
}

.admin-workspace-container {
  width: 100%;
  max-width: 1280px !important;
  height: calc(100vh - 76px);
  min-width: 0;
}

@media (max-width: 1100px) {
  .admin-workspace-container {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .utility-bar {
    padding: 0 0.7rem;
  }

  .admin-nav-strip {
    padding-inline: 0.5rem;
  }

  .shell-container {
    padding-inline: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .admin-shell-container {
    padding-top: 4.75rem;
  }

  .admin-login-shell-container {
    padding: 0;
  }
}
</style>
