<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps<{
  username: string
  hostname: string
  ipAddress: string
  networkName: string
  networkStateLabel: string
  sessionTimeoutHours: number
  sessionTimeoutLabel: string
  sessionExpiresAtLabel: string
  sessionIsExpired: boolean
  setupModeEnabled: boolean
  storageFreeLabel: string
  cpuLoadLabel: string
  memoryPercentLabel: string
  temperatureLabel: string
  accessResetCounter: number
  accessSaving: boolean
  securitySaving: boolean
  sessionRestarting: boolean
  isRestartingSystem: boolean
  isShuttingDown: boolean
  isTogglingSetupMode: boolean
}>()

const emit = defineEmits<{
  'save-access': [payload: { username: string; current_password: string; new_password: string }]
  restart: []
  shutdown: []
  'toggle-setup-mode': []
  'save-session-timeout': [payload: { sessionTimeoutHours: number }]
  'restart-session': []
}>()

const accessForm = reactive({
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const sessionTimeoutMenuOpen = ref(false)

const sessionTimeoutOptions = [
  { title: '1 Stunde', value: 1 },
  { title: '6 Stunden', value: 6 },
  { title: '12 Stunden', value: 12 },
  { title: '24 Stunden', value: 24 },
  { title: '48 Stunden', value: 48 },
  { title: '72 Stunden', value: 72 },
] as const

watch(
  () => props.username,
  (value) => {
    accessForm.username = value
  },
  { immediate: true },
)

watch(
  () => props.accessResetCounter,
  (value, previousValue) => {
    if (value === previousValue) {
      return
    }
    accessForm.currentPassword = ''
    accessForm.newPassword = ''
    accessForm.confirmPassword = ''
  },
)

const accessDirty = computed(() =>
  accessForm.username.trim() !== props.username.trim()
  || Boolean(accessForm.currentPassword)
  || Boolean(accessForm.newPassword)
  || Boolean(accessForm.confirmPassword),
)

const accessValidationMessage = computed(() => {
  if (!accessDirty.value) {
    return ''
  }

  const username = accessForm.username.trim()
  if (!username) {
    return 'Bitte einen Benutzernamen eingeben.'
  }
  if (username.length < 3) {
    return 'Der Benutzername muss mindestens 3 Zeichen lang sein.'
  }
  if (!accessForm.currentPassword) {
    return 'Für Änderungen wird das aktuelle Passwort benötigt.'
  }

  const wantsPasswordChange = Boolean(accessForm.newPassword || accessForm.confirmPassword)

  if (!wantsPasswordChange && username !== props.username.trim()) {
    return ''
  }
  if (wantsPasswordChange && accessForm.newPassword.length < 8) {
    return 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'
  }
  if (wantsPasswordChange && accessForm.newPassword !== accessForm.confirmPassword) {
    return 'Die neuen Passwörter stimmen nicht überein.'
  }

  if (
    wantsPasswordChange
    && !accessForm.newPassword
    && username === props.username.trim()
  ) {
    return 'Bitte ein neues Passwort eingeben.'
  }

  return ''
})

const accessCanSave = computed(() =>
  accessDirty.value && !props.accessSaving && !accessValidationMessage.value,
)

const setupModeActionLabel = computed(() => 'Netzwerk wechseln')

function resetAccessForm() {
  accessForm.username = props.username
  accessForm.currentPassword = ''
  accessForm.newPassword = ''
  accessForm.confirmPassword = ''
}

function submitAccess() {
  if (!accessCanSave.value) {
    return
  }

  emit('save-access', {
    username: accessForm.username.trim(),
    current_password: accessForm.currentPassword,
    new_password: accessForm.newPassword,
  })
}

function updateSessionTimeout(value: number) {
  sessionTimeoutMenuOpen.value = false

  if (value === props.sessionTimeoutHours || props.securitySaving) {
    return
  }

  emit('save-session-timeout', {
    sessionTimeoutHours: value,
  })
}
</script>

<template>
  <section class="system-settings">
    <div class="system-settings__grid">
      <section class="system-section system-section--status">
        <div class="system-section__header">
          <div class="system-section__eyebrow">Systemstatus</div>
        </div>

        <div class="system-status-stack">
          <div class="system-status-strip">
            <div class="system-status-chip">
              <span class="system-status-chip__label">Netz</span>
              <span class="system-status-chip__value">{{ networkStateLabel }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">WLAN</span>
              <span class="system-status-chip__value">{{ networkName }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">IP</span>
              <span class="system-status-chip__value">{{ ipAddress }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">Hostname</span>
              <span class="system-status-chip__value">{{ hostname }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">Speicher</span>
              <span class="system-status-chip__value">{{ storageFreeLabel }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">CPU</span>
              <span class="system-status-chip__value">{{ cpuLoadLabel }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">RAM</span>
              <span class="system-status-chip__value">{{ memoryPercentLabel }}</span>
            </div>
            <div class="system-status-chip">
              <span class="system-status-chip__label">Temperatur</span>
              <span class="system-status-chip__value">{{ temperatureLabel }}</span>
            </div>
          </div>

          <div class="field-card system-network-card">
            <div class="field-card__label">Netzwerk</div>
            <div class="system-status-note">
              Setup-Modus starten, um das WLAN neu auszuwählen oder die Netzwerkverbindung des Geräts zu ändern.
            </div>

            <div class="device-actions">
              <button
                type="button"
                class="device-action-chip"
                :disabled="isTogglingSetupMode"
                @click="emit('toggle-setup-mode')"
              >
                <v-icon icon="mdi-wifi-cog" size="16" />
                <span>{{ setupModeActionLabel }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="system-section">
        <div class="system-section__header">
          <div class="system-section__eyebrow">Zugang</div>
        </div>

        <div class="access-layout">
          <div class="access-field">
            <div class="field-card__label field-card__label--compact">Benutzername</div>
            <v-text-field
              v-model="accessForm.username"
              class="system-text-input system-text-input--compact"
              variant="solo"
              density="comfortable"
              placeholder="Admin-Benutzername"
              hide-details
            />
          </div>

          <div class="access-password-group">
            <div class="access-password-group__label">Passwort</div>

            <div class="access-field-grid">
              <div class="access-field">
                <div class="field-card__label field-card__label--compact">Aktuelles Passwort</div>
                <v-text-field
                  v-model="accessForm.currentPassword"
                  class="system-text-input system-text-input--compact"
                  :type="showCurrentPassword ? 'text' : 'password'"
                  variant="solo"
                  density="comfortable"
                  placeholder="Aktuelles Passwort eingeben"
                  hide-details
                >
                  <template #append-inner>
                    <button
                      type="button"
                      class="field-visibility-btn"
                      :aria-label="showCurrentPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'"
                      @click="showCurrentPassword = !showCurrentPassword"
                    >
                      <v-icon :icon="showCurrentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="15" />
                    </button>
                  </template>
                </v-text-field>
              </div>

              <div class="access-field">
                <div class="field-card__label field-card__label--compact">Neues Passwort</div>
                <v-text-field
                  v-model="accessForm.newPassword"
                  class="system-text-input system-text-input--compact"
                  :type="showNewPassword ? 'text' : 'password'"
                  variant="solo"
                  density="comfortable"
                  placeholder="Mindestens 8 Zeichen"
                  hide-details
                >
                  <template #append-inner>
                    <button
                      type="button"
                      class="field-visibility-btn"
                      :aria-label="showNewPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'"
                      @click="showNewPassword = !showNewPassword"
                    >
                      <v-icon :icon="showNewPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="15" />
                    </button>
                  </template>
                </v-text-field>
              </div>

              <div class="access-field access-field--full">
                <div class="field-card__label field-card__label--compact">Passwort wiederholen</div>
                <v-text-field
                  v-model="accessForm.confirmPassword"
                  class="system-text-input system-text-input--compact"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  variant="solo"
                  density="comfortable"
                  placeholder="Passwort identisch wiederholen"
                  hide-details
                >
                  <template #append-inner>
                    <button
                      type="button"
                      class="field-visibility-btn"
                      :aria-label="showConfirmPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <v-icon :icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="15" />
                    </button>
                  </template>
                </v-text-field>
              </div>
            </div>
          </div>
        </div>

        <div v-if="accessValidationMessage" class="section-hint section-hint--warning">
          {{ accessValidationMessage }}
        </div>
        <v-expand-transition>
          <div v-if="accessDirty" class="section-actions">
            <v-btn
              variant="flat"
              class="section-actions__button section-actions__button--primary"
              :disabled="!accessCanSave"
              :loading="accessSaving"
              @click="submitAccess"
            >
              Speichern
            </v-btn>
            <v-btn
              variant="text"
              class="section-actions__button"
              :disabled="accessSaving"
              @click="resetAccessForm"
            >
              Verwerfen
            </v-btn>
          </div>
        </v-expand-transition>
      </section>

      <section class="system-section">
        <div class="system-section__header">
          <div class="system-section__eyebrow">Session</div>
          <div class="system-section__copy">
            {{ sessionIsExpired ? 'Die aktuelle Session ist abgelaufen.' : `Aktuelle Session bis ${sessionExpiresAtLabel} Uhr.` }}
          </div>
        </div>

        <div class="session-block">
          <v-menu
            v-model="sessionTimeoutMenuOpen"
            location="bottom end"
            offset="8"
          >
            <template #activator="{ props: menuProps }">
              <v-btn
                variant="text"
                class="session-timeout-row"
                :disabled="securitySaving"
                v-bind="menuProps"
              >
                <span class="session-timeout-row__label">{{ sessionTimeoutLabel }}</span>
                <v-icon icon="mdi-chevron-down" size="18" />
              </v-btn>
            </template>

            <v-list class="system-select-menu" bg-color="surface">
              <v-list-item
                v-for="item in sessionTimeoutOptions"
                :key="item.value"
                :active="sessionTimeoutHours === item.value"
                @click="updateSessionTimeout(item.value)"
              >
                <v-list-item-title>{{ item.title }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-btn
            variant="text"
            class="session-timeout-row session-timeout-row--action"
            :loading="sessionRestarting"
            :disabled="securitySaving || sessionRestarting"
            @click="emit('restart-session')"
          >
            <span class="session-timeout-row__label">
              {{ sessionIsExpired ? 'Session neu starten' : 'Session verlängern' }}
            </span>
            <v-icon icon="mdi-refresh" size="18" />
          </v-btn>
        </div>
      </section>

      <div class="danger-zone danger-zone--standalone">
        <div class="danger-zone__grid">
          <article class="danger-card danger-card--warning">
            <div class="danger-card__copy">
              <div class="danger-card__title">Neustart</div>
              <div class="danger-card__meta">Startet den Raspberry Pi neu und fährt den Stack danach wieder hoch.</div>
            </div>
            <v-btn
              variant="tonal"
              color="warning"
              class="danger-card__button"
              prepend-icon="mdi-restart"
              :loading="isRestartingSystem"
              @click="emit('restart')"
            >
              Neustart
            </v-btn>
          </article>

          <article class="danger-card">
            <div class="danger-card__copy">
              <div class="danger-card__title">Ausschalten</div>
              <div class="danger-card__meta">Beendet den lokalen Betrieb und schaltet das Gerät kontrolliert aus.</div>
            </div>
            <v-btn
              variant="tonal"
              color="error"
              class="danger-card__button"
              prepend-icon="mdi-power"
              :loading="isShuttingDown"
              @click="emit('shutdown')"
            >
              Ausschalten
            </v-btn>
          </article>
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>
.system-settings {
  min-width: 0;
}

.system-settings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.system-section {
  position: relative;
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1.15rem;
  border-radius: 24px;
  border: 1px solid rgba(153, 191, 223, 0.12);
  background:
    radial-gradient(circle at top right, rgba(74, 202, 255, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(14, 23, 35, 0.94), rgba(9, 17, 27, 0.92));
  box-shadow:
    0 18px 44px rgba(3, 9, 17, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(120, 165, 206, 0.03);
  overflow: hidden;
}

.system-section::after {
  display: none;
}

.system-section--status {
  grid-column: 1 / -1;
}

.system-section__header {
  display: grid;
  gap: 0.35rem;
}

.system-section__eyebrow {
  color: rgba(215, 228, 241, 0.52);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.system-section__copy {
  color: rgba(206, 219, 232, 0.62);
  font-size: 0.92rem;
  line-height: 1.5;
}

.system-status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.system-status-stack {
  display: grid;
  gap: 0.85rem;
}

.system-network-card {
  gap: 0.75rem;
  padding: 1rem;
}

.system-network-card {
  align-items: start;
}

.system-status-note {
  max-width: 34rem;
  color: rgba(198, 212, 226, 0.64);
  font-size: 0.84rem;
  line-height: 1.5;
}

.system-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.2rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(88, 182, 255, 0.22);
  background:
    radial-gradient(circle at top, rgba(86, 214, 231, 0.18), transparent 72%),
    linear-gradient(180deg, rgba(12, 24, 38, 0.96), rgba(8, 16, 26, 0.96));
  box-shadow:
    0 10px 20px rgba(4, 10, 18, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(86, 214, 231, 0.04);
}

.system-status-chip__label {
  color: rgba(110, 205, 236, 0.82);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-shadow: 0 0 16px rgba(86, 214, 231, 0.12);
}

.system-status-chip__value {
  color: rgba(247, 250, 255, 0.98);
  font-size: 0.8rem;
  font-weight: 760;
  text-shadow:
    0 0 20px rgba(90, 185, 255, 0.08),
    0 0 10px rgba(255, 255, 255, 0.04);
}

.field-card-list {
  display: grid;
  gap: 0.72rem;
}

.session-block {
  display: grid;
  gap: 0.85rem;
}

.access-layout {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.access-field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem 0.75rem;
}

.access-field {
  display: grid;
  gap: 0.38rem;
  min-width: 0;
}

.access-field--full {
  grid-column: 1 / -1;
}

.access-password-group {
  display: grid;
  gap: 0.72rem;
  padding-top: 0.1rem;
}

.access-password-group__label {
  color: rgba(171, 193, 213, 0.6);
  font-size: 0.71rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.field-card {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
  padding: 0.92rem;
  border-radius: 18px;
  border: 1px solid rgba(157, 190, 220, 0.08);
  background: rgba(255, 255, 255, 0.025);
}

.field-card--compact {
  gap: 0.55rem;
}

.field-card__label {
  color: rgba(223, 232, 241, 0.84);
  font-size: 0.8rem;
  font-weight: 680;
  line-height: 1.2;
}

.field-card__label--compact {
  font-size: 0.78rem;
}

.field-card__meta {
  color: rgba(198, 212, 226, 0.56);
  font-size: 0.8rem;
  line-height: 1.42;
}

.field-card__readonly-value {
  color: rgba(245, 249, 255, 0.96);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-word;
}

.session-timeout-row {
  justify-content: space-between;
  min-height: 2.85rem;
  padding-inline: 0.95rem !important;
  border-radius: 16px !important;
  border: 1px solid rgba(154, 186, 217, 0.1) !important;
  background: rgba(16, 27, 39, 0.72) !important;
  color: rgba(241, 247, 255, 0.96) !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-size: 0.92rem !important;
  font-weight: 700 !important;
}

.session-timeout-row__label {
  color: inherit;
}

.field-visibility-btn {
  width: 1.65rem;
  height: 1.65rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(192, 211, 228, 0.72);
  cursor: pointer;
}

.section-hint {
  padding: 0.72rem 0.85rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 195, 94, 0.12);
  background: rgba(110, 72, 20, 0.16);
  color: rgba(255, 222, 164, 0.92);
  font-size: 0.84rem;
  line-height: 1.45;
}

.section-hint--info {
  border-color: rgba(87, 196, 228, 0.14);
  background: rgba(10, 54, 71, 0.18);
  color: rgba(188, 232, 245, 0.92);
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.section-actions__button {
  min-height: 2.7rem;
  padding-inline: 1rem;
  border-radius: 14px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.section-actions__button--primary {
  color: rgba(245, 250, 255, 0.98) !important;
  background:
    linear-gradient(180deg, rgba(69, 197, 216, 0.98), rgba(29, 150, 172, 0.98)) !important;
  box-shadow:
    0 12px 26px rgba(12, 93, 110, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.system-select-menu {
  border-radius: 16px !important;
  border: 1px solid rgba(154, 186, 217, 0.1);
  background: rgba(11, 17, 25, 0.96) !important;
  box-shadow:
    0 18px 32px rgba(3, 9, 17, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
}

.security-chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.security-chip {
  appearance: none;
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  padding: 0.9rem;
  border-radius: 18px;
  border: 1px solid rgba(156, 189, 218, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 150ms ease,
    box-shadow 180ms ease;
}

.security-chip:hover {
  border-color: rgba(97, 208, 223, 0.2);
  background: rgba(255, 255, 255, 0.05);
}

.security-chip:active {
  transform: scale(0.988);
}

.security-chip--active {
  border-color: rgba(74, 213, 187, 0.28);
  background:
    radial-gradient(circle at top right, rgba(63, 204, 165, 0.14), transparent 56%),
    rgba(14, 29, 31, 0.78);
  box-shadow:
    0 0 0 1px rgba(63, 204, 165, 0.08),
    0 14px 28px rgba(4, 14, 13, 0.18);
}

.security-chip__title {
  color: rgba(243, 248, 255, 0.94);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
}

.security-chip__value {
  color: rgba(191, 207, 221, 0.62);
  font-size: 0.78rem;
  font-weight: 650;
}

.device-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.device-action-chip {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(89, 214, 228, 0.16);
  background: rgba(17, 38, 46, 0.78);
  color: rgba(205, 241, 247, 0.94);
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
}

.device-action-chip:disabled {
  opacity: 0.65;
  cursor: wait;
}

.danger-zone {
  display: grid;
  gap: 0.8rem;
  padding-top: 0.2rem;
}

.danger-zone--standalone {
  position: relative;
  grid-column: 1 / -1;
  padding-top: 0;
}

.danger-zone__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.danger-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  border: 1px solid rgba(255, 109, 109, 0.12);
  background: rgba(82, 24, 29, 0.18);
}

.danger-card--warning {
  border-color: rgba(255, 181, 90, 0.18);
  background: rgba(100, 57, 17, 0.18);
}

.danger-card__copy {
  display: grid;
  gap: 0.24rem;
}

.danger-card__title {
  color: rgba(248, 242, 244, 0.98);
  font-size: 1rem;
  font-weight: 760;
  line-height: 1.2;
}

.danger-card__meta {
  color: rgba(213, 221, 230, 0.62);
  font-size: 0.82rem;
  line-height: 1.42;
}

.danger-card__button {
  min-height: 2.7rem;
  padding-inline: 1rem;
  border-radius: 14px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

:deep(.system-text-input .v-field),
:deep(.system-select .v-field) {
  border-radius: 16px;
  border: 1px solid rgba(154, 186, 217, 0.1);
  background: rgba(16, 27, 39, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    0 0 0 1px rgba(255, 255, 255, 0.008);
}

:deep(.system-text-input .v-field__outline),
:deep(.system-select .v-field__outline),
:deep(.system-text-input .v-field__overlay),
:deep(.system-select .v-field__overlay) {
  display: none;
}

:deep(.system-text-input .v-field__input),
:deep(.system-select .v-field__input) {
  min-height: 48px;
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.92rem;
}

:deep(.system-text-input--compact .v-field__input) {
  min-height: 44px;
  padding-top: 0;
  padding-bottom: 0;
  font-size: 0.88rem;
}

:deep(.system-text-input--compact .v-field__append-inner) {
  padding-top: 0;
}

:deep(.system-select .v-select__selection) {
  color: rgba(245, 249, 255, 0.96);
}

:deep(.system-text-input .v-field--focused),
:deep(.system-select .v-field--focused) {
  border-color: rgba(89, 214, 228, 0.42);
  box-shadow:
    0 0 0 1px rgba(89, 214, 228, 0.18),
    0 12px 28px rgba(5, 16, 27, 0.16);
}

@media (max-width: 959px) {
  .system-settings__grid,
  .danger-zone__grid,
  .security-chip-grid {
    grid-template-columns: 1fr;
  }

  .access-field-grid {
    grid-template-columns: 1fr;
  }

  .system-section {
    padding: 1rem;
  }

  .danger-card {
    flex-direction: column;
    align-items: stretch;
  }

  .danger-card__button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .section-actions {
    flex-direction: column;
  }

  .section-actions__button {
    width: 100%;
  }
}
</style>
