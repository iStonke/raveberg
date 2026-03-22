import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { SessionUser } from '../services/api'
import { fetchSession, loginAdmin, logoutAdmin } from '../services/api'

const AUTH_TOKEN_KEY = 'raveberg-admin-token'
type SessionStatus = 'loading' | 'authenticated' | 'anonymous'
export type SessionIssueReason = 'session_expired' | 'session_invalid' | 'session_missing'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<SessionUser | null>(null)
  const sessionStatus = ref<SessionStatus>('loading')
  const isInitialized = ref(false)
  const lastSessionIssueReason = ref<SessionIssueReason | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))
  const username = computed(() => user.value?.username ?? null)
  const role = computed(() => user.value?.role ?? null)

  async function login(credentials: { username: string; password: string }) {
    const session = await loginAdmin(credentials.username, credentials.password)
    token.value = session.access_token
    user.value = session.user
    sessionStatus.value = 'authenticated'
    lastSessionIssueReason.value = null
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
      lastSessionIssueReason.value = null
    } catch (error) {
      clearSessionState()
      lastSessionIssueReason.value = resolveSessionIssueReason(error)
    } finally {
      isInitialized.value = true
    }
  }

  function clearSessionState() {
    token.value = null
    user.value = null
    sessionStatus.value = 'anonymous'
    localStorage.removeItem(AUTH_TOKEN_KEY)
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

    clearSessionState()
    lastSessionIssueReason.value = null
  }

  function consumeSessionIssueReason() {
    const nextReason = lastSessionIssueReason.value
    lastSessionIssueReason.value = null
    return nextReason
  }

  function applySessionUser(nextUser: SessionUser) {
    user.value = nextUser
  }

  function resolveSessionIssueReason(error: unknown): SessionIssueReason {
    const message = error instanceof Error ? error.message : ''
    const normalized = message.toLowerCase()

    if (normalized.includes('session expired')) {
      return 'session_expired'
    }

    if (normalized.includes('session not found')) {
      return 'session_missing'
    }

    return 'session_invalid'
  }

  return {
    token,
    user,
    username,
    role,
    sessionStatus,
    isInitialized,
    lastSessionIssueReason,
    isAuthenticated,
    login,
    restoreSession,
    logout,
    consumeSessionIssueReason,
    applySessionUser,
  }
})
