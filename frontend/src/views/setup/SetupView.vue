<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import RavebergLogo from '../../components/branding/RavebergLogo.vue'
import { usePublicRuntimeStore } from '../../stores/publicRuntime'
import {
  connectWifi,
  connectWifiFromSetup,
  fetchNetworkStatus,
  fetchSetupModeStatus,
  fetchWifiScan,
  type NetworkStatus,
  type SetupModeStatus,
  type WifiScanResult,
} from '../../services/api'

const publicRuntimeStore = usePublicRuntimeStore()
const wifiNetworks = ref<WifiScanResult[]>([])
const networkStatus = ref<NetworkStatus>({
  online: false,
  connected: false,
  ssid: null,
  ip: null,
  signal_percent: null,
  signal_bars: 0,
  setup_mode: false,
  network_mode: 'normal',
})
const setupModeStatus = ref<SetupModeStatus>({
  enabled: false,
  ssid: 'RaveBerg-Setup',
  ip: '192.168.4.1',
  portal_url: 'http://192.168.4.1/setup',
  last_error: null,
  connect_state: 'idle',
  connecting_to_ssid: null,
  last_transition_at: null,
})
const selectedSsid = ref('')
const password = ref('')
const showPassword = ref(false)
const isBooting = ref(true)
const isScanning = ref(false)
const isConnecting = ref(false)
const scanError = ref('')
const submitError = ref('')
const submitMessage = ref('')

const adminToken = computed(() => localStorage.getItem('raveberg-admin-token') || '')
const fallbackUrl = computed(() => `http://${setupModeStatus.value.ip || '192.168.4.1'}`)
const canSubmit = computed(() => selectedSsid.value.trim().length > 0 && !isConnecting.value)
const selectedNetwork = computed(() => wifiNetworks.value.find((network) => network.ssid === selectedSsid.value) ?? null)
const connectHeadline = computed(() => {
  if (setupModeStatus.value.connect_state === 'pending' || isConnecting.value) {
    return `Verbinde mit ${setupModeStatus.value.connecting_to_ssid || selectedSsid.value || 'dem WLAN'}`
  }
  if (setupModeStatus.value.connect_state === 'succeeded') {
    return 'Verbindung hergestellt'
  }
  if (setupModeStatus.value.connect_state === 'failed') {
    return 'Verbindung fehlgeschlagen'
  }
  return 'WLAN einrichten'
})

onMounted(async () => {
  try {
    if (!publicRuntimeStore.isLoaded) {
      await publicRuntimeStore.refresh()
    }
  } catch {
    // Keep setup flow available even if public runtime info is temporarily missing.
  }

  await refreshSetupContext()
  isBooting.value = false
})

async function refreshSetupContext() {
  submitError.value = ''

  const token = adminToken.value || undefined
  const [setupResult, networkResult] = await Promise.allSettled([
    fetchSetupModeStatus(token),
    fetchNetworkStatus(token),
  ])

  if (setupResult.status === 'fulfilled') {
    setupModeStatus.value = setupResult.value
    if (setupModeStatus.value.last_error && setupModeStatus.value.connect_state === 'failed') {
      submitError.value = setupModeStatus.value.last_error
    }
  }

  if (networkResult.status === 'fulfilled') {
    networkStatus.value = networkResult.value
  }

  await scanNetworks()
}

async function scanNetworks() {
  isScanning.value = true
  scanError.value = ''

  try {
    wifiNetworks.value = await fetchWifiScan(adminToken.value || undefined)
  } catch (error) {
    scanError.value = error instanceof Error ? error.message : 'WLAN-Scan konnte nicht geladen werden'
  } finally {
    isScanning.value = false
  }
}

function chooseNetwork(network: WifiScanResult) {
  selectedSsid.value = network.ssid
  submitError.value = ''
  submitMessage.value = ''
}

async function submitConnection() {
  if (!canSubmit.value) {
    return
  }

  isConnecting.value = true
  submitError.value = ''
  submitMessage.value = ''

  try {
    const payload = {
      ssid: selectedSsid.value.trim(),
      password: password.value,
    }
    const response = adminToken.value
      ? await connectWifi(payload, adminToken.value)
      : await connectWifiFromSetup(payload)

    submitMessage.value = response.pending
      ? `Verbunden mit ${payload.ssid}. RaveBerg wechselt jetzt ins Event-Netzwerk.`
      : response.message
    password.value = ''

    if (response.setup_mode_status) {
      setupModeStatus.value = response.setup_mode_status
    }
    if (response.network_status) {
      networkStatus.value = response.network_status
    }
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'WLAN-Verbindung konnte nicht gestartet werden'
  } finally {
    isConnecting.value = false
  }
}

function signalGlyph(signal: number | null) {
  const normalized = Math.max(0, Math.min(Math.round(signal ?? 0), 100))
  const bars = normalized >= 80 ? 5 : normalized >= 60 ? 4 : normalized >= 40 ? 3 : normalized >= 20 ? 2 : 1
  return `${'█'.repeat(bars)}${'░'.repeat(5 - bars)}`
}
</script>

<template>
  <section class="setup-shell">
    <div class="setup-hero">
      <div class="setup-hero__brand">
        <RavebergLogo mode="compact" />
      </div>
      <div class="setup-hero__copy">
        <div class="setup-hero__eyebrow">Setup-Portal</div>
        <h1 class="setup-hero__title">{{ connectHeadline }}</h1>
        <p class="setup-hero__text">
          Bitte WLAN fuer das Event auswaehlen. Falls sich nichts automatisch geoeffnet hat, nutze
          <strong>{{ fallbackUrl }}</strong>.
        </p>
      </div>
    </div>

    <article class="setup-card setup-card--status">
      <div class="setup-card__label">Status</div>
      <div class="setup-status-grid">
        <div>
          <div class="setup-status-grid__title">
            {{ setupModeStatus.enabled ? 'Setup-Modus aktiv' : networkStatus.online ? 'Online' : 'Offline' }}
          </div>
          <div class="setup-status-grid__text">
            SSID: {{ networkStatus.ssid || setupModeStatus.ssid }}
          </div>
          <div class="setup-status-grid__text">
            IP-Adresse: {{ networkStatus.ip || setupModeStatus.ip }}
          </div>
        </div>
        <div class="setup-status-grid__portal">
          <span class="setup-badge">{{ setupModeStatus.enabled ? 'Captive Portal aktiv' : 'Portal inaktiv' }}</span>
        </div>
      </div>
      <div class="setup-status-grid__hint">
        Falls die Seite nicht automatisch erscheint: {{ fallbackUrl }}
      </div>
    </article>

    <article class="setup-card">
      <div class="setup-card__header">
        <div>
          <div class="setup-card__label">Verfuegbare Netzwerke</div>
          <div class="setup-card__title">WLAN-Scan</div>
        </div>
        <v-btn
          variant="outlined"
          size="small"
          class="setup-card__action"
          prepend-icon="mdi-refresh"
          :loading="isScanning"
          @click="scanNetworks"
        >
          Neu scannen
        </v-btn>
      </div>

      <v-alert v-if="scanError" type="error" variant="tonal" class="setup-alert">
        {{ scanError }}
      </v-alert>

      <div v-else-if="isBooting || isScanning" class="setup-empty">
        Suche nach WLANs in der Umgebung...
      </div>

      <div v-else-if="wifiNetworks.length" class="wifi-network-list">
        <button
          v-for="network in wifiNetworks"
          :key="network.ssid"
          type="button"
          class="wifi-network-row"
          :class="{ 'wifi-network-row--active': selectedSsid === network.ssid }"
          @click="chooseNetwork(network)"
        >
          <div class="wifi-network-row__main">
            <div class="wifi-network-row__ssid">{{ network.ssid }}</div>
            <div class="wifi-network-row__meta">
              <span class="wifi-network-row__signal">{{ signalGlyph(network.signal) }} {{ network.signal }}%</span>
              <span class="setup-badge setup-badge--quiet">{{ network.security }}</span>
              <span v-if="network.active" class="setup-badge setup-badge--active">Aktiv</span>
            </div>
          </div>
          <v-icon icon="mdi-chevron-right" size="18" />
        </button>
      </div>

      <div v-else class="setup-empty">
        Keine sichtbaren WLANs gefunden. Bitte erneut scannen oder naeher an den Router gehen.
      </div>
    </article>

    <article class="setup-card">
      <div class="setup-card__label">Verbinden</div>
      <div class="setup-card__title">{{ selectedNetwork?.ssid || 'WLAN waehlen' }}</div>
      <div class="setup-card__form">
        <v-text-field
          v-model="selectedSsid"
          class="setup-input"
          variant="solo"
          hide-details
          density="comfortable"
          label="SSID"
          placeholder="Netzwerkname"
        />

        <v-text-field
          v-model="password"
          class="setup-input"
          :type="showPassword ? 'text' : 'password'"
          variant="solo"
          hide-details
          density="comfortable"
          label="Passwort"
          autocomplete="current-password"
          placeholder="Passwort"
          :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
          @click:append-inner="showPassword = !showPassword"
        />

        <div class="setup-card__helper">
          Nach erfolgreicher Verbindung endet das Setup-WLAN und RaveBerg wechselt ins Event-Netzwerk.
        </div>

        <v-alert v-if="submitError" type="error" variant="tonal" class="setup-alert">
          {{ submitError }}
        </v-alert>
        <div v-else-if="submitMessage" class="setup-success">
          {{ submitMessage }}
        </div>

        <v-btn
          color="primary"
          size="large"
          class="setup-submit"
          :loading="isConnecting"
          :disabled="!canSubmit"
          @click="submitConnection"
        >
          Verbinden
        </v-btn>
      </div>
    </article>
  </section>
</template>

<style scoped>
.setup-shell {
  display: grid;
  gap: 1rem;
  padding-block: 0.35rem 1.25rem;
}

.setup-hero {
  display: grid;
  gap: 1rem;
  padding: 1.4rem 1.2rem;
  border: 1px solid rgba(126, 180, 224, 0.18);
  background:
    radial-gradient(circle at top right, rgba(79, 209, 226, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(11, 19, 30, 0.96), rgba(8, 15, 25, 0.94));
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.34);
}

.setup-hero__brand {
  max-width: 11rem;
}

.setup-hero__eyebrow,
.setup-card__label {
  color: rgba(150, 218, 229, 0.82);
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.setup-hero__title,
.setup-card__title {
  margin: 0.55rem 0 0;
  color: rgba(247, 251, 255, 0.98);
  font-size: 1.65rem;
  line-height: 1.06;
}

.setup-hero__text,
.setup-status-grid__text,
.setup-status-grid__hint,
.setup-card__helper,
.setup-empty {
  margin: 0.85rem 0 0;
  color: rgba(209, 222, 234, 0.78);
  line-height: 1.5;
}

.setup-card {
  border: 1px solid rgba(120, 170, 220, 0.14);
  background: rgba(10, 18, 30, 0.92);
  padding: 1.1rem;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
}

.setup-card--status {
  background:
    linear-gradient(180deg, rgba(13, 22, 35, 0.94), rgba(8, 15, 25, 0.94));
}

.setup-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.setup-card__action,
.setup-submit {
  text-transform: none;
  font-weight: 700;
}

.setup-status-grid {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.setup-status-grid__title {
  color: rgba(246, 250, 255, 0.96);
  font-size: 1.05rem;
  font-weight: 700;
}

.setup-status-grid__portal {
  display: flex;
  align-items: flex-start;
}

.setup-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding: 0.2rem 0.72rem;
  border: 1px solid rgba(97, 204, 219, 0.28);
  background: rgba(79, 209, 226, 0.1);
  color: rgba(231, 249, 252, 0.92);
  font-size: 0.78rem;
  font-weight: 700;
}

.setup-badge--quiet {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.05);
}

.setup-badge--active {
  border-color: rgba(104, 216, 160, 0.28);
  background: rgba(104, 216, 160, 0.12);
  color: rgba(225, 247, 231, 0.94);
}

.wifi-network-list {
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;
}

.wifi-network-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.9rem 0.95rem;
  color: inherit;
  text-align: left;
}

.wifi-network-row--active {
  border-color: rgba(79, 209, 226, 0.34);
  background: rgba(79, 209, 226, 0.08);
}

.wifi-network-row__main {
  min-width: 0;
}

.wifi-network-row__ssid {
  color: rgba(246, 250, 255, 0.96);
  font-size: 1rem;
  font-weight: 700;
  word-break: break-word;
}

.wifi-network-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.42rem;
}

.wifi-network-row__signal {
  color: rgba(193, 210, 223, 0.76);
  font-family: monospace;
  font-size: 0.82rem;
}

.setup-card__form {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.setup-input :deep(.v-field) {
  border-radius: 0;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

.setup-input :deep(.v-field__input) {
  color: rgba(246, 250, 255, 0.96);
}

.setup-success {
  padding: 0.85rem 0.95rem;
  background: rgba(100, 216, 156, 0.12);
  border: 1px solid rgba(100, 216, 156, 0.22);
  color: rgba(227, 248, 233, 0.94);
  line-height: 1.45;
}

.setup-alert {
  margin-top: 0.2rem;
}

@media (min-width: 700px) {
  .setup-hero {
    grid-template-columns: 180px minmax(0, 1fr);
    align-items: center;
  }

  .setup-status-grid {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}
</style>
