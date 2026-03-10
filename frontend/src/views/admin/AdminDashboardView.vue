<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type {
  AppMode,
  ColorScheme,
  ModerationMode,
  UploadItem,
  VideoAsset,
  VideoObjectFit,
  VideoPlaybackOrder,
  VideoTransition,
  VisualizerPreset,
} from '../../services/api'
import {
  approveUpload,
  deleteVideoAsset,
  deleteUpload,
  downloadAdminUploadArchive,
  fetchAdminUploads,
  rejectUpload,
  reorderVideoAssets,
  triggerSystemShutdown,
  triggerSelfieNext,
  triggerSelfieReload,
  uploadAdminVideo,
} from '../../services/api'
import AdminShowControlHeader from '../../components/admin/AdminShowControlHeader.vue'
import { useAppModeStore } from '../../stores/appMode'
import { useAuthStore } from '../../stores/auth'
import { useSelfieStore } from '../../stores/selfie'
import { useSystemStatusStore } from '../../stores/systemStatus'
import { useVideoStore } from '../../stores/video'
import { useVisualizerStore } from '../../stores/visualizer'

const route = useRoute()
const authStore = useAuthStore()
const appModeStore = useAppModeStore()
const selfieStore = useSelfieStore()
const systemStatusStore = useSystemStatusStore()
const videoStore = useVideoStore()
const visualizerStore = useVisualizerStore()

type AdminWorkspaceSection = 'modus' | 'status' | 'uploads'
type UploadGalleryFilter = 'all' | 'pending' | 'rejected' | 'latest'
type RecentEventEntry = {
  name: string
  at: string
}

const errorMessage = ref('')
const visualizerError = ref('')
const selfieError = ref('')
const videoError = ref('')
const uploadError = ref('')
const systemActionError = ref('')
const systemActionMessage = ref('')
const isBooting = ref(true)
const isSwitchingMode = ref(false)
const isSavingVisualizer = ref(false)
const isSavingSelfie = ref(false)
const isSavingVideo = ref(false)
const isUploadingVideos = ref(false)
const isShuttingDown = ref(false)
const isDownloadingUploadArchive = ref(false)
const dashboardLiveActive = ref(false)
const uploads = ref<UploadItem[]>([])
const thumbnailUrls = ref<Record<number, string>>({})
const busyActions = ref<Record<string, boolean>>({})
const eventSource = ref<EventSource | null>(null)
const reconnectTimer = ref<number>()
const reconnectAttempt = ref(0)
const isHydratingVisualizerDraft = ref(true)
const isHydratingSelfieDraft = ref(true)
const isHydratingVideoDraft = ref(true)
const isRefreshingOperationalState = ref(false)
const pendingOperationalRefresh = ref(false)
const recentEvents = ref<RecentEventEntry[]>([])
const videoFileInput = ref<HTMLInputElement | null>(null)
const videoDurations = ref<Record<number, string>>({})
const videoMetadataLoading = ref<Record<number, boolean>>({})
const videoUploadLabel = ref('')
const uploadGalleryFilter = ref<UploadGalleryFilter>('all')

const visualizerDraft = reactive<{
  active_preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  color_scheme: ColorScheme
  logo_overlay_enabled: boolean
  auto_cycle_enabled: boolean
  auto_cycle_interval_seconds: number
}>({
  active_preset: 'tunnel',
  intensity: 65,
  speed: 55,
  brightness: 70,
  color_scheme: 'acid',
  logo_overlay_enabled: true,
  auto_cycle_enabled: false,
  auto_cycle_interval_seconds: 45,
})

const selfieDraft = reactive<{
  slideshow_enabled: boolean
  slideshow_interval_seconds: number
  slideshow_max_visible_photos: number
  slideshow_shuffle: boolean
  vintage_look_enabled: boolean
  moderation_mode: ModerationMode
}>({
  slideshow_enabled: true,
  slideshow_interval_seconds: 6,
  slideshow_max_visible_photos: 4,
  slideshow_shuffle: true,
  vintage_look_enabled: false,
  moderation_mode: 'auto_approve',
})

const videoDraft = reactive<{
  playlist_enabled: boolean
  loop_enabled: boolean
  playback_order: VideoPlaybackOrder
  vintage_filter_enabled: boolean
  object_fit: VideoObjectFit
  transition: VideoTransition
  active_video_id: number | null
}>({
  playlist_enabled: true,
  loop_enabled: true,
  playback_order: 'upload_order',
  vintage_filter_enabled: false,
  object_fit: 'contain',
  transition: 'none',
  active_video_id: null,
})

const modeButtons: Array<{ label: string; value: AppMode }> = [
  { label: 'Visualizer', value: 'visualizer' },
  { label: 'Slideshow', value: 'selfie' },
  { label: 'Video', value: 'video' },
  { label: 'Standby', value: 'idle' },
  { label: 'Blackout', value: 'blackout' },
]

const moderationItems = [
  { title: 'Automatische Freigabe', value: 'auto_approve' },
  { title: 'Manuelle Freigabe', value: 'manual_approve' },
] as const

const videoOrderItems = [
  { title: 'Hochladereihenfolge', value: 'upload_order' },
  { title: 'Zufällig', value: 'random' },
] as const

const videoFitItems = [
  { title: 'Einpassen', value: 'contain' },
  { title: 'Zuschneiden', value: 'cover' },
] as const

const videoTransitionItems = [
  { title: 'Kein Übergang', value: 'none' },
  { title: 'Überblendung', value: 'fade' },
] as const

let visualizerPersistTimer: number | undefined
let selfiePersistTimer: number | undefined
let videoPersistTimer: number | undefined

const slideshowRunningLabel = computed(() =>
  selfieStore.slideshowEnabled ? 'läuft' : 'pausiert',
)

const displayUploads = computed(() =>
  [...uploads.value].sort((left, right) => {
    const rank = (upload: UploadItem) => {
      if (upload.status !== 'processed') return 3
      if (upload.moderation_status === 'pending') return 0
      if (upload.moderation_status === 'rejected') return 1
      return 2
    }

    const rankDiff = rank(left) - rank(right)
    if (rankDiff !== 0) {
      return rankDiff
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  }),
)

const pendingCount = computed(
  () => uploads.value.filter((upload) => upload.moderation_status === 'pending').length,
)

const rejectedCount = computed(
  () => uploads.value.filter((upload) => upload.moderation_status === 'rejected').length,
)

const latestUpload = computed(() => {
  if (!uploads.value.length) {
    return null
  }

  return uploads.value.reduce((latest, current) =>
    new Date(current.created_at).getTime() > new Date(latest.created_at).getTime() ? current : latest,
  )
})

const filteredUploadGallery = computed(() => {
  if (uploadGalleryFilter.value === 'pending') {
    return displayUploads.value.filter((upload) => upload.moderation_status === 'pending')
  }
  if (uploadGalleryFilter.value === 'rejected') {
    return displayUploads.value.filter((upload) => upload.moderation_status === 'rejected')
  }
  if (uploadGalleryFilter.value === 'latest') {
    return latestUpload.value ? [latestUpload.value] : []
  }
  return displayUploads.value
})

const uploadGalleryTitle = computed(() => {
  if (uploadGalleryFilter.value === 'pending') {
    return 'Ausstehende Uploads'
  }
  if (uploadGalleryFilter.value === 'rejected') {
    return 'Abgelehnte Uploads'
  }
  if (uploadGalleryFilter.value === 'latest') {
    return 'Letzter Upload'
  }
  return 'Alle Uploads'
})

const canDownloadUploadArchive = computed(() =>
  filteredUploadGallery.value.length > 0 && Boolean(authStore.token),
)

const uploadEmptyState = computed(() => {
  if (uploadGalleryFilter.value === 'pending') {
    return {
      icon: 'mdi-timer-sand',
      title: 'Keine ausstehenden Uploads',
      description: 'Bilder, die noch auf Bearbeitung warten, werden hier angezeigt.',
    }
  }
  if (uploadGalleryFilter.value === 'rejected') {
    return {
      icon: 'mdi-image-off-outline',
      title: 'Keine abgelehnten Uploads',
      description: 'Bilder, die abgelehnt wurden, werden hier angezeigt.',
    }
  }
  if (uploadGalleryFilter.value === 'latest') {
    return {
      icon: 'mdi-image-clock-outline',
      title: 'Kein letzter Upload',
      description: 'Der zuletzt hochgeladene Inhalt erscheint hier, sobald Uploads vorhanden sind.',
    }
  }
  return {
    icon: 'mdi-image-outline',
    title: 'Keine Uploads vorhanden',
    description: 'Sobald Bilder im Admin-Bereich sichtbar sind, erscheinen sie hier.',
  }
})

const displayHealthLabel = computed(() => {
  if (systemStatusStore.displayLiveConnected) {
    return 'Display live'
  }
  if (systemStatusStore.displayStateStale) {
    return 'Display stale'
  }
  return 'Display offline'
})

const displayRuntimeStatus = computed(() => {
  if (systemStatusStore.displayLiveConnected) {
    return {
      label: 'LIVE',
      tone: 'success',
      detail: `Letzter Kontakt ${formatDate(systemStatusStore.lastDisplayHeartbeatAt)}`,
    }
  }
  if (systemStatusStore.displayStateStale) {
    return {
      label: 'STALE',
      tone: 'warning',
      detail: `Zuletzt aktiv ${formatDate(systemStatusStore.lastDisplayHeartbeatAt)}`,
    }
  }
  return {
    label: 'OFFLINE',
    tone: 'error',
    detail: 'Keine aktive Display-Verbindung',
  }
})

const criticalStatusCards = computed(() => [
  {
    title: 'Display',
    value: displayRuntimeStatus.value.label,
    detail: displayRuntimeStatus.value.detail,
    tone: displayRuntimeStatus.value.tone,
  },
  {
    title: 'Backend',
    value: systemStatusStore.backendReachable ? 'OK' : 'OFFLINE',
    detail: systemStatusStore.backendReachable ? `Health ${systemStatusStore.health}` : 'Backend aktuell nicht erreichbar',
    tone: systemStatusStore.backendReachable ? 'success' : 'error',
  },
  {
    title: 'Datenbank',
    value: systemStatusStore.dbReachable ? 'OK' : 'FEHLER',
    detail: systemStatusStore.dbReachable ? 'Datenbank antwortet' : 'Datenbank aktuell nicht erreichbar',
    tone: systemStatusStore.dbReachable ? 'success' : 'error',
  },
  {
    title: 'Renderer',
    value: systemStatusStore.displayTarget || 'Unbekannt',
    detail: `Modus ${formatModeLabel(appModeStore.mode)}`,
    tone: systemStatusStore.displayLiveConnected ? 'success' : systemStatusStore.displayStateStale ? 'warning' : 'error',
  },
])

const activeWorkspaceSection = computed<AdminWorkspaceSection>(() => {
  const hash = route.hash.replace('#', '')
  if (hash === 'status' || hash === 'uploads') {
    return hash
  }
  return 'modus'
})

const dashboardStatusChip = computed(() => {
  if (dashboardLiveActive.value) {
    return {
      label: 'Dashboard live',
      color: 'success' as const,
    }
  }
  if (reconnectAttempt.value > 0) {
    return {
      label: `Dashboard reconnect ${reconnectAttempt.value}`,
      color: 'warning' as const,
    }
  }
  return {
    label: 'Dashboard connecting',
    color: 'info' as const,
  }
})

const displayStatusChip = computed(() => {
  if (systemStatusStore.displayLiveConnected) {
    return {
      label: 'Display live',
      color: 'success' as const,
    }
  }
  if (systemStatusStore.displayStateStale) {
    return {
      label: 'Display stale',
      color: 'warning' as const,
    }
  }
  return {
    label: 'Display offline',
    color: 'error' as const,
  }
})

const contextActions = computed(() => {
  if (appModeStore.mode === 'selfie') {
    return [
      {
        id: 'selfie:toggle',
        label: selfieDraft.slideshow_enabled ? 'Slideshow pausieren' : 'Slideshow fortsetzen',
        color: 'primary' as const,
        loading: isBusy('selfie:toggle'),
        disabled: isBooting.value,
      },
      {
        id: 'selfie:next',
        label: 'Nächstes Bild',
        color: 'primary' as const,
        loading: isBusy('selfie:next'),
        disabled: isBooting.value,
      },
      {
        id: 'selfie:reload_pool',
        label: 'Pool neu laden',
        color: 'primary' as const,
        loading: isBusy('selfie:reload_pool'),
        disabled: isBooting.value,
      },
      {
        id: 'selfie:shuffle',
        label: selfieDraft.slideshow_shuffle ? 'Shuffle aus' : 'Shuffle an',
        color: 'primary' as const,
        loading: isBusy('selfie:shuffle'),
        disabled: isBooting.value,
      },
      {
        id: 'selfie:vintage',
        label: selfieDraft.vintage_look_enabled ? 'Vintage aus' : 'Vintage an',
        color: 'primary' as const,
        loading: isBusy('selfie:vintage'),
        disabled: isBooting.value,
      },
    ]
  }

  if (appModeStore.mode === 'visualizer') {
    return [
      {
        id: 'visualizer:next-preset',
        label: 'Preset weiter',
        color: 'secondary' as const,
        loading: isBusy('visualizer:next-preset'),
        disabled: isBooting.value,
      },
      {
        id: 'visualizer:auto-cycle',
        label: visualizerDraft.auto_cycle_enabled ? 'Automatikwechsel pausieren' : 'Automatikwechsel starten',
        color: 'secondary' as const,
        loading: isBusy('visualizer:auto-cycle'),
        disabled: isBooting.value,
      },
      {
        id: 'visualizer:logo-overlay',
        label: visualizerDraft.logo_overlay_enabled ? 'Logo-Overlay aus' : 'Logo-Overlay an',
        color: 'secondary' as const,
        loading: isBusy('visualizer:logo-overlay'),
        disabled: isBooting.value,
      },
    ]
  }

  if (appModeStore.mode === 'video') {
    return [
      {
        id: 'video:upload',
        label: 'Video hochladen',
        color: 'primary' as const,
        loading: isUploadingVideos.value || isSavingVideo.value,
        disabled: isBooting.value,
      },
    ]
  }

  return []
})

const moderationSummaryLabel = computed(() =>
  selfieStore.moderationMode === 'auto_approve' ? 'Auto' : 'Manuell',
)

const showUploadModerationActions = computed(() =>
  selfieStore.moderationMode !== 'auto_approve',
)

const visualizerAutoCycleSummaryLabel = computed(() =>
  visualizerStore.autoCycleEnabled ? 'Aktiv' : 'Pausiert',
)

const visualizerTelemetryLabel = computed(
  () =>
    `T ${visualizerStore.speed} / I ${visualizerStore.intensity} / H ${visualizerStore.brightness}`,
)

const isBlackoutMode = computed(() => appModeStore.mode === 'blackout')

const isStandbyMode = computed(() => appModeStore.mode === 'idle')

const isSlideshowMode = computed(() => appModeStore.mode === 'selfie')

const isVideoMode = computed(() => appModeStore.mode === 'video')

const isVisualizerMode = computed(() => appModeStore.mode === 'visualizer')

const orderedVideoAssets = computed(() =>
  [...videoStore.assets].sort((left, right) => left.position - right.position),
)

const videoSizeLimitLabel = computed(() =>
  formatBytes(systemStatusStore.videoUploadMaxBytes),
)

const latestUploadLabel = computed(() => {
  if (!latestUpload.value) {
    return 'noch keine Uploads'
  }
  return formatDate(latestUpload.value.created_at)
})

const cpuLoadLabel = computed(() => formatPercent(systemStatusStore.cpuLoadPercent))

const memoryUsageLabel = computed(() => {
  if (systemStatusStore.memoryUsedBytes == null || systemStatusStore.memoryTotalBytes == null) {
    return 'unbekannt'
  }
  return `${formatBytes(systemStatusStore.memoryUsedBytes)} / ${formatBytes(systemStatusStore.memoryTotalBytes)}`
})

const memoryPercentLabel = computed(() => formatPercent(systemStatusStore.memoryPercent))

const cpuTemperatureLabel = computed(() => {
  if (systemStatusStore.cpuTemperatureCelsius == null) {
    return 'Nicht verfügbar'
  }
  return `${systemStatusStore.cpuTemperatureCelsius.toFixed(1)} °C`
})

const cpuLoadBarValue = computed(() => Math.max(0, Math.min(systemStatusStore.cpuLoadPercent ?? 0, 100)))

const memoryBarValue = computed(() => Math.max(0, Math.min(systemStatusStore.memoryPercent ?? 0, 100)))

const temperatureHint = computed(() =>
  systemStatusStore.cpuTemperatureCelsius == null
    ? 'Kein Temperatursensor erkannt'
    : 'Temperaturdaten vom Gerät',
)

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
      videoStore.refreshState(),
      videoStore.refreshAdminLibrary(adminToken),
      systemStatusStore.refresh(adminToken),
      visualizerStore.refresh(),
      visualizerStore.refreshOptions(),
    ])

    uploads.value = latestUploads
    await Promise.all([
      syncVisualizerDraftFromStore(),
      syncSelfieDraftFromStore(),
      syncVideoDraftFromStore(),
    ])
    await loadAdminThumbnails(latestUploads)
    await loadVideoMetadata(videoStore.assets)
    connectLiveEvents()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Dashboard konnte nicht geladen werden'
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
  if (videoPersistTimer) {
    window.clearTimeout(videoPersistTimer)
  }
  if (reconnectTimer.value) {
    window.clearTimeout(reconnectTimer.value)
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
    visualizerDraft.logo_overlay_enabled,
    visualizerDraft.auto_cycle_enabled,
    visualizerDraft.auto_cycle_interval_seconds,
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
    selfieDraft.slideshow_max_visible_photos,
    selfieDraft.slideshow_shuffle,
    selfieDraft.vintage_look_enabled,
    selfieDraft.moderation_mode,
  ],
  () => {
    if (!isHydratingSelfieDraft.value) {
      scheduleSelfiePersist()
    }
  },
)

watch(
  () => [
    videoDraft.playlist_enabled,
    videoDraft.loop_enabled,
    videoDraft.playback_order,
    videoDraft.vintage_filter_enabled,
    videoDraft.object_fit,
    videoDraft.transition,
    videoDraft.active_video_id,
  ],
  () => {
    if (!isHydratingVideoDraft.value) {
      scheduleVideoPersist()
    }
  },
)

async function switchMode(mode: AppMode) {
  errorMessage.value = ''
  isSwitchingMode.value = true
  try {
    await appModeStore.setMode(mode)
    await refreshSystemOnly()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Moduswechsel fehlgeschlagen'
  } finally {
    isSwitchingMode.value = false
  }
}

async function syncVisualizerDraftFromStore() {
  isHydratingVisualizerDraft.value = true
  visualizerDraft.active_preset = visualizerStore.activePreset
  visualizerDraft.intensity = visualizerStore.intensity
  visualizerDraft.speed = visualizerStore.speed
  visualizerDraft.brightness = visualizerStore.brightness
  visualizerDraft.color_scheme = visualizerStore.colorScheme
  visualizerDraft.logo_overlay_enabled = visualizerStore.logoOverlayEnabled
  visualizerDraft.auto_cycle_enabled = visualizerStore.autoCycleEnabled
  visualizerDraft.auto_cycle_interval_seconds = visualizerStore.autoCycleIntervalSeconds
  await nextTick()
  isHydratingVisualizerDraft.value = false
}

async function syncSelfieDraftFromStore() {
  isHydratingSelfieDraft.value = true
  selfieDraft.slideshow_enabled = selfieStore.slideshowEnabled
  selfieDraft.slideshow_interval_seconds = selfieStore.slideshowIntervalSeconds
  selfieDraft.slideshow_max_visible_photos = selfieStore.slideshowMaxVisiblePhotos
  selfieDraft.slideshow_shuffle = selfieStore.slideshowShuffle
  selfieDraft.vintage_look_enabled = selfieStore.vintageLookEnabled
  selfieDraft.moderation_mode = selfieStore.moderationMode
  await nextTick()
  isHydratingSelfieDraft.value = false
}

async function syncVideoDraftFromStore() {
  isHydratingVideoDraft.value = true
  videoDraft.playlist_enabled = videoStore.playlistEnabled
  videoDraft.loop_enabled = videoStore.loopEnabled
  videoDraft.playback_order = videoStore.playbackOrder
  videoDraft.vintage_filter_enabled = videoStore.vintageFilterEnabled
  videoDraft.object_fit = videoStore.objectFit
  videoDraft.transition = videoStore.transition
  videoDraft.active_video_id = videoStore.activeVideoId
  await nextTick()
  isHydratingVideoDraft.value = false
}

function scheduleVisualizerPersist() {
  if (visualizerPersistTimer) {
    window.clearTimeout(visualizerPersistTimer)
  }

  visualizerPersistTimer = window.setTimeout(() => {
    void saveVisualizerDraft()
  }, 140)
}

function scheduleSelfiePersist() {
  if (selfiePersistTimer) {
    window.clearTimeout(selfiePersistTimer)
  }

  selfiePersistTimer = window.setTimeout(() => {
    void saveSelfieDraft()
  }, 180)
}

function scheduleVideoPersist() {
  if (videoPersistTimer) {
    window.clearTimeout(videoPersistTimer)
  }

  videoPersistTimer = window.setTimeout(() => {
    void saveVideoDraft()
  }, 180)
}

async function saveVisualizerDraft() {
  visualizerError.value = ''
  isSavingVisualizer.value = true
  try {
    await visualizerStore.save({
      active_preset: visualizerDraft.active_preset,
      intensity: visualizerDraft.intensity,
      speed: visualizerDraft.speed,
      brightness: visualizerDraft.brightness,
      color_scheme: visualizerDraft.color_scheme,
      logo_overlay_enabled: visualizerDraft.logo_overlay_enabled,
      auto_cycle_enabled: visualizerDraft.auto_cycle_enabled,
      auto_cycle_interval_seconds: visualizerDraft.auto_cycle_interval_seconds,
    })
    await refreshSystemOnly()
  } catch (error) {
    visualizerError.value =
      error instanceof Error ? error.message : 'Visualizer-Update fehlgeschlagen'
  } finally {
    isSavingVisualizer.value = false
  }
}

async function saveSelfieDraft() {
  selfieError.value = ''
  isSavingSelfie.value = true
  try {
    await selfieStore.save({
      slideshow_enabled: selfieDraft.slideshow_enabled,
      slideshow_interval_seconds: selfieDraft.slideshow_interval_seconds,
      slideshow_max_visible_photos: selfieDraft.slideshow_max_visible_photos,
      slideshow_shuffle: selfieDraft.slideshow_shuffle,
      vintage_look_enabled: selfieDraft.vintage_look_enabled,
      moderation_mode: selfieDraft.moderation_mode,
    })
    await refreshSystemOnly()
  } catch (error) {
    selfieError.value =
      error instanceof Error ? error.message : 'Selfie-Settings konnten nicht gespeichert werden'
  } finally {
    isSavingSelfie.value = false
  }
}

async function saveVideoDraft() {
  videoError.value = ''
  isSavingVideo.value = true
  try {
    await videoStore.save({
      playlist_enabled: videoDraft.playlist_enabled,
      loop_enabled: videoDraft.loop_enabled,
      playback_order: videoDraft.playback_order,
      vintage_filter_enabled: videoDraft.vintage_filter_enabled,
      object_fit: videoDraft.object_fit,
      transition: videoDraft.transition,
      active_video_id: videoDraft.active_video_id,
    })
    await refreshSystemOnly()
  } catch (error) {
    videoError.value = error instanceof Error ? error.message : 'Video-Settings konnten nicht gespeichert werden'
  } finally {
    isSavingVideo.value = false
  }
}

async function refreshSystemOnly() {
  if (!authStore.token) {
    return
  }
  await systemStatusStore.refresh(authStore.token)
}

async function refreshUploads() {
  if (!authStore.token) {
    return
  }
  uploads.value = await fetchAdminUploads(authStore.token, 50)
  await loadAdminThumbnails(uploads.value)
}

async function refreshVideos() {
  if (!authStore.token) {
    return
  }
  await videoStore.refreshAdminLibrary(authStore.token)
  await loadVideoMetadata(videoStore.assets)
}

async function refreshOperationalState() {
  if (!authStore.token) {
    return
  }
  if (isRefreshingOperationalState.value) {
    pendingOperationalRefresh.value = true
    return
  }

  isRefreshingOperationalState.value = true
  try {
    await Promise.all([refreshUploads(), refreshVideos(), systemStatusStore.refresh(authStore.token)])
  } finally {
    isRefreshingOperationalState.value = false
    if (pendingOperationalRefresh.value) {
      pendingOperationalRefresh.value = false
      await refreshOperationalState()
    }
  }
}

async function shutdownSystem() {
  if (!authStore.token || isShuttingDown.value) {
    return
  }

  systemActionError.value = ''
  systemActionMessage.value = ''
  isShuttingDown.value = true

  try {
    const response = await triggerSystemShutdown(authStore.token)
    systemActionMessage.value = response.message
  } catch (error) {
    systemActionError.value =
      error instanceof Error ? error.message : 'Ausschalten konnte nicht ausgelöst werden'
  } finally {
    isShuttingDown.value = false
  }
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

async function downloadCurrentUploadArchive() {
  if (!authStore.token || !filteredUploadGallery.value.length || isDownloadingUploadArchive.value) {
    return
  }

  uploadError.value = ''
  isDownloadingUploadArchive.value = true

  try {
    const archive = await downloadAdminUploadArchive(
      filteredUploadGallery.value.map((upload) => upload.id),
      authStore.token,
    )
    triggerBlobDownload(archive, buildUploadArchiveFilename(uploadGalleryFilter.value))
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Download fehlgeschlagen'
  } finally {
    isDownloadingUploadArchive.value = false
  }
}

async function toggleSlideshowQuick() {
  const key = 'selfie:toggle'
  setBusy(key, true)
  try {
    if (selfiePersistTimer) {
      window.clearTimeout(selfiePersistTimer)
    }
    isHydratingSelfieDraft.value = true
    selfieDraft.slideshow_enabled = !selfieDraft.slideshow_enabled
    await nextTick()
    isHydratingSelfieDraft.value = false
    await saveSelfieDraft()
  } finally {
    setBusy(key, false)
  }
}

async function runSelfieQuickAction(action: 'next' | 'reload_pool') {
  if (!authStore.token) {
    return
  }

  const key = `selfie:${action}`
  setBusy(key, true)
  selfieError.value = ''

  try {
    if (action === 'next') {
      await triggerSelfieNext(authStore.token)
    } else {
      await triggerSelfieReload(authStore.token)
    }
  } catch (error) {
    selfieError.value = error instanceof Error ? error.message : 'Selfie-Aktion fehlgeschlagen'
  } finally {
    setBusy(key, false)
  }
}

async function toggleSelfieSettingQuick(setting: 'slideshow_shuffle' | 'vintage_look_enabled') {
  const key = setting === 'slideshow_shuffle' ? 'selfie:shuffle' : 'selfie:vintage'
  setBusy(key, true)
  try {
    if (selfiePersistTimer) {
      window.clearTimeout(selfiePersistTimer)
    }
    isHydratingSelfieDraft.value = true
    selfieDraft[setting] = !selfieDraft[setting]
    await nextTick()
    isHydratingSelfieDraft.value = false
    await saveSelfieDraft()
  } finally {
    setBusy(key, false)
  }
}

async function advancePresetQuick() {
  const key = 'visualizer:next-preset'
  setBusy(key, true)
  try {
    if (visualizerPersistTimer) {
      window.clearTimeout(visualizerPersistTimer)
    }
    isHydratingVisualizerDraft.value = true

    const presets: VisualizerPreset[] = visualizerStore.presets.length
      ? [...visualizerStore.presets]
      : ['tunnel', 'particles', 'waves', 'kaleidoscope', 'warehouse', 'swarm_collision']
    const currentIndex = presets.indexOf(visualizerDraft.active_preset)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % presets.length : 0
    visualizerDraft.active_preset = presets[nextIndex]
    await nextTick()
    isHydratingVisualizerDraft.value = false
    await saveVisualizerDraft()
  } finally {
    setBusy(key, false)
  }
}

async function toggleAutoCycleQuick() {
  const key = 'visualizer:auto-cycle'
  setBusy(key, true)
  try {
    if (visualizerPersistTimer) {
      window.clearTimeout(visualizerPersistTimer)
    }
    isHydratingVisualizerDraft.value = true
    visualizerDraft.auto_cycle_enabled = !visualizerDraft.auto_cycle_enabled
    await nextTick()
    isHydratingVisualizerDraft.value = false
    await saveVisualizerDraft()
  } finally {
    setBusy(key, false)
  }
}

async function toggleVisualizerLogoOverlayQuick() {
  const key = 'visualizer:logo-overlay'
  setBusy(key, true)
  try {
    if (visualizerPersistTimer) {
      window.clearTimeout(visualizerPersistTimer)
    }
    isHydratingVisualizerDraft.value = true
    visualizerDraft.logo_overlay_enabled = !visualizerDraft.logo_overlay_enabled
    await nextTick()
    isHydratingVisualizerDraft.value = false
    await saveVisualizerDraft()
  } finally {
    setBusy(key, false)
  }
}

async function runHeaderAction(actionId: string) {
  if (actionId === 'selfie:toggle') {
    await toggleSlideshowQuick()
    return
  }
  if (actionId === 'selfie:next') {
    await runSelfieQuickAction('next')
    return
  }
  if (actionId === 'selfie:reload_pool') {
    await runSelfieQuickAction('reload_pool')
    return
  }
  if (actionId === 'selfie:shuffle') {
    await toggleSelfieSettingQuick('slideshow_shuffle')
    return
  }
  if (actionId === 'selfie:vintage') {
    await toggleSelfieSettingQuick('vintage_look_enabled')
    return
  }
  if (actionId === 'visualizer:next-preset') {
    await advancePresetQuick()
    return
  }
  if (actionId === 'visualizer:auto-cycle') {
    await toggleAutoCycleQuick()
    return
  }
  if (actionId === 'visualizer:logo-overlay') {
    await toggleVisualizerLogoOverlayQuick()
    return
  }
  if (actionId === 'video:upload') {
    openVideoPicker()
  }
}

function openVideoPicker() {
  videoFileInput.value?.click()
}

async function handleVideoFileSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) {
    return
  }
  await uploadSelectedVideos(files)
}

async function uploadSelectedVideos(files: File[]) {
  if (!authStore.token) {
    return
  }

  isUploadingVideos.value = true
  videoUploadLabel.value = ''
  videoError.value = ''
  const errors: string[] = []

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const validationError = validateVideoFile(file)
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`)
        continue
      }

      videoUploadLabel.value = `${file.name} (${index + 1}/${files.length})`
      try {
        await uploadAdminVideo(file, authStore.token, (progress) => {
          videoUploadLabel.value = `${file.name} (${progress}%)`
        })
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload fehlgeschlagen'}`)
      }
    }

    await refreshVideos()
    await syncVideoDraftFromStore()
    await refreshSystemOnly()
  } finally {
    isUploadingVideos.value = false
    videoUploadLabel.value = ''
  }

  if (errors.length) {
    videoError.value = errors.join(' | ')
  }
}

function validateVideoFile(file: File) {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  if (!['.mp4', '.webm'].includes(extension)) {
    return 'nur MP4 oder WebM'
  }
  if (file.size > systemStatusStore.videoUploadMaxBytes) {
    return `zu gross, maximal ${videoSizeLimitLabel.value}`
  }
  return ''
}

async function moveVideo(asset: VideoAsset, direction: -1 | 1) {
  if (!authStore.token) {
    return
  }

  const assets = [...orderedVideoAssets.value]
  const currentIndex = assets.findIndex((entry) => entry.id === asset.id)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= assets.length) {
    return
  }

  const key = `video:move:${asset.id}`
  setBusy(key, true)
  videoError.value = ''

  try {
    const nextAssets = [...assets]
    ;[nextAssets[currentIndex], nextAssets[nextIndex]] = [nextAssets[nextIndex], nextAssets[currentIndex]]
    const response = await reorderVideoAssets(
      nextAssets.map((entry) => entry.id),
      authStore.token,
    )
    videoStore.applyLibrary(response)
    await loadVideoMetadata(videoStore.assets)
  } catch (error) {
    videoError.value = error instanceof Error ? error.message : 'Video-Reihenfolge konnte nicht gespeichert werden'
  } finally {
    setBusy(key, false)
  }
}

async function removeVideo(asset: VideoAsset) {
  if (!authStore.token) {
    return
  }

  const key = `video:delete:${asset.id}`
  setBusy(key, true)
  videoError.value = ''

  try {
    await deleteVideoAsset(asset.id, authStore.token)
    await refreshVideos()
    await syncVideoDraftFromStore()
    await refreshSystemOnly()
  } catch (error) {
    videoError.value = error instanceof Error ? error.message : 'Video konnte nicht gelöscht werden'
  } finally {
    setBusy(key, false)
  }
}

async function setActiveVideo(asset: VideoAsset) {
  if (videoPersistTimer) {
    window.clearTimeout(videoPersistTimer)
  }
  isHydratingVideoDraft.value = true
  videoDraft.active_video_id = asset.id
  await nextTick()
  isHydratingVideoDraft.value = false
  await saveVideoDraft()
}

function pushRecentEvent(name: string) {
  recentEvents.value = [
    {
      name,
      at: new Date().toISOString(),
    },
    ...recentEvents.value,
  ].slice(0, 12)
}

function connectLiveEvents() {
  closeEventSource()

  const source = new EventSource('/api/events/stream')
  eventSource.value = source

  source.onopen = () => {
    dashboardLiveActive.value = true
    reconnectAttempt.value = 0
    pushRecentEvent('stream_connected')
  }

  source.onerror = () => {
    dashboardLiveActive.value = false
    pushRecentEvent('stream_error')
    scheduleReconnect()
  }

  source.addEventListener('mode_snapshot', (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('mode_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    appModeStore.applyMode(payload)
    void refreshSystemOnly()
  })

  source.addEventListener('mode_changed', (event) => {
    pushRecentEvent('mode_changed')
    const payload = parseEventPayload(event)
    if (!payload) return
    appModeStore.applyMode(payload)
    void refreshSystemOnly()
  })

  source.addEventListener('blackout_activated', (event) => {
    pushRecentEvent('blackout_activated')
    const payload = parseEventPayload(event)
    if (!payload) return
    appModeStore.applyMode(payload)
    void refreshSystemOnly()
  })

  source.addEventListener('blackout_cleared', (event) => {
    pushRecentEvent('blackout_cleared')
    const payload = parseEventPayload(event)
    if (!payload) return
    appModeStore.applyMode(payload)
    void refreshSystemOnly()
  })

  source.addEventListener('selfie_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('selfie_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    selfieStore.applyState(payload)
    await syncSelfieDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('selfie_settings_updated', async (event) => {
    pushRecentEvent('selfie_settings_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    selfieStore.applyState(payload)
    await syncSelfieDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('selfie_playback_updated', () => {
    pushRecentEvent('selfie_playback_updated')
    void refreshSystemOnly()
  })

  source.addEventListener('video_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('video_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    videoStore.applyState(payload)
    await syncVideoDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('video_settings_updated', async (event) => {
    pushRecentEvent('video_settings_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    videoStore.applyState(payload)
    await syncVideoDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('video_library_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('video_library_snapshot')
    const payload = parseEventPayload(event)
    if (!payload || !Array.isArray(payload)) return
    videoStore.applyLibrary(payload)
    await loadVideoMetadata(videoStore.assets)
    await syncVideoDraftFromStore()
  })

  source.addEventListener('video_library_updated', async (event) => {
    pushRecentEvent('video_library_updated')
    const payload = parseEventPayload(event)
    if (!payload || !Array.isArray(payload)) return
    videoStore.applyLibrary(payload)
    await loadVideoMetadata(videoStore.assets)
    await syncVideoDraftFromStore()
  })

  source.addEventListener('visualizer_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('visualizer_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    await syncVisualizerDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('visualizer_updated', async (event) => {
    pushRecentEvent('visualizer_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    await syncVisualizerDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('visualizer_preset_changed', async (event) => {
    pushRecentEvent('visualizer_preset_changed')
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    await syncVisualizerDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('visualizer_auto_cycle_updated', async (event) => {
    pushRecentEvent('visualizer_auto_cycle_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    visualizerStore.applyState(payload)
    await syncVisualizerDraftFromStore()
    await refreshSystemOnly()
  })

  for (const eventName of [
    'upload_created',
    'upload_approved',
    'upload_rejected',
    'upload_deleted',
    'cleanup_completed',
    'rate_limit_triggered',
    'heartbeat_updated',
  ]) {
    source.addEventListener(eventName, () => {
      pushRecentEvent(eventName)
      void refreshOperationalState()
    })
  }
}

function scheduleReconnect() {
  closeEventSource()
  if (reconnectTimer.value) {
    return
  }

  reconnectAttempt.value += 1
  const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt.value - 1, 3), 8000)
  reconnectTimer.value = window.setTimeout(() => {
    reconnectTimer.value = undefined
    connectLiveEvents()
  }, delay)
}

function closeEventSource() {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
}

function parseEventPayload(event: Event) {
  try {
    return JSON.parse((event as MessageEvent).data)
  } catch {
    return null
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

async function loadVideoMetadata(items: VideoAsset[]) {
  const activeIds = new Set(items.map((asset) => asset.id))
  const nextDurations = { ...videoDurations.value }
  for (const key of Object.keys(nextDurations)) {
    if (!activeIds.has(Number(key))) {
      delete nextDurations[Number(key)]
    }
  }
  videoDurations.value = nextDurations

  await Promise.all(
    items.map(async (asset) => {
      if (videoDurations.value[asset.id] || videoMetadataLoading.value[asset.id]) {
        return
      }

      videoMetadataLoading.value = { ...videoMetadataLoading.value, [asset.id]: true }
      try {
        const duration = await readVideoDuration(asset.stream_url)
        videoDurations.value = {
          ...videoDurations.value,
          [asset.id]: formatDuration(duration),
        }
      } catch {
        videoDurations.value = {
          ...videoDurations.value,
          [asset.id]: 'Unbekannt',
        }
      } finally {
        const nextLoading = { ...videoMetadataLoading.value }
        delete nextLoading[asset.id]
        videoMetadataLoading.value = nextLoading
      }
    }),
  )
}

function readVideoDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const cleanup = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      cleanup()
      resolve(duration)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('metadata'))
    }
    video.src = url
  })
}

function revokeAllThumbnails() {
  for (const url of Object.values(thumbnailUrls.value)) {
    URL.revokeObjectURL(url)
  }
  thumbnailUrls.value = {}
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 'Unbekannt'
  }
  const totalSeconds = Math.round(value)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatVideoMimeLabel(value: string) {
  if (value === 'video/mp4') {
    return 'MP4'
  }
  if (value === 'video/webm') {
    return 'WebM'
  }
  const subtype = value.split('/')[1]
  return subtype ? subtype.toUpperCase() : value.toUpperCase()
}

function setUploadGalleryFilter(filter: UploadGalleryFilter) {
  uploadGalleryFilter.value = filter
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

function canApprove(upload: UploadItem) {
  return upload.status === 'processed' && upload.moderation_status !== 'approved'
}

function canReject(upload: UploadItem) {
  return upload.moderation_status !== 'rejected'
}

function approveLabel(upload: UploadItem) {
  return upload.moderation_status === 'approved' ? 'Freigegeben' : 'Freigeben'
}

function formatModerationStatusLabel(status: UploadItem['moderation_status']) {
  if (status === 'pending') return 'Ausstehend'
  if (status === 'approved') return 'Genehmigt'
  return 'Abgelehnt'
}

function uploadStatusTone(status: UploadItem) {
  if (status.status === 'error') return 'error'
  if (status.moderation_status === 'approved') return 'success'
  if (status.moderation_status === 'pending') return 'warning'
  return 'error'
}

function formatDate(value: string | null) {
  if (!value) {
    return 'noch kein Update'
  }
  return new Date(value).toLocaleString('de-DE')
}

function formatCompactDate(value: string) {
  const date = new Date(value)
  const datePart = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${datePart} · ${timePart} Uhr`
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatImageMimeLabel(value: string) {
  if (value === 'image/jpeg') return 'JPEG'
  if (value === 'image/png') return 'PNG'
  if (value === 'image/webp') return 'WEBP'
  const subtype = value.split('/')[1]
  return subtype ? subtype.toUpperCase() : value.toUpperCase()
}

function buildUploadArchiveFilename(filter: UploadGalleryFilter) {
  const baseName =
    filter === 'pending'
      ? 'uploads-ausstehend'
      : filter === 'rejected'
        ? 'uploads-abgelehnt'
        : filter === 'latest'
          ? 'uploads-letzter-upload'
          : 'uploads-alle'

  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const timePart = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('')

  return `${baseName}-${datePart}-${timePart}.zip`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

function moderationLabel(mode: ModerationMode) {
  return mode === 'auto_approve'
    ? 'Neue Uploads werden sofort sichtbar.'
    : 'Neue Uploads warten auf Freigabe.'
}

function formatOptionalBytes(value: number | null) {
  if (value == null) {
    return 'unbekannt'
  }
  return formatBytes(value)
}

function formatPercent(value: number | null) {
  if (value == null) {
    return 'unbekannt'
  }
  return `${value.toFixed(1)} %`
}

function formatModeLabel(mode: AppMode) {
  if (mode === 'blackout') return 'Blackout'
  if (mode === 'idle') return 'Standby'
  if (mode === 'selfie') return 'Slideshow'
  if (mode === 'video') return 'Video'
  return 'Visualizer'
}
</script>

<template>
  <section class="admin-workspace-shell">
    <div class="admin-workspace-scroll">
      <v-row class="admin-workspace">
        <v-col v-if="errorMessage" cols="12">
          <v-alert type="error" variant="tonal" class="mb-4">
            {{ errorMessage }}
          </v-alert>
        </v-col>

        <template v-if="activeWorkspaceSection === 'modus'">
      <v-col cols="12" class="admin-mode-sticky-col">
        <AdminShowControlHeader
          :current-mode="appModeStore.mode"
          :mode-options="modeButtons"
          :context-actions="contextActions"
          :is-booting="isBooting"
          :is-switching-mode="isSwitchingMode"
          @switch-mode="switchMode"
          @run-action="runHeaderAction"
        />
      </v-col>

      <v-col v-if="isBlackoutMode || isStandbyMode" cols="12">
        <section class="settings-section">
          <div class="settings-group">
            <div class="inline-note settings-copy">
              {{
                isBlackoutMode
                  ? 'Der Bildschirm ist derzeit komplett abgeschaltet. Einstellungen für Slideshow und Visualizer stehen wieder zur Verfügung, sobald du in einen dieser Modi wechselst.'
                  : 'Der Bildschirm ist im Standby und zeigt derzeit keinen aktiven Inhalt. Einstellungen für Slideshow oder Visualizer erscheinen wieder, sobald du in den jeweiligen Modus wechselst.'
              }}
            </div>
          </div>
        </section>
      </v-col>

      <v-col v-if="isVideoMode" cols="12">
        <section class="settings-section">
          <input
            ref="videoFileInput"
            type="file"
            class="sr-only"
            accept="video/mp4,video/webm,.mp4,.webm"
            multiple
            @change="handleVideoFileSelection"
          />

          <div class="settings-group">
            <div class="settings-group__label">Videos</div>
            <div v-if="isUploadingVideos" class="video-upload-status">
              <v-progress-linear indeterminate color="primary" rounded />
              <div class="inline-note">{{ videoUploadLabel || 'Videos werden hochgeladen …' }}</div>
            </div>

            <div v-if="orderedVideoAssets.length" class="video-library-list">
              <div
                v-for="(asset, index) in orderedVideoAssets"
                :key="asset.id"
                class="video-library-item"
                :class="{ 'video-library-item--active': videoDraft.active_video_id === asset.id }"
                @click="setActiveVideo(asset)"
              >
                <div class="video-library-item__thumb">
                  <div class="video-library-item__order">{{ index + 1 }}</div>
                  <div class="video-library-item__placeholder">
                    <v-icon icon="mdi-play-circle-outline" size="24" />
                  </div>
                </div>
                <div class="video-library-item__body">
                  <div class="video-library-item__content">
                    <div class="video-library-item__title-row">
                      <div class="video-library-item__title">{{ asset.filename_original }}</div>
                    </div>
                    <div class="video-library-item__meta">
                      <span>{{ videoDurations[asset.id] || (videoMetadataLoading[asset.id] ? 'Wird gelesen' : 'Unbekannt') }}</span>
                      <span aria-hidden="true">·</span>
                      <span>{{ formatBytes(asset.size) }}</span>
                      <span aria-hidden="true">·</span>
                      <span>{{ formatVideoMimeLabel(asset.mime_type) }}</span>
                    </div>
                  </div>
                  <div class="video-library-item__actions">
                    <v-btn
                      size="small"
                      variant="text"
                      class="video-library-action"
                      icon="mdi-arrow-up"
                      :disabled="index === 0"
                      :loading="isBusy(`video:move:${asset.id}`)"
                      @click.stop="moveVideo(asset, -1)"
                    />
                    <v-btn
                      size="small"
                      variant="text"
                      class="video-library-action"
                      icon="mdi-arrow-down"
                      :disabled="index === orderedVideoAssets.length - 1"
                      :loading="isBusy(`video:move:${asset.id}`)"
                      @click.stop="moveVideo(asset, 1)"
                    />
                    <v-btn
                      size="small"
                      color="error"
                      variant="text"
                      class="video-library-action video-library-action--danger"
                      icon="mdi-trash-can-outline"
                      :loading="isBusy(`video:delete:${asset.id}`)"
                      @click.stop="removeVideo(asset)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="inline-note">Noch keine Videos vorhanden.</div>
          </div>

          <div class="settings-divider" />

          <div class="settings-group">
            <div class="settings-group__label">Wiedergabe</div>
            <v-switch
              v-model="videoDraft.playlist_enabled"
              color="primary"
              inset
              label="Videos nacheinander abspielen"
              hide-details
            />
            <v-switch
              v-model="videoDraft.loop_enabled"
              color="primary"
              inset
              label="Endlosschleife"
              hide-details
            />
            <div class="settings-control">
              <div class="settings-control__label">Reihenfolge</div>
              <v-select
                v-model="videoDraft.playback_order"
                class="admin-select"
                :items="videoOrderItems"
                item-title="title"
                item-value="value"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
            <div v-if="!videoDraft.playlist_enabled" class="inline-note">
              Wenn die Playlist deaktiviert ist, wird das oben markierte Einzelvideo abgespielt.
            </div>
          </div>

          <div class="settings-divider" />

          <div class="settings-group">
            <div class="settings-group__label">Darstellung</div>
            <v-switch
              v-model="videoDraft.vintage_filter_enabled"
              color="primary"
              inset
              label="Vintage-Look"
              hide-details
            />
            <div class="settings-control">
              <div class="settings-control__label">Bildfüllung</div>
              <v-select
                v-model="videoDraft.object_fit"
                class="admin-select"
                :items="videoFitItems"
                item-title="title"
                item-value="value"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
            <div class="settings-control">
              <div class="settings-control__label">Übergang</div>
              <v-select
                v-model="videoDraft.transition"
                class="admin-select"
                :items="videoTransitionItems"
                item-title="title"
                item-value="value"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
          </div>

          <v-alert v-if="videoError" type="error" variant="tonal" class="mt-4">
            {{ videoError }}
          </v-alert>
        </section>
      </v-col>

      <v-col v-if="isSlideshowMode" cols="12">
        <section class="settings-section">
          <div class="settings-section__header">
            <div class="settings-section__label">Slideshow</div>
          </div>
          <div class="settings-group">
            <div class="settings-control">
              <div class="settings-control__label">Moderationsmodus</div>
              <v-select
                v-model="selfieDraft.moderation_mode"
                class="admin-select"
                :items="moderationItems"
                item-title="title"
                item-value="value"
                :disabled="isBooting"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
          </div>

          <div class="settings-divider" />

          <div class="settings-group">
            <div class="settings-group__label">Animation</div>
            <div class="settings-slider-row">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Einblend-Intervall</div>
                <div class="settings-slider-row__value">{{ selfieDraft.slideshow_interval_seconds }}s</div>
              </div>
              <v-slider
                v-model="selfieDraft.slideshow_interval_seconds"
                min="2"
                max="20"
                step="1"
                hide-details
              />
            </div>
            <div class="settings-slider-row">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Sichtbare Bilder</div>
                <div class="settings-slider-row__value">{{ selfieDraft.slideshow_max_visible_photos }}</div>
              </div>
              <v-slider
                v-model="selfieDraft.slideshow_max_visible_photos"
                min="1"
                max="10"
                step="1"
                hide-details
              />
            </div>
          </div>
          <v-alert v-if="selfieError" type="error" variant="tonal" class="mt-4">
            {{ selfieError }}
          </v-alert>
        </section>
      </v-col>

      <v-col v-if="isVisualizerMode" cols="12">
        <section class="settings-section">
          <div class="settings-section__header">
            <div class="settings-section__label">Visualizer</div>
          </div>
          <div class="settings-group settings-group--spaced">
            <div class="settings-control">
              <div class="settings-control__label">Stil</div>
              <v-select
                v-model="visualizerDraft.active_preset"
                class="admin-select"
                :items="visualizerStore.presets"
                :disabled="isBooting"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-control">
              <div class="settings-control__label">Farbwelt</div>
              <v-select
                v-model="visualizerDraft.color_scheme"
                class="admin-select"
                :items="visualizerStore.colorSchemes"
                :disabled="isBooting"
                hide-details
                variant="solo"
                density="comfortable"
              />
            </div>
          </div>

          <div class="settings-divider" />

          <div class="settings-group settings-group--sliders">
            <div class="settings-slider-row settings-slider-row--wide">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Automatikwechsel</div>
                <div class="settings-slider-row__value">{{ visualizerDraft.auto_cycle_interval_seconds }}s</div>
              </div>
              <v-slider
                v-model="visualizerDraft.auto_cycle_interval_seconds"
                min="15"
                max="600"
                step="15"
                hide-details
              />
            </div>
            <div class="settings-slider-row">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Tempo</div>
                <div class="settings-slider-row__value">{{ visualizerDraft.speed }}</div>
              </div>
              <v-slider
                v-model="visualizerDraft.speed"
                min="0"
                max="100"
                step="1"
                hide-details
              />
            </div>
            <div class="settings-slider-row">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Intensität</div>
                <div class="settings-slider-row__value">{{ visualizerDraft.intensity }}</div>
              </div>
              <v-slider
                v-model="visualizerDraft.intensity"
                min="0"
                max="100"
                step="1"
                hide-details
              />
            </div>
            <div class="settings-slider-row">
              <div class="settings-slider-row__header">
                <div class="settings-slider-row__label">Helligkeit</div>
                <div class="settings-slider-row__value">{{ visualizerDraft.brightness }}</div>
              </div>
              <v-slider
                v-model="visualizerDraft.brightness"
                min="0"
                max="100"
                step="1"
                hide-details
              />
            </div>
          </div>
          <v-alert v-if="visualizerError" type="error" variant="tonal" class="mt-4">
            {{ visualizerError }}
          </v-alert>
        </section>
      </v-col>
        </template>

        <template v-else-if="activeWorkspaceSection === 'status'">
      <v-col cols="12">
        <section class="status-dashboard">
          <div class="status-dashboard__header">
            <div class="text-overline">Systemstatus</div>
          </div>

          <div class="status-critical-grid">
            <article
              v-for="card in criticalStatusCards"
              :key="card.title"
              class="status-kpi-card"
              :class="`status-kpi-card--${card.tone}`"
            >
              <div class="status-kpi-card__header">
                <span class="status-kpi-card__dot" />
                <span class="status-kpi-card__title">{{ card.title }}</span>
              </div>
              <div class="status-kpi-card__value">{{ card.value }}</div>
              <div class="status-kpi-card__detail">{{ card.detail }}</div>
            </article>
          </div>

        </section>
      </v-col>

      <v-col cols="12">
        <section class="device-panel">
          <div class="device-panel__header">
            <div class="text-overline">Gerät</div>
          </div>

          <div class="device-panel__metrics">
            <article class="device-metric-card">
              <div class="device-metric-card__label">CPU-Last</div>
              <div class="device-metric-card__value">{{ cpuLoadLabel }}</div>
              <div class="device-meter" aria-hidden="true">
                <span class="device-meter__fill" :style="{ width: `${cpuLoadBarValue}%` }" />
              </div>
            </article>

            <article class="device-metric-card">
              <div class="device-metric-card__label">RAM-Verbrauch</div>
              <div class="device-metric-card__value">{{ memoryUsageLabel }}</div>
              <div class="device-metric-card__meta">{{ memoryPercentLabel }}</div>
              <div class="device-meter" aria-hidden="true">
                <span class="device-meter__fill device-meter__fill--memory" :style="{ width: `${memoryBarValue}%` }" />
              </div>
            </article>

            <article class="device-metric-card">
              <div class="device-metric-card__label">Temperatur</div>
              <div class="device-metric-card__value">{{ cpuTemperatureLabel }}</div>
              <div class="device-metric-card__meta">{{ temperatureHint }}</div>
            </article>

            <article class="device-metric-card">
              <div class="device-metric-card__label">Freier Speicher</div>
              <div class="device-metric-card__value">
                {{ formatOptionalBytes(systemStatusStore.appliance.storage.free_bytes) }}
              </div>
              <div class="device-metric-card__meta">Verfügbar auf dem Gerät</div>
            </article>
          </div>

          <article class="device-health-card">
            <div class="device-health-card__label">Gerätegesundheit</div>
            <div class="device-health-card__value">
              {{
                systemStatusStore.backendReachable && systemStatusStore.dbReachable
                  ? 'System stabil'
                  : 'Eingeschränkt'
              }}
            </div>
            <div class="device-health-card__meta">
              {{
                systemStatusStore.backendReachable && systemStatusStore.dbReachable
                  ? 'Backend und Datenbank antworten.'
                  : 'Mindestens ein zentraler Dienst ist aktuell nicht erreichbar.'
              }}
            </div>
          </article>

          <article class="device-danger-zone">
            <div class="device-danger-zone__copy">
              <div class="device-danger-zone__label">Kritische Aktion</div>
              <div class="device-danger-zone__title">Raspberry Pi ausschalten</div>
              <div class="device-danger-zone__meta">
                Stoppt den lokalen Stack und beendet die Wiedergabe auf dem Display.
              </div>
            </div>
            <v-btn
              color="error"
              variant="tonal"
              class="device-danger-zone__button"
              prepend-icon="mdi-power"
              :loading="isShuttingDown"
              @click="shutdownSystem"
            >
              Ausschalten
            </v-btn>
          </article>

          <v-alert v-if="systemActionError" type="error" variant="tonal" class="mt-4">
            {{ systemActionError }}
          </v-alert>
          <div v-else-if="systemActionMessage" class="inline-note mt-3">
            {{ systemActionMessage }}
          </div>
        </section>
      </v-col>

        </template>

        <template v-else>
      <v-col cols="6" xl="3">
        <v-card
          class="workspace-overview-card workspace-overview-card--kpi upload-filter-card pa-4"
          :class="{ 'workspace-overview-card--active upload-filter-card--active': uploadGalleryFilter === 'all' }"
          variant="flat"
          @click="setUploadGalleryFilter('all')"
        >
          <div class="workspace-overview-label">Uploads</div>
          <div class="workspace-overview-value">{{ uploads.length }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" xl="3">
        <v-card
          class="workspace-overview-card workspace-overview-card--kpi upload-filter-card pa-4"
          :class="{ 'workspace-overview-card--active upload-filter-card--active': uploadGalleryFilter === 'pending' }"
          variant="flat"
          @click="setUploadGalleryFilter('pending')"
        >
          <div class="workspace-overview-label">Ausstehend</div>
          <div class="workspace-overview-value">{{ pendingCount }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" xl="3">
        <v-card
          class="workspace-overview-card workspace-overview-card--kpi upload-filter-card pa-4"
          :class="{ 'workspace-overview-card--active upload-filter-card--active': uploadGalleryFilter === 'rejected' }"
          variant="flat"
          @click="setUploadGalleryFilter('rejected')"
        >
          <div class="workspace-overview-label">Abgelehnt</div>
          <div class="workspace-overview-value">{{ rejectedCount }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" xl="3">
        <v-card
          class="workspace-overview-card workspace-overview-card--kpi upload-filter-card pa-4"
          :class="{ 'workspace-overview-card--active upload-filter-card--active': uploadGalleryFilter === 'latest' }"
          variant="flat"
          @click="setUploadGalleryFilter('latest')"
        >
          <div class="workspace-overview-label">Letzter Upload</div>
          <div class="workspace-overview-value workspace-overview-value--small workspace-overview-value--timestamp">
            {{ latestUploadLabel }}
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" class="upload-gallery-col">
        <section class="upload-gallery-panel">
          <div v-if="filteredUploadGallery.length" class="upload-gallery-header">
            <div class="section-title upload-gallery-header__title">{{ uploadGalleryTitle }}</div>
            <v-btn
              size="small"
              variant="text"
              color="primary"
              class="upload-gallery-header__action"
              prepend-icon="mdi-download"
              :loading="isDownloadingUploadArchive"
              :disabled="!canDownloadUploadArchive"
              @click="downloadCurrentUploadArchive"
            >
              ZIP herunterladen
            </v-btn>
          </div>
          <v-alert v-if="uploadError" type="error" variant="tonal" class="mb-4">
            {{ uploadError }}
          </v-alert>

          <v-row v-if="filteredUploadGallery.length">
            <v-col v-for="upload in filteredUploadGallery" :key="upload.id" cols="12" sm="6" md="4" xl="3">
              <v-card class="upload-card" variant="flat">
                <div class="upload-card__media">
                  <v-img
                    v-if="thumbnailUrls[upload.id]"
                    class="upload-preview"
                    :src="thumbnailUrls[upload.id]"
                    height="220"
                    cover
                  />
                  <v-sheet
                    v-else
                    height="220"
                    class="upload-card__fallback"
                  >
                    <div class="upload-card__fallback-inner">
                      <v-icon icon="mdi-image-outline" size="34" />
                      <span>{{ upload.status === 'processed' ? 'Preview wird geladen' : 'Kein Preview' }}</span>
                    </div>
                  </v-sheet>
                </div>
                <div class="upload-card__body">
                  <div class="upload-card__timestamp">{{ formatCompactDate(upload.created_at) }}</div>
                  <div class="upload-card__meta">
                    <span class="upload-card__meta-item">
                      <v-icon icon="mdi-file-image-outline" size="15" />
                      {{ formatImageMimeLabel(upload.mime_type) }}
                    </span>
                    <span class="upload-card__meta-separator">·</span>
                    <span class="upload-card__meta-item">
                      <v-icon icon="mdi-database-outline" size="15" />
                      {{ formatBytes(upload.size) }}
                    </span>
                  </div>
                  <div class="upload-card__footer">
                    <div
                      class="upload-card__status"
                      :class="`upload-card__status--${uploadStatusTone(upload)}`"
                    >
                      {{ upload.status === 'error' ? 'Fehler' : formatModerationStatusLabel(upload.moderation_status) }}
                    </div>
                    <div class="upload-actions">
                    <template v-if="showUploadModerationActions">
                      <v-btn
                        size="small"
                        color="success"
                        :variant="canApprove(upload) ? 'tonal' : 'outlined'"
                        class="upload-actions__button"
                        :loading="isBusy(`approve:${upload.id}`)"
                        :disabled="!canApprove(upload) || isBusy(`reject:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                        @click="runUploadAction(upload, 'approve')"
                      >
                        {{ approveLabel(upload) }}
                      </v-btn>
                      <v-btn
                        size="small"
                        color="warning"
                        variant="tonal"
                        class="upload-actions__button"
                        :loading="isBusy(`reject:${upload.id}`)"
                        :disabled="!canReject(upload) || isBusy(`approve:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                        @click="runUploadAction(upload, 'reject')"
                      >
                        Ablehnen
                      </v-btn>
                    </template>
                    <v-btn
                      size="small"
                      color="error"
                      variant="text"
                      class="upload-actions__button upload-actions__button--delete"
                      prepend-icon="mdi-trash-can-outline"
                      :loading="isBusy(`delete:${upload.id}`)"
                      :disabled="isBusy(`approve:${upload.id}`) || isBusy(`reject:${upload.id}`)"
                      @click="runUploadAction(upload, 'delete')"
                    >
                      Löschen
                    </v-btn>
                    </div>
                  </div>
                </div>
              </v-card>
            </v-col>
          </v-row>

          <div v-else class="upload-empty-state">
            <v-icon :icon="uploadEmptyState.icon" size="52" class="upload-empty-state__icon" />
            <div class="upload-empty-state__title">{{ uploadEmptyState.title }}</div>
            <div class="upload-empty-state__copy">{{ uploadEmptyState.description }}</div>
          </div>
        </section>
      </v-col>
        </template>
      </v-row>
    </div>
  </section>
</template>

<style scoped>
.admin-workspace-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: hidden;
}

.admin-workspace-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  padding-top: 0;
  padding-bottom: 0.5rem;
  padding-left: 0.625rem;
  padding-right: 0.625rem;
  scrollbar-gutter: stable;
}

.admin-workspace {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding-bottom: 0;
  min-width: 0;
}

.admin-workspace > :first-child {
  padding-top: 0;
}

.admin-workspace > .v-col,
.admin-workspace > [class*='v-col-'] {
  padding: 6px;
  min-width: 0;
}

.admin-mode-sticky-col {
  padding-top: 0 !important;
  background: transparent;
  backdrop-filter: none;
}

.workspace-overview-card,
.workspace-panel,
.status-live-panel {
  border: 1px solid rgba(176, 210, 240, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(14px);
  box-shadow:
    0 10px 24px rgba(4, 10, 18, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.034),
    inset 0 0 0 1px rgba(166, 205, 235, 0.05) !important;
  transition:
    box-shadow 150ms ease,
    border-color 150ms ease,
    transform 150ms ease;
}

.workspace-overview-card {
  height: 100%;
  background: rgba(9, 16, 25, 0.74) !important;
}

.workspace-overview-card--kpi {
  padding-block: 0.95rem !important;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.upload-filter-card {
  position: relative;
  overflow: hidden;
  border-color: rgba(176, 210, 240, 0.1);
  background: rgba(8, 14, 22, 0.5) !important;
  box-shadow:
    0 8px 18px rgba(4, 10, 18, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    inset 0 0 0 1px rgba(166, 205, 235, 0.05) !important;
}

.upload-filter-card::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(94, 211, 244, 0), rgba(94, 211, 244, 0.34), rgba(94, 211, 244, 0));
  opacity: 0;
  transition: opacity 160ms ease;
}

.workspace-overview-card--kpi:hover {
  border-color: rgba(98, 214, 231, 0.2);
  background: rgba(12, 21, 32, 0.84) !important;
}

.upload-filter-card:hover {
  border-color: rgba(98, 214, 231, 0.14);
  background: rgba(10, 18, 28, 0.68) !important;
  box-shadow:
    0 12px 24px rgba(4, 10, 18, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
}

.workspace-overview-card--active {
  border-color: rgba(98, 214, 231, 0.28);
  background: rgba(14, 25, 38, 0.92) !important;
  box-shadow:
    0 10px 24px rgba(4, 10, 18, 0.16),
    inset 0 0 0 1px rgba(98, 214, 231, 0.12) !important;
}

.upload-filter-card--active {
  border-color: rgba(94, 211, 244, 0.28);
  background:
    radial-gradient(circle at top right, rgba(94, 211, 244, 0.12), transparent 54%),
    rgba(12, 22, 34, 0.94) !important;
  box-shadow:
    0 14px 28px rgba(4, 10, 18, 0.2),
    0 0 0 1px rgba(94, 211, 244, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
}

.upload-filter-card--active::after {
  opacity: 1;
}

.workspace-overview-label {
  color: rgba(194, 211, 228, 0.5);
  letter-spacing: 0.14em;
  text-transform: none;
  font-size: 0.72rem;
  font-weight: 700;
}

.workspace-overview-value {
  margin-top: 0.5rem;
  font-size: clamp(1.7rem, 2vw, 2.2rem);
  font-weight: 760;
  line-height: 1.08;
  color: rgba(244, 249, 255, 0.96);
}

.workspace-overview-value--small {
  font-size: 1.05rem;
  line-height: 1.45;
}

.workspace-overview-copy {
  margin-top: 0.35rem;
  color: rgba(208, 220, 232, 0.62);
  line-height: 1.45;
}

.workspace-overview-value--timestamp {
  font-size: 1rem;
  line-height: 1.4;
}

.status-live-panel {
  border: 0;
  border-radius: 0;
  background: transparent !important;
  backdrop-filter: none;
  box-shadow: none !important;
}

.status-dashboard {
  display: grid;
  gap: 0.9rem;
}

.status-dashboard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-critical-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.status-kpi-card,
.status-stat-card {
  border-radius: 20px;
  border: 1px solid rgba(160, 194, 226, 0.08);
  background: rgba(10, 18, 27, 0.66);
}

.status-kpi-card {
  padding: 0.95rem 1rem;
}

.status-kpi-card__header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.status-kpi-card__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: rgba(133, 154, 177, 0.7);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.02);
}

.status-kpi-card__title {
  color: rgba(194, 211, 228, 0.54);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.status-kpi-card__value {
  margin-top: 0.7rem;
  color: rgba(245, 249, 255, 0.98);
  font-size: 1.15rem;
  font-weight: 750;
  line-height: 1.15;
}

.status-kpi-card__detail {
  margin-top: 0.35rem;
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.8rem;
  line-height: 1.35;
}

.status-kpi-card--success .status-kpi-card__dot {
  background: #39d98a;
}

.status-kpi-card--warning .status-kpi-card__dot {
  background: #f2c14e;
}

.status-kpi-card--error .status-kpi-card__dot {
  background: #ff6b6b;
}

.status-stat-card__title {
  color: rgba(194, 211, 228, 0.54);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.status-stat-card__value {
  color: rgba(245, 249, 255, 0.96);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}

.status-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.status-stat-card {
  padding: 0.9rem 1rem;
  display: grid;
  gap: 0.4rem;
}

.status-stat-card__detail {
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.8rem;
}

.section-title {
  margin-bottom: 0.6rem;
  color: rgba(240, 246, 252, 0.94);
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.2;
}

.upload-gallery-panel {
  display: grid;
  gap: 0.7rem;
}

.upload-gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.upload-gallery-header__title {
  margin-bottom: 0;
}

.upload-gallery-header__action {
  margin-left: auto;
  min-height: 2rem;
  padding-inline: 0.35rem;
}

.upload-gallery-col {
  padding-top: 1.15rem !important;
}

.upload-gallery-panel {
  min-height: 16rem;
}

.upload-empty-state {
  min-height: 13rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.5rem;
  padding: 1.2rem 0.8rem;
  text-align: center;
}

.upload-empty-state__icon {
  color: rgba(129, 171, 207, 0.5);
}

.upload-empty-state__title {
  color: rgba(244, 249, 255, 0.94);
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.25;
}

.upload-empty-state__copy {
  max-width: 28rem;
  color: rgba(201, 214, 228, 0.6);
  font-size: 0.86rem;
  line-height: 1.45;
}

.device-panel {
  display: grid;
  gap: 0.9rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.device-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-panel__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.device-metric-card,
.device-health-card,
.device-danger-zone {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.device-metric-card {
  display: grid;
  gap: 0.28rem;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.025);
}

.device-metric-card__label,
.device-health-card__label,
.device-danger-zone__label {
  color: rgba(194, 211, 228, 0.54);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.device-metric-card__value,
.device-health-card__value {
  color: rgba(245, 249, 255, 0.97);
  font-size: 1.05rem;
  font-weight: 720;
  line-height: 1.2;
}

.device-metric-card__meta,
.device-health-card__meta,
.device-danger-zone__meta {
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.8rem;
  line-height: 1.35;
}

.device-meter {
  margin-top: 0.4rem;
  width: 100%;
  height: 0.32rem;
  border-radius: 999px;
  background: rgba(112, 129, 150, 0.22);
  overflow: hidden;
}

.device-meter__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(81, 209, 226, 0.82), rgba(77, 181, 140, 0.78));
}

.device-meter__fill--memory {
  background: linear-gradient(90deg, rgba(82, 196, 255, 0.8), rgba(97, 153, 255, 0.76));
}

.device-health-card {
  display: grid;
  gap: 0.3rem;
  padding: 0.95rem 1rem;
  background: rgba(255, 255, 255, 0.022);
}

.device-danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1rem;
  background: rgba(91, 21, 25, 0.16);
  border-color: rgba(255, 107, 107, 0.12);
}

.device-danger-zone__copy {
  display: grid;
  gap: 0.28rem;
}

.device-danger-zone__title {
  color: rgba(250, 241, 242, 0.96);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.device-danger-zone__button {
  min-height: 2.6rem;
  padding-inline: 1rem;
  border-radius: 14px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.workspace-panel {
  background: rgba(8, 16, 25, 0.72) !important;
}

.workspace-panel--plain {
  border: 0;
  border-top: 1px solid rgba(150, 182, 213, 0.1);
  border-radius: 0;
  background: transparent !important;
  backdrop-filter: none;
  box-shadow: none !important;
  padding-inline: 0 !important;
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
}

.mode-info-panel {
  background: rgba(10, 18, 27, 0.72) !important;
}

.mode-info-panel.workspace-panel--plain {
  background: transparent !important;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.settings-section {
  display: grid;
  gap: 0.1rem;
  padding-top: 0;
  min-width: 0;
}

.settings-section__header {
  margin-bottom: 0.62rem;
}

.settings-section__label {
  color: rgba(194, 211, 228, 0.42);
  letter-spacing: 0.11em;
  text-transform: uppercase;
  font-size: 0.66rem;
  font-weight: 700;
}

.panel-kicker {
  color: rgba(194, 211, 228, 0.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.69rem;
  font-weight: 700;
}

.panel-title {
  color: rgba(245, 249, 255, 0.96);
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.2;
}

.settings-group {
  display: grid;
  gap: 0.48rem;
  min-width: 0;
}

.settings-group--spaced {
  margin-bottom: 0.55rem;
}

.settings-group--sliders {
  gap: 0.72rem;
}

.settings-group__label {
  color: rgba(184, 203, 222, 0.42);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.64rem;
  font-weight: 700;
}

.settings-control {
  display: grid;
  gap: 0.28rem;
}

.settings-control__label {
  color: rgba(221, 231, 241, 0.78);
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.2;
}

.settings-divider {
  display: block;
  width: 100%;
  min-width: 100%;
  margin: 0.68rem 0 0.5rem;
  height: 1px;
  justify-self: stretch;
  background: linear-gradient(
    90deg,
    rgba(118, 145, 172, 0.02) 0%,
    rgba(86, 214, 231, 0.1) 50%,
    rgba(118, 145, 172, 0.02) 100%
  );
  opacity: 0.7;
}

.settings-toggle-row {
  margin: 0;
}

.inline-note {
  color: rgba(208, 220, 232, 0.64);
  line-height: 1.5;
}

.settings-copy {
  font-size: 0.92rem;
}

.workspace-panels {
  background: transparent;
}

:deep(.workspace-panels .v-expansion-panel) {
  margin-bottom: 0.65rem;
  border-radius: 20px !important;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025) !important;
}

:deep(.workspace-panels .v-expansion-panel-title) {
  min-height: 3rem;
  padding: 0.85rem 1rem;
  font-weight: 700;
}

:deep(.workspace-panels .v-expansion-panel-text__wrapper) {
  padding: 0 1rem 1rem;
}

.status-grid {
  display: grid;
  grid-template-columns: minmax(120px, 160px) 1fr;
  gap: 0.5rem 0.75rem;
}

.status-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

:deep(.status-chip-row .v-chip) {
  border: 1px solid rgba(157, 190, 220, 0.08);
  backdrop-filter: blur(10px);
}

.event-access-block {
  padding: 0.75rem;
  border-radius: 18px;
  background: rgba(16, 26, 39, 0.64);
  border: 1px solid rgba(160, 194, 226, 0.08);
}

.event-access-label {
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(103, 212, 255, 0.9);
}

.event-access-copy {
  margin-top: 0.35rem;
  color: rgba(255, 255, 255, 0.6);
}

.event-access-url {
  margin-top: 0.5rem;
  word-break: break-word;
  color: rgba(236, 243, 250, 0.82);
}

.event-log-list {
  display: grid;
  gap: 0.6rem;
}

.event-log-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.event-log-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.event-log-name {
  font-weight: 600;
}

.event-log-time {
  color: rgba(194, 208, 223, 0.58);
  text-align: right;
}

.upload-card {
  overflow: hidden;
  border-radius: 22px;
  background: rgba(8, 14, 22, 0.76) !important;
  border: 1px solid rgba(164, 195, 223, 0.08);
  backdrop-filter: blur(14px);
  box-shadow:
    0 10px 24px rgba(4, 10, 18, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
}

.upload-card__media {
  overflow: hidden;
  border-radius: 22px 22px 0 0;
}

.upload-card__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top, rgba(108, 198, 255, 0.12), transparent 52%),
    linear-gradient(180deg, rgba(12, 24, 38, 0.98), rgba(7, 14, 24, 0.94));
}

.upload-card__fallback-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 1rem;
  color: rgba(194, 208, 223, 0.66);
  font-size: 0.8rem;
  text-align: center;
}

.upload-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.7rem;
  max-width: 100%;
  padding: 0.2rem 0.56rem;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(246, 250, 255, 0.96);
  font-size: 0.71rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.upload-card__status--success {
  background: rgba(35, 180, 118, 0.22);
  border-color: rgba(87, 220, 156, 0.2);
}

.upload-card__status--warning {
  background: rgba(255, 185, 44, 0.2);
  border-color: rgba(255, 205, 108, 0.24);
  color: rgba(255, 246, 224, 0.94);
}

.upload-card__status--error {
  background: rgba(255, 92, 92, 0.22);
  border-color: rgba(255, 135, 135, 0.22);
}

.upload-card:hover .upload-card__status {
  box-shadow: 0 8px 18px rgba(4, 10, 18, 0.22);
}

.upload-card__body {
  display: grid;
  gap: 0.42rem;
  padding: 0.85rem 0.95rem 0.95rem;
}

.upload-card__footer {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  justify-content: space-between;
  margin-top: 0.2rem;
}

.upload-card__timestamp {
  color: rgba(221, 231, 242, 0.88);
  font-size: 0.82rem;
  font-weight: 640;
  line-height: 1.2;
}

.upload-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  color: rgba(194, 208, 223, 0.66);
}

.upload-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
  min-width: 0;
  font-size: 0.76rem;
  line-height: 1.1;
}

.upload-card__meta-separator {
  color: rgba(194, 208, 223, 0.38);
}

.upload-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.upload-actions__button {
  min-height: 2rem;
  padding-inline: 0.68rem;
  border-radius: 999px;
}

:deep(.upload-card .v-card__overlay) {
  opacity: 0 !important;
}

:deep(.upload-card .v-card-item),
:deep(.upload-card .v-card-text) {
  background: transparent;
}

:deep(.upload-preview .v-img__img) {
  opacity: 1 !important;
  filter: none !important;
}

:deep(.settings-section .v-btn),
:deep(.workspace-panel .v-btn),
:deep(.workspace-overview-card .v-btn),
:deep(.upload-card .v-btn) {
  transition:
    transform 150ms ease,
    box-shadow 180ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}

:deep(.settings-section .v-btn:active),
:deep(.workspace-panel .v-btn:active),
:deep(.workspace-overview-card .v-btn:active),
:deep(.upload-card .v-btn:active) {
  transform: scale(0.985);
}

:deep(.settings-section .v-switch .v-selection-control__wrapper),
:deep(.workspace-panel .v-switch .v-selection-control__wrapper) {
  width: 3.15rem;
}

:deep(.settings-section .v-switch .v-switch__track),
:deep(.workspace-panel .v-switch .v-switch__track) {
  border-radius: 999px;
  background: rgba(118, 136, 156, 0.36);
  opacity: 1;
  transition:
    background-color 160ms ease,
    opacity 160ms ease;
}

:deep(.settings-section .v-switch .v-switch__thumb),
:deep(.workspace-panel .v-switch .v-switch__thumb) {
  background: rgba(241, 247, 252, 0.94);
  box-shadow: 0 4px 10px rgba(7, 13, 21, 0.24);
  transition:
    background-color 160ms ease,
    transform 160ms ease;
}

:deep(.settings-section .v-switch.v-selection-control--dirty .v-switch__track),
:deep(.workspace-panel .v-switch.v-selection-control--dirty .v-switch__track) {
  background: linear-gradient(90deg, rgba(66, 207, 226, 0.9), rgba(41, 183, 156, 0.9));
}

:deep(.settings-section .v-switch.v-selection-control--dirty .v-switch__thumb),
:deep(.workspace-panel .v-switch.v-selection-control--dirty .v-switch__thumb) {
  background: #fbfeff;
}

:deep(.settings-group--sliders .v-input) {
  margin: 0;
}

:deep(.settings-section .v-selection-control) {
  margin: 0;
}

:deep(.settings-section .v-input),
:deep(.workspace-panel .v-input) {
  min-width: 0;
}

:deep(.settings-section .admin-select) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0;
}

:deep(.settings-section .v-input .v-field),
:deep(.workspace-panel .v-input .v-field) {
  border-radius: 18px;
  background: rgba(17, 28, 41, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

:deep(.settings-section .admin-select .v-field) {
  width: 100%;
  min-height: 47px;
  border: 1px solid rgba(154, 186, 217, 0.1);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.018),
    0 0 0 1px rgba(255, 255, 255, 0.006);
}

:deep(.settings-section .admin-select .v-field__overlay) {
  opacity: 0;
}

:deep(.settings-section .admin-select .v-field__outline) {
  display: none;
}

:deep(.settings-section .admin-select .v-field__input) {
  min-height: 47px;
  padding-top: 8px;
  padding-bottom: 8px;
}

:deep(.settings-section .admin-select .v-select__selection) {
  color: rgba(245, 249, 255, 0.96);
  line-height: 1.2;
  font-size: 0.88rem;
}

:deep(.settings-section .admin-select .v-field__append-inner) {
  align-self: center;
}

:deep(.settings-section .admin-select .v-field--focused) {
  border-color: rgba(89, 214, 228, 0.42);
  box-shadow:
    0 0 0 1px rgba(89, 214, 228, 0.22),
    0 10px 20px rgba(5, 16, 27, 0.14);
}

:deep(.settings-section .v-field) {
  min-height: 48px;
}

:deep(.settings-section .v-input__details) {
  min-height: 0;
  padding-top: 2px;
}

:deep(.settings-section .v-slider) {
  margin: 0;
}

:deep(.settings-section .v-slider + .v-slider) {
  margin-top: 0.25rem;
}

:deep(.settings-section .v-input--horizontal) {
  column-gap: 0.8rem;
}

:deep(.settings-section .v-slider .v-input__control) {
  min-height: auto;
}

:deep(.settings-section .v-slider-track__container) {
  height: 0.28rem;
}

:deep(.settings-section .v-slider-track__background),
:deep(.workspace-panel .v-slider-track__background) {
  opacity: 1;
  background: rgba(103, 124, 147, 0.22);
}

:deep(.settings-section .v-slider-track__fill),
:deep(.workspace-panel .v-slider-track__fill) {
  background: linear-gradient(90deg, rgba(66, 207, 226, 0.78), rgba(47, 149, 245, 0.76));
}

:deep(.settings-section .v-slider-thumb__surface),
:deep(.workspace-panel .v-slider-thumb__surface) {
  background: #f7fbff;
  transform: scale(0.9);
}

.settings-slider-row {
  display: grid;
  gap: 0.32rem;
  padding: 0.52rem 0.02rem 0.18rem;
}

.settings-slider-row--wide {
  gap: 0.24rem;
}

.settings-slider-row__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.settings-slider-row__label {
  color: rgba(229, 237, 245, 0.84);
  font-size: 0.82rem;
  font-weight: 640;
  line-height: 1.2;
}

.settings-slider-row__meta {
  color: rgba(184, 203, 222, 0.52);
  font-size: 0.7rem;
  line-height: 1.2;
}

.settings-slider-row__value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  min-height: 1.45rem;
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(244, 249, 255, 0.92);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.video-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.video-upload-status {
  display: grid;
  gap: 0.35rem;
}

.video-library-list {
  display: grid;
  gap: 0.6rem;
}

.video-library-item {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 0.8rem;
  align-items: stretch;
  padding: 0.72rem;
  border-radius: 18px;
  background: rgba(14, 21, 31, 0.52);
  border: 1px solid rgba(160, 194, 226, 0.045);
  min-width: 0;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease;
}

.video-library-item:hover {
  border-color: rgba(102, 215, 231, 0.12);
  background: rgba(15, 24, 35, 0.6);
}

.video-library-item--active {
  border-color: rgba(102, 215, 231, 0.16);
  background: rgba(16, 27, 39, 0.68);
  box-shadow: inset 0 0 0 1px rgba(102, 215, 231, 0.05);
}

.video-library-item__thumb {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 70px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(27, 38, 52, 0.72), rgba(17, 27, 39, 0.78));
  border: 1px solid rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.video-library-item__placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: rgba(160, 193, 224, 0.48);
}

.video-library-item__order {
  position: absolute;
  top: 0.38rem;
  left: 0.38rem;
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: rgba(7, 12, 18, 0.42);
  color: rgba(239, 245, 250, 0.7);
  font-size: 0.67rem;
  font-weight: 700;
}

.video-library-item__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.48rem;
}

.video-library-item__content {
  min-width: 0;
  display: grid;
  gap: 0.28rem;
}

.video-library-item__title-row {
  display: flex;
  min-width: 0;
}

.video-library-item__title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: rgba(245, 249, 255, 0.96);
  font-weight: 620;
  line-height: 1.2;
}

.video-library-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.74rem;
  line-height: 1.25;
}

.video-library-item__actions {
  display: flex;
  justify-content: flex-start;
  gap: 0.18rem;
  min-width: 0;
}

.video-library-action {
  opacity: 0.78;
}

:deep(.video-library-action.v-btn) {
  min-width: 2rem;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
}

:deep(.video-library-action:hover) {
  background: rgba(255, 255, 255, 0.045);
  opacity: 1;
}

.video-library-action--danger {
  opacity: 0.72;
}

@media (max-width: 959px) {
  .admin-workspace-scroll {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .status-critical-grid,
  .status-stat-grid,
  .device-panel__metrics {
    grid-template-columns: 1fr;
  }

  .device-danger-zone {
    flex-direction: column;
    align-items: stretch;
  }

  .device-danger-zone__button {
    width: 100%;
  }

  .event-log-row {
    flex-direction: column;
    gap: 0.2rem;
  }

  .event-log-time {
    text-align: left;
  }

  :deep(.workspace-panels .v-expansion-panel-title) {
    padding-inline: 0.85rem;
  }

  :deep(.workspace-panels .v-expansion-panel-text__wrapper) {
    padding: 0 0.85rem 0.85rem;
  }

  .panel-title {
    font-size: 0.94rem;
  }

  :deep(.workspace-panel .v-btn) {
    min-height: 2.55rem;
  }

  .workspace-overview-card {
    border-radius: 20px;
  }

  .workspace-panel--plain {
    padding-top: 0.25rem !important;
    padding-bottom: 0.25rem !important;
  }

  .settings-section__header {
    margin-bottom: 0.75rem;
  }

  .settings-group {
    gap: 0.55rem;
  }

  .settings-group--spaced {
    margin-bottom: 0.5rem;
  }

  .video-library-item {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .video-library-item__thumb {
    min-height: 66px;
  }

  .video-library-item__actions {
    justify-content: flex-start;
  }
}
</style>
