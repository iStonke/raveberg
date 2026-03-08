<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

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
  <v-row justify="center">
    <v-col cols="12" md="6" lg="4">
      <v-card class="pa-6">
        <div class="text-overline mb-2">Admin Login</div>
        <h1 class="text-h4 mb-6">Geschuetzter Bereich</h1>

        <v-form @submit.prevent="submit">
          <v-text-field
            v-model="form.username"
            label="Benutzername"
            prepend-inner-icon="mdi-account"
          />
          <v-text-field
            v-model="form.password"
            label="Passwort"
            type="password"
            prepend-inner-icon="mdi-lock"
          />

          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ errorMessage }}
          </v-alert>

          <v-btn
            type="submit"
            color="primary"
            block
            :loading="isSubmitting"
          >
            Einloggen
          </v-btn>
        </v-form>

        <p class="text-caption mt-4">
          Der Initial-Admin wird serverseitig ueber Environment-Variablen vorbereitet.
        </p>
      </v-card>
    </v-col>
  </v-row>
</template>
