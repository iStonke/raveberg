import { createRouter, createWebHistory } from 'vue-router'

import AppShellLayout from '../layouts/AppShellLayout.vue'
import DisplayLayout from '../layouts/DisplayLayout.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import AdminLoginView from '../views/admin/AdminLoginView.vue'
import AdminVideoManagerView from '../views/admin/AdminVideoManagerView.vue'
import GuestUploadView from '../views/guest/GuestUploadView.vue'
import SetupView from '../views/setup/SetupView.vue'
import DisplayView from '../views/display/DisplayView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/guest/upload',
    },
    {
      path: '/',
      component: AppShellLayout,
      children: [
        {
          path: 'guest/upload',
          name: 'guest-upload',
          component: GuestUploadView,
          meta: { audience: 'guest' },
        },
        {
          path: 'admin/login',
          name: 'admin-login',
          component: AdminLoginView,
          meta: { audience: 'admin' },
        },
        {
          path: 'admin/dashboard',
          name: 'admin-dashboard',
          component: AdminDashboardView,
          meta: { audience: 'admin', requiresAuth: true, requiredRole: 'admin' },
        },
        {
          path: 'admin/videos',
          name: 'admin-videos',
          component: AdminVideoManagerView,
          meta: { audience: 'admin', requiresAuth: true, requiredRole: 'admin' },
        },
        {
          path: 'setup',
          name: 'setup',
          component: SetupView,
          meta: { audience: 'setup' },
        },
      ],
    },
    {
      path: '/display',
      component: DisplayLayout,
      children: [
        {
          path: '',
          name: 'display',
          component: DisplayView,
          meta: { audience: 'display' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.isInitialized) {
    await authStore.restoreSession()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    const reason = authStore.consumeSessionIssueReason()
    return {
      name: 'admin-login',
      query: {
        redirect: to.fullPath,
        ...(reason ? { reason } : {}),
      },
    }
  }

  if (to.meta.requiredRole && authStore.role !== to.meta.requiredRole) {
    await authStore.logout()
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'admin-login' && !authStore.isAuthenticated && typeof to.query.reason !== 'string') {
    const reason = authStore.consumeSessionIssueReason()
    if (reason) {
      return {
        name: 'admin-login',
        query: {
          ...to.query,
          reason,
        },
      }
    }
  }

  if (to.name === 'admin-login' && authStore.isAuthenticated) {
    return { name: 'admin-dashboard' }
  }

  return true
})

export default router
