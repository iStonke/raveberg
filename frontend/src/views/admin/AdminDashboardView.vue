<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type {
  AppMode,
  ColorScheme,
  ModerationMode,
  UploadItem,
  VisualizerPreset,
} from '../../services/api'
import {
  approveUpload,
  deleteUpload,
  fetchAdminUploads,
  rejectUpload,
} from '../../services/api'
import { useAppModeStore } from '../../stores/appMode'
import { useAuthStore } from '../../stores/auth'
import { useSelfieStore } from '../../stores/selfie'
import { useSystemStatusStore } from '../../stores/systemStatus'
import { useVisualizerStore } from '../../stores/visualizer'

const router = useRouter()
const authStore = useAuthStore()
const appModeStore = useAppModeStore()
const selfieStore = useSelfieStore()
const systemStatusStore = useSystemStatusStore()
const visualizerStore = useVisualizerStore()

const errorMessage = ref('')
const visualizerError = ref('')
const selfieError = ref('')
const uploadError = ref('')
const isBooting = ref(true)
const isSwitchingMode = ref(false)
const isSavingVisualizer = ref(false)
const isSavingSelfie = ref(false)
const liveConnectionActive = ref(false)
const uploads = ref<UploadItem[]>([])
const thumbnailUrls = ref<Record<number, string>>({})
const busyActions = ref<Record<string, boolean>>({})
const eventSource = ref<EventSource | null>(null)
const isHydratingVisualizerDraft = ref(true)
const isHydratingSelfieDraft = ref(true)

const visualizerDraft = reactive<{
  active_preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  color_scheme: ColorScheme
}>({
  active_preset: 'tunnel',
  intensity: 65,
  speed: 55,
  brightness: 70,
  color_scheme: 'acid',
})

const selfieDraft = reactive<{
  slideshow_enabled: boolean
  slideshow_interval_seconds: number
  slideshow_shuffle: boolean
  moderation_mode: ModerationMode
}>({
  slideshow_enabled: true,
  slideshow_interval_seconds: 6,
  slideshow_shuffle: true,
  moderation_mode: 'auto_approve',
})

const moderationItems = [
  { title: 'Automatische Freigabe', value: 'auto_approve' },
  { title: 'Manuelle Freigabe', value: 'manual_approve' },
] as const

let visualizerPersistTimer: number | undefined
let selfiePersistTimer: number | undefined

onMounted(async () => {
  if (!authStore.token) {
    isBooting.value = false
    return
  }

  try {
    const adminToken = authStore.token
    const [latestUploads] = await Promise.all([
      fetchAdminUploads(adminToken, 50),
      appModeStore.refresh(),
      selfieStore.refresh(),
      systemStatusStore.refresh(adminToken),
      visualizerStore.refresh(),
      visualizerStore.refreshOptions(),
    ])

    uploads.value = latestUploads
    await Promise.all([syncVisualizerDraftFromStore(), syncSelfieDraftFromStore()])
    await loadAdminThumbnails(latestUploads)
    connectLiveEvents()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Dashboard konnte nicht geladen werden'
  } finally {
    isBooting.value = false
  }
})

onBeforeUnmount(() => {
  if (visualizerPersistTimer) {
    window.clearTimeout(visualizerPersistTimer)
  }
  if (selfiePersistTimer) {
    window.clearTimeout(selfiePersistTimer)
  }
  eventSource.value?.close()
  revokeAllThumbnails()
})

watch(
  () => [
    visualizerDraft.active_preset,
    visualizerDraft.intensity,
    visualizerDraft.speed,
    visualizerDraft.brightness,
    visualizerDraft.color_scheme,
  ],
  () => {
    if (!isHydratingVisualizerDraft.value) {
      scheduleVisualizerPersist()
    }
  },
)

watch(
  () => [
    selfieDraft.slideshow_enabled,
    selfieDraft.slideshow_interval_seconds,
    selfieDraft.slideshow_shuffle,
    selfieDraft.moderation_mode,
  ],
  () => {
    if (!isHydratingSelfieDraft.value) {
      scheduleSelfiePersist()
    }
  },
)

async function switchMode(mode: 'visualizer' | 'selfie') {
  errorMessage.value = ''
  isSwitchingMode.value = true
  try {
    await appModeStore.setMode(mode)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Moduswechsel fehlgeschlagen'
  } finally {
    isSwitchingMode.value = false
  }
}

function handleModeSelection(nextMode: AppMode | null) {
  if (nextMode !== 'visualizer' && nextMode !== 'selfie') {
    return
  }

  void switchMode(nextMode)
}

async function logout() {
  await authStore.logout()
  await router.push('/admin/login')
}

async function syncVisualizerDraftFromStore() {
  isHydratingVisualizerDraft.value = true
  visualizerDraft.active_preset = visualizerStore.activePreset
  visualizerDraft.intensity = visualizerStore.intensity
  visualizerDraft.speed = visualizerStore.speed
  visualizerDraft.brightness = visualizerStore.brightness
  visualizerDraft.color_scheme = visualizerStore.colorScheme
  await nextTick()
  isHydratingVisualizerDraft.value = false
}

async function syncSelfieDraftFromStore() {
  isHydratingSelfieDraft.value = true
  selfieDraft.slideshow_enabled = selfieStore.slideshowEnabled
  selfieDraft.slideshow_interval_seconds = selfieStore.slideshowIntervalSeconds
  selfieDraft.slideshow_shuffle = selfieStore.slideshowShuffle
  selfieDraft.moderation_mode = selfieStore.moderationMode
  await nextTick()
  isHydratingSelfieDraft.value = false
}

function scheduleVisualizerPersist() {
  if (visualizerPersistTimer) {
    window.clearTimeout(visualizerPersistTimer)
  }

  visualizerPersistTimer = window.setTimeout(async () => {
    visualizerError.value = ''
    isSavingVisualizer.value = true
    try {
      await visualizerStore.save({
        active_preset: visualizerDraft.active_preset,
        intensity: visualizerDraft.intensity,
        speed: visualizerDraft.speed,
        brightness: visualizerDraft.brightness,
        color_scheme: visualizerDraft.color_scheme,
      })
    } catch (error) {
      visualizerError.value =
        error instanceof Error ? error.message : 'Visualizer-Update fehlgeschlagen'
    } finally {
      isSavingVisualizer.value = false
    }
  }, 140)
}

function scheduleSelfiePersist() {
  if (selfiePersistTimer) {
    window.clearTimeout(selfiePersistTimer)
  }

  selfiePersistTimer = window.setTimeout(async () => {
    selfieError.value = ''
    isSavingSelfie.value = true
    try {
      await selfieStore.save({
        slideshow_enabled: selfieDraft.slideshow_enabled,
        slideshow_interval_seconds: selfieDraft.slideshow_interval_seconds,
        slideshow_shuffle: selfieDraft.slideshow_shuffle,
        moderation_mode: selfieDraft.moderation_mode,
      })
    } catch (error) {
      selfieError.value = error instanceof Error ? error.message : 'Selfie-Settings konnten nicht gespeichert werden'
    } finally {
      isSavingSelfie.value = false
    }
  }, 180)
}

async function refreshUploads() {
  if (!authStore.token) {
    return
  }
  uploads.value = await fetchAdminUploads(authStore.token, 50)
  await loadAdminThumbnails(uploads.value)
}

async function refreshOperationalState() {
  if (!authStore.token) {
    return
  }
  await Promise.all([refreshUploads(), systemStatusStore.refresh(authStore.token)])
}

async function runUploadAction(upload: UploadItem, action: 'approve' | 'reject' | 'delete') {
  if (!authStore.token) {
    return
  }

  const key = `${action}:${upload.id}`
  setBusy(key, true)
  uploadError.value = ''

  try {
    if (action === 'approve') {
      await approveUpload(upload.id, authStore.token)
    } else if (action === 'reject') {
      await rejectUpload(upload.id, authStore.token)
    } else {
      await deleteUpload(upload.id, authStore.token)
    }

    await refreshOperationalState()
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload-Aktion fehlgeschlagen'
  } finally {
    setBusy(key, false)
  }
}

function connectLiveEvents() {
  const source = new EventSource('/api/events/stream')
  eventSource.value = source

  source.onopen = () => {
    liveConnectionActive.value = true
  }

  source.onerror = () => {
    liveConnectionActive.value = false
  }

  source.addEventListener('mode_snapshot', (event) => {
    liveConnectionActive.value = true
    appModeStore.applyMode(JSON.parse((event as MessageEvent).data))
  })

  source.addEventListener('mode_changed', (event) => {
    appModeStore.applyMode(JSON.parse((event as MessageEvent).data))
  })

  source.addEventListener('selfie_snapshot', async (event) => {
    liveConnectionActive.value = true
    selfieStore.applyState(JSON.parse((event as MessageEvent).data))
    await syncSelfieDraftFromStore()
  })

  source.addEventListener('selfie_settings_updated', async (event) => {
    selfieStore.applyState(JSON.parse((event as MessageEvent).data))
    await syncSelfieDraftFromStore()
  })

  source.addEventListener('visualizer_snapshot', async (event) => {
    liveConnectionActive.value = true
    visualizerStore.applyState(JSON.parse((event as MessageEvent).data))
    await syncVisualizerDraftFromStore()
  })

  source.addEventListener('visualizer_updated', async (event) => {
    visualizerStore.applyState(JSON.parse((event as MessageEvent).data))
    await syncVisualizerDraftFromStore()
  })

  source.addEventListener('visualizer_preset_changed', async (event) => {
    visualizerStore.applyState(JSON.parse((event as MessageEvent).data))
    await syncVisualizerDraftFromStore()
  })

  for (const eventName of ['upload_created', 'upload_approved', 'upload_rejected', 'upload_deleted']) {
    source.addEventListener(eventName, async () => {
      await refreshOperationalState()
    })
  }
}

async function loadAdminThumbnails(items: UploadItem[]) {
  const activeIds = new Set(items.map((upload) => upload.id))
  for (const [id, url] of Object.entries(thumbnailUrls.value)) {
    if (!activeIds.has(Number(id))) {
      URL.revokeObjectURL(url)
      delete thumbnailUrls.value[Number(id)]
    }
  }

  await Promise.all(
    items.map(async (upload) => {
      if (!authStore.token || !upload.admin_display_url || upload.status !== 'processed') {
        return
      }
      if (thumbnailUrls.value[upload.id]) {
        return
      }

      const response = await fetch(upload.admin_display_url, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      })
      if (!response.ok) {
        return
      }

      const blob = await response.blob()
      thumbnailUrls.value[upload.id] = URL.createObjectURL(blob)
    }),
  )
}

function revokeAllThumbnails() {
  for (const url of Object.values(thumbnailUrls.value)) {
    URL.revokeObjectURL(url)
  }
  thumbnailUrls.value = {}
}

function setBusy(key: string, next: boolean) {
  if (next) {
    busyActions.value = { ...busyActions.value, [key]: true }
    return
  }

  const updated = { ...busyActions.value }
  delete updated[key]
  busyActions.value = updated
}

function isBusy(key: string) {
  return Boolean(busyActions.value[key])
}

function formatDate(value: string | null) {
  if (!value) {
    return 'noch kein Update'
  }
  return new Date(value).toLocaleString('de-DE')
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function moderationLabel(mode: ModerationMode) {
  return mode === 'auto_approve' ? 'Neue Uploads werden sofort sichtbar.' : 'Neue Uploads warten auf Freigabe.'
}

function formatOptionalBytes(value: number | null) {
  if (value == null) {
    return 'unbekannt'
  }
  return formatBytes(value)
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-6">
        {{ errorMessage }}
      </v-alert>
    </v-col>

    <v-col cols="12" lg="4">
      <v-card class="pa-6 mb-6">
        <div class="text-overline mb-2">Systemstatus</div>
        <div class="text-body-1 mb-2">Event: {{ systemStatusStore.appliance.event_name || 'RAVEBERG' }}</div>
        <div class="text-body-1 mb-2">Health: {{ systemStatusStore.health }}</div>
        <div class="text-body-1 mb-2">
          Backend erreichbar: {{ systemStatusStore.backendReachable ? 'ja' : 'nein' }}
        </div>
        <div class="text-body-1 mb-2">DB erreichbar: {{ systemStatusStore.dbReachable ? 'ja' : 'nein' }}</div>
        <div class="text-body-1 mb-2">Uploads gesamt: {{ systemStatusStore.uploadCount }}</div>
        <div class="text-body-1 mb-2">Basis-URL: {{ systemStatusStore.appliance.urls.base_url || 'nicht gesetzt' }}</div>
        <div class="text-body-1 mb-2">
          Upload-URL: {{ systemStatusStore.appliance.urls.guest_upload_url || 'nicht gesetzt' }}
        </div>
        <div class="text-body-1 mb-2">
          Admin-URL: {{ systemStatusStore.appliance.urls.admin_url || 'nicht gesetzt' }}
        </div>
        <div class="text-body-1 mb-2">
          Display-URL: {{ systemStatusStore.appliance.urls.display_url || 'nicht gesetzt' }}
        </div>
        <div class="text-body-1 mb-2">Aktueller Mode: {{ systemStatusStore.currentMode }}</div>
        <div class="text-body-1 mb-2">Moderationsmodus: {{ systemStatusStore.moderationMode }}</div>
        <div class="text-body-1 mb-2">Display aktiv: {{ systemStatusStore.displayTarget }}</div>
        <div class="text-body-1 mb-2">Aktives Preset: {{ visualizerStore.activePreset }}</div>
        <div class="text-body-1 mb-2">
          Visualizer-Update: {{ formatDate(visualizerStore.updatedAt) }}
        </div>
        <div class="text-body-1 mb-2">
          Selfie-Settings: {{ formatDate(selfieStore.slideshowUpdatedAt) }}
        </div>
        <div class="text-body-1 mb-2">
          Access Point: {{ systemStatusStore.appliance.network.ap_enabled ? `${systemStatusStore.appliance.network.ap_ssid} (${systemStatusStore.appliance.network.ap_address})` : 'deaktiviert' }}
        </div>
        <div class="text-body-1 mb-2">
          Hostname: {{ systemStatusStore.appliance.network.local_hostname || 'nicht gesetzt' }}
        </div>
        <div class="text-body-1 mb-2">
          Freier Speicher: {{ formatOptionalBytes(systemStatusStore.appliance.storage.free_bytes) }}
        </div>
        <div class="text-body-2">
          Live-Verbindung: {{ liveConnectionActive ? 'aktiv' : 'inaktiv' }}
        </div>
      </v-card>

      <v-card class="pa-6">
        <div class="text-overline mb-2">Admin Session</div>
        <div class="text-body-1 mb-4">
          Eingeloggt als {{ authStore.username }} ({{ authStore.role }})
        </div>
        <v-btn variant="outlined" @click="logout()">Logout</v-btn>
      </v-card>
    </v-col>

    <v-col cols="12" lg="8">
      <v-card class="pa-6 mb-6">
        <div class="text-overline mb-2">Globaler Modus</div>
        <h1 class="text-h4 mb-4">Modussteuerung</h1>
        <v-btn-toggle
          :model-value="appModeStore.mode"
          color="primary"
          mandatory
          class="mb-4"
          :disabled="isSwitchingMode || isBooting"
          @update:model-value="handleModeSelection"
        >
          <v-btn value="visualizer">Visualizer Mode</v-btn>
          <v-btn value="selfie">Selfie Mode</v-btn>
        </v-btn-toggle>
        <v-alert type="success" variant="tonal">
          Aktueller Modus: <strong>{{ appModeStore.mode }}</strong>
        </v-alert>
      </v-card>

      <v-card class="pa-6 mb-6">
        <div class="text-overline mb-2">Visualizer-Steuerung</div>
        <v-select
          v-model="visualizerDraft.active_preset"
          label="Aktives Preset"
          :items="visualizerStore.presets"
          class="mb-4"
          :disabled="isBooting"
        />
        <v-select
          v-model="visualizerDraft.color_scheme"
          label="Farbwelt"
          :items="visualizerStore.colorSchemes"
          class="mb-4"
          :disabled="isBooting"
        />
        <v-slider v-model="visualizerDraft.speed" label="Speed" min="0" max="100" step="1" thumb-label class="mb-3" />
        <v-slider v-model="visualizerDraft.intensity" label="Intensity" min="0" max="100" step="1" thumb-label class="mb-3" />
        <v-slider v-model="visualizerDraft.brightness" label="Brightness" min="0" max="100" step="1" thumb-label />
        <v-alert type="info" variant="tonal" class="mt-4">
          {{ isSavingVisualizer ? 'Visualizer wird gespeichert.' : 'Visualizer-Aenderungen wirken live auf dem Display.' }}
        </v-alert>
        <v-alert v-if="visualizerError" type="error" variant="tonal" class="mt-4">
          {{ visualizerError }}
        </v-alert>
      </v-card>

      <v-card class="pa-6">
        <div class="text-overline mb-2">Selfie- und Slideshow-Steuerung</div>
        <v-select
          v-model="selfieDraft.moderation_mode"
          label="Moderationsmodus"
          :items="moderationItems"
          item-title="title"
          item-value="value"
          class="mb-4"
          :disabled="isBooting"
        />
        <v-alert type="info" variant="tonal" class="mb-4">
          {{ moderationLabel(selfieDraft.moderation_mode) }} Ein Wechsel wirkt in AP4 nur auf neue Uploads.
        </v-alert>
        <v-switch
          v-model="selfieDraft.slideshow_enabled"
          color="primary"
          inset
          label="Slideshow aktiviert"
          class="mb-3"
        />
        <v-switch
          v-model="selfieDraft.slideshow_shuffle"
          color="primary"
          inset
          label="Shuffle aktiv"
          class="mb-3"
        />
        <v-slider
          v-model="selfieDraft.slideshow_interval_seconds"
          label="Slideshow-Intervall"
          min="3"
          max="30"
          step="1"
          thumb-label
        />
        <v-alert type="info" variant="tonal" class="mt-4">
          {{ isSavingSelfie ? 'Selfie-Settings werden gespeichert.' : 'Slideshow-Einstellungen werden live an das Display uebertragen.' }}
        </v-alert>
        <v-alert v-if="selfieError" type="error" variant="tonal" class="mt-4">
          {{ selfieError }}
        </v-alert>
      </v-card>
    </v-col>

    <v-col cols="12">
      <v-card class="pa-6">
        <div class="text-overline mb-2">Upload-Moderation</div>
        <h2 class="text-h5 mb-2">Uploads</h2>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Oeffentliche Listen und die Slideshow sehen nur freigegebene Bilder. Pending und Rejected
          bleiben ausschliesslich im Admin-Bereich sichtbar.
        </p>

        <v-alert v-if="uploadError" type="error" variant="tonal" class="mb-4">
          {{ uploadError }}
        </v-alert>

        <v-row v-if="uploads.length">
          <v-col v-for="upload in uploads" :key="upload.id" cols="12" sm="6" md="4" lg="3">
            <v-card class="upload-card" variant="outlined">
              <v-img
                v-if="thumbnailUrls[upload.id]"
                :src="thumbnailUrls[upload.id]"
                height="180"
                cover
              />
              <v-sheet
                v-else
                height="180"
                class="d-flex align-center justify-center text-medium-emphasis"
              >
                {{ upload.status === 'processed' ? 'Preview wird geladen' : 'Kein Preview' }}
              </v-sheet>
              <div class="pa-4">
                <div class="text-body-2 mb-2">{{ formatDate(upload.created_at) }}</div>
                <div class="d-flex flex-wrap ga-2 mb-3">
                  <v-chip size="small" variant="tonal">{{ upload.status }}</v-chip>
                  <v-chip
                    size="small"
                    :color="upload.moderation_status === 'approved' ? 'success' : upload.moderation_status === 'pending' ? 'warning' : 'error'"
                    variant="tonal"
                  >
                    {{ upload.moderation_status }}
                  </v-chip>
                </div>
                <div class="text-caption text-medium-emphasis mb-1">
                  {{ formatBytes(upload.size) }} · {{ upload.mime_type }}
                </div>
                <div class="text-caption text-medium-emphasis mb-4 filename-line">
                  {{ upload.filename_original }}
                </div>
                <div class="upload-actions">
                  <v-btn
                    size="small"
                    color="success"
                    variant="tonal"
                    :loading="isBusy(`approve:${upload.id}`)"
                    :disabled="upload.status !== 'processed' || upload.moderation_status === 'approved' || isBusy(`reject:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                    @click="runUploadAction(upload, 'approve')"
                  >
                    Freigeben
                  </v-btn>
                  <v-btn
                    size="small"
                    color="warning"
                    variant="tonal"
                    :loading="isBusy(`reject:${upload.id}`)"
                    :disabled="upload.moderation_status === 'rejected' || isBusy(`approve:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                    @click="runUploadAction(upload, 'reject')"
                  >
                    Ablehnen
                  </v-btn>
                  <v-btn
                    size="small"
                    color="error"
                    variant="text"
                    :loading="isBusy(`delete:${upload.id}`)"
                    :disabled="isBusy(`approve:${upload.id}`) || isBusy(`reject:${upload.id}`)"
                    @click="runUploadAction(upload, 'delete')"
                  >
                    Loeschen
                  </v-btn>
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <v-alert v-else type="info" variant="tonal">
          Noch keine Uploads vorhanden.
        </v-alert>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.upload-card {
  overflow: hidden;
}

.upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filename-line {
  word-break: break-word;
}
</style>
