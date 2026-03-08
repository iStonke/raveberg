import { createRouter, createWebHistory } from 'vue-router'

import AppShellLayout from '../layouts/AppShellLayout.vue'
import DisplayLayout from '../layouts/DisplayLayout.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import AdminLoginView from '../views/admin/AdminLoginView.vue'
import GuestUploadView from '../views/guest/GuestUploadView.vue'
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
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiredRole && authStore.role !== to.meta.requiredRole) {
    await authStore.logout()
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'admin-login' && authStore.isAuthenticated) {
    return { name: 'admin-dashboard' }
  }

  return true
})

export default router
