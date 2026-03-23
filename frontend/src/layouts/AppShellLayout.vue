<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AdminAlertHost from '../components/admin/alerts/AdminAlertHost.vue'
import { useAuthStore } from '../stores/auth'
import { useAdminUploadsBadgeStore } from '../stores/adminUploadsBadge'
import { usePublicRuntimeStore } from '../stores/publicRuntime'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminUploadsBadgeStore = useAdminUploadsBadgeStore()
const publicRuntimeStore = usePublicRuntimeStore()
const isGuestRoute = computed(() => route.path.startsWith('/guest'))
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isSetupRoute = computed(() => route.path.startsWith('/setup'))
const isAdminLogin = computed(() => route.name === 'admin-login')
const isAdminDashboard = computed(() => route.name === 'admin-dashboard')
const isAdminVideoManager = computed(() => route.name === 'admin-videos')
const isAdminVisualizerManager = computed(() => route.name === 'admin-visualizers')
const isAdminSubmenuRoute = computed(() => isAdminVideoManager.value || isAdminVisualizerManager.value)
const showAdminSubnav = computed(() => isAdminDashboard.value || isAdminSubmenuRoute.value)
const isLogoutDialogOpen = ref(false)
const isLoggingOut = ref(false)

const adminWorkspaceItems = [
  { label: 'Modus', hash: '#modus' },
  { label: 'Uploads', hash: '#uploads' },
  { label: 'System', hash: '#system' },
] as const

const activeAdminSection = computed(() => {
  const hash = route.hash.replace('#', '')
  if (hash === 'uploads') {
    return 'uploads'
  }
  if (hash === 'status' || hash === 'system') {
    return 'system'
  }
  return 'modus'
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

function openLogoutDialog() {
  isLogoutDialogOpen.value = true
}

function closeLogoutDialog() {
  if (isLoggingOut.value) {
    return
  }
  isLogoutDialogOpen.value = false
}

async function logout() {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true
  try {
    await authStore.logout()
    isLogoutDialogOpen.value = false
    await router.push('/admin/login')
  } finally {
    isLoggingOut.value = false
  }
}

function showUploadsBadge(hash: string) {
  return hash === '#uploads' && adminUploadsBadgeStore.hasUnseenUploads
}
</script>

<template>
  <v-layout
    class="min-height-screen"
    :class="{ 'safe-area-page': isAdminRoute || isAdminLogin || isSetupRoute }"
  >
    <v-app-bar
      v-if="!isGuestRoute && !isAdminLogin && !isSetupRoute"
      color="surface"
      class="app-shell-bar"
      flat
      height="44"
    >
      <div class="utility-bar">
        <div class="utility-bar__title" aria-hidden="true">
          <span class="utility-title-text">Einstellungen</span>
        </div>
        <div v-if="isAdminRoute" class="utility-bar__user">
          <v-btn
            variant="text"
            class="logout-btn"
            prepend-icon="mdi-logout"
            @click="openLogoutDialog"
          >
            Logout
          </v-btn>
        </div>
      </div>
    </v-app-bar>

    <div
      v-if="showAdminSubnav"
      class="admin-nav-strip"
      role="navigation"
      :aria-label="isAdminDashboard ? 'Admin Bereiche' : 'Admin Untermenü'"
    >
      <div
        class="admin-nav-strip__inner"
        :class="{ 'admin-nav-strip__inner--single': isAdminSubmenuRoute }"
      >
        <template v-if="isAdminDashboard">
          <router-link
            v-for="item in adminWorkspaceItems"
            :key="item.hash"
            :to="{ name: 'admin-dashboard', hash: item.hash }"
            class="admin-nav-link"
            :class="{ 'admin-nav-link--active': activeAdminSection === item.hash.replace('#', '') }"
          >
            <span class="admin-nav-link__label">
              <span>{{ item.label }}</span>
              <span
                v-if="showUploadsBadge(item.hash)"
                class="admin-nav-link__badge"
                aria-label="Neue Uploads"
              />
            </span>
          </router-link>
        </template>
        <router-link
          v-else
          :to="{ name: 'admin-dashboard', hash: '#modus' }"
          class="admin-nav-link admin-nav-link--back"
        >
          <span class="admin-nav-link__label admin-nav-link__label--back">
            <v-icon icon="mdi-arrow-left" size="18" class="admin-nav-link__icon" />
            <span>Zurück zu Modus</span>
          </span>
        </router-link>
      </div>
    </div>

    <v-main :class="[{ 'guest-main': isGuestRoute, 'admin-main': isAdminRoute, 'setup-main': isSetupRoute }]">
      <v-container
        v-if="isGuestRoute"
        class="shell-container guest-shell-container"
      >
        <router-view />
      </v-container>
      <v-container
        v-else
        class="shell-container"
        :class="{
          'admin-shell-container': isAdminRoute,
          'admin-workspace-container': isAdminDashboard,
          'admin-video-manager-container': isAdminSubmenuRoute,
          'admin-login-shell-container': isAdminLogin,
          'setup-shell-container': isSetupRoute,
        }"
      >
        <router-view />
      </v-container>
    </v-main>

    <AdminAlertHost v-if="isAdminRoute" />

    <v-dialog
      v-model="isLogoutDialogOpen"
      max-width="27.5rem"
      :persistent="isLoggingOut"
      scrim="rgba(2, 6, 12, 0.76)"
      class="logout-confirm-overlay"
      content-class="logout-confirm-dialog__content"
    >
      <v-card class="logout-confirm-dialog" variant="flat">
        <div class="logout-confirm-dialog__label">Admin</div>
        <div class="logout-confirm-dialog__title">Wirklich abmelden?</div>
        <div class="logout-confirm-dialog__copy">
          Du wirst aus dem Admin-Bereich abgemeldet.
        </div>
        <div class="logout-confirm-dialog__actions">
          <v-btn
            variant="outlined"
            class="logout-confirm-dialog__button logout-confirm-dialog__button--cancel"
            :disabled="isLoggingOut"
            @click="closeLogoutDialog"
          >
            Abbrechen
          </v-btn>
          <v-btn
            variant="flat"
            class="logout-confirm-dialog__button logout-confirm-dialog__button--confirm"
            :loading="isLoggingOut"
            @click="logout"
          >
            Abmelden
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-layout>
</template>

<style scoped>
@keyframes logoutDialogRise {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.min-height-screen {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  overflow-x: hidden;
  background: var(--app-page-background);
  background-color: var(--app-page-background-color);
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
  padding: 0 !important;
  height: 100%;
}

.guest-shell-container {
  width: 100%;
  height: 100%;
  max-width: none !important;
  min-height: 0;
  padding: 0 !important;
  overflow: hidden !important;
}

.app-shell-bar {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  height: calc(44px + var(--safe-area-top)) !important;
  min-height: calc(44px + var(--safe-area-top)) !important;
  padding-top: var(--safe-area-top);
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
  min-height: 44px;
  padding:
    0 calc(0.8rem + var(--safe-area-right))
    0 calc(0.8rem + var(--safe-area-left));
}

.utility-bar__title,
.utility-bar__user {
  display: flex;
  align-items: center;
}

.utility-bar__title {
  gap: 0;
}

.utility-title-text {
  color: rgba(230, 239, 248, 0.82);
  font-size: 0.79rem;
  font-weight: 700;
  letter-spacing: 0.02em;
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

.utility-bar :deep(.v-btn__overlay),
.utility-bar :deep(.v-ripple__container) {
  display: none !important;
  opacity: 0 !important;
}

.admin-nav-strip {
  position: fixed;
  top: calc(44px + var(--safe-area-top));
  left: 0;
  right: 0;
  z-index: 1005;
  padding:
    0.25rem calc(0.75rem + var(--safe-area-right))
    0.25rem calc(0.75rem + var(--safe-area-left));
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

.admin-nav-strip__inner--single {
  grid-template-columns: minmax(0, 1fr);
  max-width: none;
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

.admin-nav-link--back {
  justify-content: flex-start;
  width: 100%;
  padding-inline: 0.85rem;
}

.admin-nav-link--back:hover {
  color: rgba(217, 229, 240, 0.66);
  background: transparent;
}

.admin-nav-link__label {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.admin-nav-link__label--back {
  gap: 0.5rem;
  justify-content: flex-start;
}

.admin-nav-link__icon {
  color: rgba(221, 232, 243, 0.82);
}

.admin-nav-link__badge {
  position: absolute;
  top: -0.24rem;
  right: -0.58rem;
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 999px;
  background: #ff5c5c;
  box-shadow:
    0 0 0 2px rgba(7, 13, 21, 0.92),
    0 0 12px rgba(255, 92, 92, 0.24);
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

.setup-main {
  padding: 0 !important;
}

.setup-shell-container {
  max-width: 720px !important;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 1.2rem 1rem 1.5rem;
}

.admin-shell-container {
  padding-top: 3.6rem;
}

.admin-video-manager-container {
  padding: 0 0 0.5rem;
}

.admin-login-shell-container {
  padding: 0;
}

.admin-workspace-container {
  width: 100%;
  max-width: 1280px !important;
  min-width: 0;
  height: auto;
  min-height: calc(100vh - 76px - var(--safe-area-top) - var(--safe-area-bottom));
  min-height: calc(100dvh - 76px - var(--safe-area-top) - var(--safe-area-bottom));
}

.logout-confirm-dialog {
  width: min(100%, 27.5rem);
  border-radius: 22px !important;
  padding: 1.85rem;
  background:
    linear-gradient(180deg, rgba(18, 28, 42, 0.96), rgba(10, 18, 30, 0.96)) !important;
  border: 1px solid rgba(120, 170, 220, 0.18);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
  animation: logoutDialogRise 260ms cubic-bezier(0.2, 0.9, 0.22, 1);
}

:deep(.logout-confirm-overlay .v-overlay__scrim) {
  background: rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(12px) saturate(0.62) brightness(0.5);
}

:deep(.logout-confirm-dialog__content) {
  width: min(27.5rem, calc(100vw - 2rem));
  margin: 1rem;
}

.logout-confirm-dialog__label {
  color: rgba(194, 211, 228, 0.5);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.logout-confirm-dialog__title {
  margin-top: 0.48rem;
  color: rgba(247, 250, 255, 0.98);
  font-size: 1.45rem;
  font-weight: 760;
  line-height: 1.15;
}

.logout-confirm-dialog__copy {
  margin-top: 0.8rem;
  max-width: 24rem;
  color: rgba(214, 224, 235, 0.76);
  font-size: 0.98rem;
  line-height: 1.5;
}

.logout-confirm-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.45rem;
}

.logout-confirm-dialog__button {
  min-height: 3.2rem;
  border-radius: 14px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.logout-confirm-dialog__button--cancel {
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(226, 234, 242, 0.82);
  background: rgba(255, 255, 255, 0.04);
}

.logout-confirm-dialog__button--cancel:hover {
  border-color: rgba(164, 191, 218, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

.logout-confirm-dialog__button--confirm {
  color: rgba(243, 249, 255, 0.96);
  background:
    linear-gradient(180deg, #c74e4e, #982f2f) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 24px rgba(151, 47, 47, 0.28);
}

.logout-confirm-dialog__button--confirm:hover {
  background:
    linear-gradient(180deg, #d55b5b, #a73737) !important;
}

.logout-confirm-dialog__button:active {
  transform: scale(0.988);
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

  .setup-shell-container {
    padding-inline: 0.75rem;
  }

  .shell-container {
    padding-inline: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .admin-shell-container {
    padding-top: 3.5rem;
  }

  .admin-login-shell-container {
    padding: 0;
  }

  .logout-confirm-dialog {
    padding: 1.35rem;
  }

  .logout-confirm-dialog__actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .logout-confirm-dialog__button {
    min-height: 3.15rem;
  }

  .logout-confirm-dialog__title {
    font-size: 1.3rem;
  }

  .logout-confirm-dialog__copy {
    font-size: 0.94rem;
  }
}
</style>
