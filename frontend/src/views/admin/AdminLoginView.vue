<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import RavebergLogo from '../../components/branding/RavebergLogo.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  username: 'admin',
  password: '',
})

const isSubmitting = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  isSubmitting.value = true

  try {
    await authStore.login(form)
    const redirect = typeof route.query.redirect === 'string'
      ? route.query.redirect
      : '/admin/dashboard'
    await router.push(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login fehlgeschlagen'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="admin-login-page">
    <div class="admin-login-background" aria-hidden="true">
      <div class="admin-login-background-layer admin-login-background-base" />
      <div class="admin-login-background-layer admin-login-background-orb admin-login-background-orb-a" />
      <div class="admin-login-background-layer admin-login-background-orb admin-login-background-orb-b" />
      <div class="admin-login-background-layer admin-login-background-orb admin-login-background-orb-c" />
      <div class="admin-login-background-layer admin-login-background-glow" />
    </div>

    <div class="admin-login-panel">
      <RavebergLogo mode="compact" class="login-logo" />
      <h1 class="login-headline">Admin anmelden</h1>
      <p class="login-subheadline">Mit deinen Zugangsdaten einloggen</p>

      <v-form class="login-form" @submit.prevent="submit">
        <v-text-field
          v-model="form.username"
          label="Benutzername"
          prepend-inner-icon="mdi-account"
          variant="solo-filled"
          hide-details
          class="login-field"
        />
        <v-text-field
          v-model="form.password"
          label="Passwort"
          type="password"
          prepend-inner-icon="mdi-lock"
          variant="solo-filled"
          hide-details
          class="login-field"
        />

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          class="login-alert"
        >
          {{ errorMessage }}
        </v-alert>

        <v-btn
          type="submit"
          color="primary"
          block
          rounded="xl"
          class="login-submit"
          :loading="isSubmitting"
        >
          Einloggen
        </v-btn>
      </v-form>
    </div>
  </section>
</template>

<style scoped>
@keyframes adminBgMove {
  0% {
    transform: translate3d(-10%, -7%, 0) scale(0.98);
    opacity: 0.72;
  }

  100% {
    transform: translate3d(12%, 10%, 0) scale(1.2);
    opacity: 1;
  }
}

@keyframes adminBgDrift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 0.42;
  }

  100% {
    transform: translate3d(-16%, 12%, 0) scale(1.22);
    opacity: 0.86;
  }
}

.admin-login-page {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 1rem;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -8%, rgba(196, 231, 255, 0.08), transparent 20%),
    linear-gradient(180deg, #0f233b 0%, #091828 34%, #040c16 68%, #02060b 100%);
}

.admin-login-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.admin-login-background-layer {
  position: absolute;
  inset: 0;
}

.admin-login-background-base {
  background:
    radial-gradient(circle at 48% 12%, rgba(178, 222, 255, 0.2), transparent 22%),
    radial-gradient(circle at 18% 24%, rgba(108, 226, 255, 0.08), transparent 18%),
    radial-gradient(circle at 84% 78%, rgba(0, 0, 0, 0.78), transparent 26%),
    radial-gradient(circle at 18% 88%, rgba(0, 0, 0, 0.62), transparent 22%),
    linear-gradient(180deg, rgba(33, 73, 120, 0.14), rgba(2, 7, 14, 0.58));
}

.admin-login-background-orb {
  inset: -24%;
  filter: blur(40px);
  opacity: 0.98;
  will-change: transform;
}

.admin-login-background-orb-a {
  background:
    radial-gradient(circle at 34% 24%, rgba(158, 222, 255, 0.48), transparent 14%),
    radial-gradient(circle at 42% 32%, rgba(67, 154, 255, 0.16), transparent 20%),
    radial-gradient(circle at 68% 72%, rgba(0, 0, 0, 0.42), transparent 26%);
  animation: adminBgMove 7s ease-in-out infinite alternate;
}

.admin-login-background-orb-b {
  background:
    radial-gradient(circle at 72% 24%, rgba(41, 136, 255, 0.34), transparent 16%),
    radial-gradient(circle at 64% 18%, rgba(9, 29, 77, 0.58), transparent 22%),
    radial-gradient(circle at 32% 82%, rgba(0, 0, 0, 0.46), transparent 24%);
  animation: adminBgDrift 8.5s ease-in-out infinite alternate;
}

.admin-login-background-orb-c {
  background:
    radial-gradient(circle at 46% 78%, rgba(96, 235, 255, 0.16), transparent 14%),
    radial-gradient(circle at 54% 72%, rgba(6, 20, 52, 0.58), transparent 22%),
    radial-gradient(circle at 74% 20%, rgba(0, 0, 0, 0.44), transparent 22%);
  animation: adminBgMove 10s ease-in-out infinite alternate-reverse;
}

.admin-login-background-glow {
  inset: -8%;
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.06), transparent 10%),
    radial-gradient(circle at 52% 58%, rgba(37, 125, 255, 0.1), transparent 20%),
    radial-gradient(circle at 30% 84%, rgba(4, 16, 41, 0.54), transparent 16%),
    radial-gradient(circle at 78% 88%, rgba(0, 0, 0, 0.42), transparent 18%);
  filter: blur(22px);
  animation: adminBgDrift 11s ease-in-out infinite alternate-reverse;
}

.admin-login-panel {
  position: relative;
  width: min(100%, 28rem);
  padding: clamp(1.35rem, 4vw, 1.9rem);
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(25, 34, 46, 0.14), rgba(8, 12, 18, 0.34)),
    rgba(10, 15, 20, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 24px 72px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(28px) saturate(145%);
  -webkit-backdrop-filter: blur(28px) saturate(145%);
}

.login-logo {
  width: min(100%, 12rem);
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 14px 30px rgba(56, 148, 255, 0.16));
}

.login-headline {
  margin: 1rem 0 0;
  text-align: center;
  font-size: clamp(1.2rem, 4.4vw, 1.45rem);
  font-weight: 600;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 0 12px rgba(82, 178, 255, 0.08);
}

.login-subheadline {
  margin: 0.18rem 0 0;
  text-align: center;
  font-size: 0.94rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.74);
}

.login-form {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.45rem;
}

.login-field :deep(.v-field) {
  border-radius: 1.2rem;
  background: rgba(255, 255, 255, 0.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 24px rgba(0, 0, 0, 0.12);
}

.login-field :deep(.v-field__overlay) {
  opacity: 0.04;
}

.login-field :deep(.v-field__input),
.login-field :deep(.v-label),
.login-field :deep(.v-field__prepend-inner) {
  color: rgba(241, 246, 255, 0.86);
}

.login-alert {
  margin-top: 0.1rem;
}

.login-submit {
  min-height: 3.5rem;
  margin-top: 0.1rem;
  box-shadow: 0 16px 36px rgba(0, 146, 255, 0.24);
}

.login-submit :deep(.v-btn__content) {
  font-weight: 600;
  letter-spacing: 0.01em;
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .admin-login-panel {
    background: linear-gradient(180deg, rgba(20, 39, 63, 0.82), rgba(10, 24, 42, 0.9));
  }
}

@media (min-width: 640px) {
  .admin-login-page {
    padding: 1.4rem;
  }
}
</style>
