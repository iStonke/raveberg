import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { SessionUser } from '../services/api'
import { fetchSession, loginAdmin, logoutAdmin } from '../services/api'

const AUTH_TOKEN_KEY = 'raveberg-admin-token'
type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<SessionUser | null>(null)
  const sessionStatus = ref<SessionStatus>('loading')
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const username = computed(() => user.value?.username ?? null)
  const role = computed(() => user.value?.role ?? null)

  async function login(credentials: { username: string; password: string }) {
    const session = await loginAdmin(credentials.username, credentials.password)
    token.value = session.access_token
    user.value = session.user
    sessionStatus.value = 'authenticated'
    localStorage.setItem(AUTH_TOKEN_KEY, session.access_token)
  }

  async function restoreSession() {
    const existingToken = localStorage.getItem(AUTH_TOKEN_KEY)

    if (!existingToken) {
      sessionStatus.value = 'anonymous'
      isInitialized.value = true
      return
    }

    try {
      const session = await fetchSession(existingToken)
      token.value = session.access_token
      user.value = session.user
      sessionStatus.value = 'authenticated'
    } catch {
      await logout()
    } finally {
      isInitialized.value = true
    }
  }

  async function logout() {
    const existingToken = token.value
    if (existingToken) {
      try {
        await logoutAdmin(existingToken)
      } catch {
        // Ignore remote logout failure and clear local state regardless.
      }
    }

    token.value = null
    user.value = null
    sessionStatus.value = 'anonymous'
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  return {
    token,
    user,
    username,
    role,
    sessionStatus,
    isInitialized,
    isAuthenticated,
    login,
    restoreSession,
    logout,
  }
})
