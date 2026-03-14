<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type {
  AppMode,
  ColorScheme,
  DisplayRenderMode,
  HydraPaletteMode,
  HydraQuality,
  ModerationMode,
  OverlayMode,
  RemoteRendererFallback,
  RemoteVisualizerFallback,
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
  startSetupMode,
  stopSetupMode,
  triggerSystemRestart,
  triggerSystemShutdown,
  uploadAdminVideo,
} from '../../services/api'
import QrCodeMatrix from '../../components/branding/QrCodeMatrix.vue'
import AdminShowControlHeader from '../../components/admin/AdminShowControlHeader.vue'
import { useAdminUploadsBadgeStore } from '../../stores/adminUploadsBadge'
import { useAppModeStore } from '../../stores/appMode'
import { useAuthStore } from '../../stores/auth'
import { usePublicRuntimeStore } from '../../stores/publicRuntime'
import { useSelfieStore } from '../../stores/selfie'
import { useStandbyStore } from '../../stores/standby'
import { useSystemStatusStore } from '../../stores/systemStatus'
import { useVideoStore } from '../../stores/video'
import { useVisualizerStore } from '../../stores/visualizer'

const route = useRoute()
const authStore = useAuthStore()
const adminUploadsBadgeStore = useAdminUploadsBadgeStore()
const appModeStore = useAppModeStore()
const publicRuntimeStore = usePublicRuntimeStore()
const selfieStore = useSelfieStore()
const standbyStore = useStandbyStore()
const systemStatusStore = useSystemStatusStore()
const videoStore = useVideoStore()
const visualizerStore = useVisualizerStore()

type AdminWorkspaceSection = 'modus' | 'status' | 'uploads'
type UploadGalleryFilter = 'all' | 'pending' | 'rejected' | 'new'
type RecentEventEntry = {
  name: string
  at: string
}
type SystemActionNotice = {
  title: string
  text: string
  icon: string
}

const errorMessage = ref('')
const visualizerError = ref('')
const selfieError = ref('')
const standbyError = ref('')
const videoError = ref('')
const remoteVisualizerError = ref('')
const remoteRendererError = ref('')
const uploadError = ref('')
const systemActionError = ref('')
const systemActionNotice = ref<SystemActionNotice | null>(null)
const isBooting = ref(true)
const isSwitchingMode = ref(false)
const optimisticMode = ref<AppMode | null>(null)
const isSavingVisualizer = ref(false)
const isSavingSelfie = ref(false)
const isSavingStandby = ref(false)
const isSavingVideo = ref(false)
const isSavingRemoteVisualizer = ref(false)
const isSavingRemoteRenderer = ref(false)
const isUploadingVideos = ref(false)
const isShuttingDown = ref(false)
const isRestartingSystem = ref(false)
const isTogglingSetupMode = ref(false)
const isDownloadingUploadArchive = ref(false)
const isDeletingAllUploads = ref(false)
const dashboardLiveActive = ref(false)
const uploads = ref<UploadItem[]>([])
const thumbnailUrls = ref<Record<number, string>>({})
const busyActions = ref<Record<string, boolean>>({})
const eventSource = ref<EventSource | null>(null)
const reconnectTimer = ref<number>()
const reconnectAttempt = ref(0)
const isHydratingVisualizerDraft = ref(true)
const isHydratingSelfieDraft = ref(true)
const isHydratingStandbyDraft = ref(true)
const isHydratingVideoDraft = ref(true)
const isHydratingRemoteVisualizerDraft = ref(true)
const isHydratingRemoteRendererDraft = ref(true)
const isRefreshingOperationalState = ref(false)
const pendingOperationalRefresh = ref(false)
const recentEvents = ref<RecentEventEntry[]>([])
const videoFileInput = ref<HTMLInputElement | null>(null)
const videoDurations = ref<Record<number, string>>({})
const videoMetadataLoading = ref<Record<number, boolean>>({})
const videoUploadLabel = ref('')
const uploadGalleryFilter = ref<UploadGalleryFilter>('all')
const isUploadBulkMenuOpen = ref(false)
const isDeleteAllUploadsDialogOpen = ref(false)
const isGuestQrDialogOpen = ref(false)
const sessionNewUploadIds = ref<number[]>([])
const adminUploadFetchLimit = 100

const visualizerDraft = reactive<{
  active_preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  color_scheme: ColorScheme
  hydra_colorfulness: number
  hydra_scene_change_rate: number
  hydra_symmetry_amount: number
  hydra_feedback_amount: number
  hydra_quality: HydraQuality
  hydra_audio_reactivity_enabled: boolean
  hydra_palette_mode: HydraPaletteMode
  overlay_mode: OverlayMode
  auto_cycle_enabled: boolean
  auto_cycle_interval_minutes: number
}>({
  active_preset: 'warehouse',
  intensity: 65,
  speed: 55,
  brightness: 70,
  color_scheme: 'acid',
  hydra_colorfulness: 78,
  hydra_scene_change_rate: 46,
  hydra_symmetry_amount: 38,
  hydra_feedback_amount: 24,
  hydra_quality: 'medium',
  hydra_audio_reactivity_enabled: true,
  hydra_palette_mode: 'auto',
  overlay_mode: 'logo',
  auto_cycle_enabled: false,
  auto_cycle_interval_minutes: 10,
})

const selfieDraft = reactive<{
  slideshow_enabled: boolean
  slideshow_interval_seconds: number
  slideshow_max_visible_photos: number
  slideshow_min_uploads_to_start: number
  slideshow_shuffle: boolean
  overlay_mode: OverlayMode
  vintage_look_enabled: boolean
  moderation_mode: ModerationMode
}>({
  slideshow_enabled: true,
  slideshow_interval_seconds: 6,
  slideshow_max_visible_photos: 4,
  slideshow_min_uploads_to_start: 3,
  slideshow_shuffle: true,
  overlay_mode: 'logo',
  vintage_look_enabled: false,
  moderation_mode: 'auto_approve',
})

const standbyDraft = reactive<{
  headline: string
  subheadline: string
  hue_shift_degrees: number
}>({
  headline: 'Unterm Berg beginnt die Nacht',
  subheadline: 'Willkommen im Auberg-Keller',
  hue_shift_degrees: 0,
})

const videoDraft = reactive<{
  playlist_enabled: boolean
  loop_enabled: boolean
  playback_order: VideoPlaybackOrder
  vintage_filter_enabled: boolean
  overlay_mode: OverlayMode
  object_fit: VideoObjectFit
  transition: VideoTransition
  active_video_id: number | null
}>({
  playlist_enabled: true,
  loop_enabled: true,
  playback_order: 'upload_order',
  vintage_filter_enabled: false,
  overlay_mode: 'logo',
  object_fit: 'contain',
  transition: 'none',
  active_video_id: null,
})

const remoteVisualizerDraft = reactive<{
  remote_visualizer_enabled: boolean
  remote_visualizer_url: string
  remote_visualizer_reconnect_ms: number
  remote_visualizer_fallback: RemoteVisualizerFallback
}>({
  remote_visualizer_enabled: false,
  remote_visualizer_url: '',
  remote_visualizer_reconnect_ms: 3000,
  remote_visualizer_fallback: 'local',
})

const remoteRendererDraft = reactive<{
  display_render_mode: DisplayRenderMode
  remote_renderer_base_url: string
  remote_renderer_output_path: string
  remote_renderer_health_url: string
  remote_renderer_reconnect_ms: number
  remote_renderer_fallback: RemoteRendererFallback
}>({
  display_render_mode: 'local',
  remote_renderer_base_url: '',
  remote_renderer_output_path: '/preview',
  remote_renderer_health_url: '',
  remote_renderer_reconnect_ms: 3000,
  remote_renderer_fallback: 'local',
})

const modeButtons: Array<{ label: string; value: AppMode }> = [
  { label: 'Visualizer', value: 'visualizer' },
  { label: 'Slideshow', value: 'selfie' },
  { label: 'Video', value: 'video' },
  { label: 'Standby', value: 'idle' },
  { label: 'Blackout', value: 'blackout' },
]

const videoOrderItems = [
  { title: 'Hochladereihenfolge', value: 'upload_order' },
  { title: 'Zufällig', value: 'random' },
] as const

const videoFitItems = [
  { title: 'Einpassen', value: 'contain' },
  { title: 'Zuschneiden', value: 'cover' },
] as const

const remoteVisualizerFallbackItems = [
  { title: 'Lokaler Fallback', value: 'local' },
  { title: 'Neutraler Hintergrund', value: 'none' },
] as const

const displayRenderModeItems = [
  { title: 'Lokal rendern', value: 'local' },
  { title: 'Remote Headless Renderer (Reserve)', value: 'remote_headless' },
] as const

const remoteRendererFallbackItems = [
  { title: 'Lokaler Fallback', value: 'local' },
  { title: 'Hinweis anzeigen', value: 'notice' },
] as const

const visualizerPresetLabels: Record<VisualizerPreset, string> = {
  particles: 'Particles',
  kaleidoscope: 'Kaleidoscope',
  warehouse: 'Warehouse',
  nebel: 'Nebel',
  vanta_halo: 'Vanta HALO',
  hydra_rave: 'Hydra Rave',
  hydra_chromaflow: 'Hydra Chromaflow',
}

const hydraQualityLabels: Record<HydraQuality, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const hydraPaletteModeLabels: Record<HydraPaletteMode, string> = {
  auto: 'Auto',
  neon: 'Neon',
  warm: 'Warm',
  cold: 'Cold',
  acid: 'Acid',
}

let visualizerPersistTimer: number | undefined
let selfiePersistTimer: number | undefined
let standbyPersistTimer: number | undefined
let videoPersistTimer: number | undefined
let remoteVisualizerPersistTimer: number | undefined
let remoteRendererPersistTimer: number | undefined
let systemActionNoticeTimer: number | undefined

const slideshowRunningLabel = computed(() =>
  selfieStore.slideshowEnabled ? 'läuft' : 'pausiert',
)

const displayUploads = computed(() =>
  [...uploads.value].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  ),
)

const pendingCount = computed(
  () => uploads.value.filter((upload) => upload.moderation_status === 'pending').length,
)

const rejectedCount = computed(
  () => uploads.value.filter((upload) => upload.moderation_status === 'rejected').length,
)

const newUploads = computed(() =>
  displayUploads.value.filter((upload) => sessionNewUploadIds.value.includes(upload.id)),
)

const newUploadCount = computed(() => newUploads.value.length)

const filteredUploadGallery = computed(() => {
  if (uploadGalleryFilter.value === 'pending') {
    return displayUploads.value.filter((upload) => upload.moderation_status === 'pending')
  }
  if (uploadGalleryFilter.value === 'rejected') {
    return displayUploads.value.filter((upload) => upload.moderation_status === 'rejected')
  }
  if (uploadGalleryFilter.value === 'new') {
    return newUploads.value
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
  if (uploadGalleryFilter.value === 'new') {
    return 'Neue Uploads'
  }
  return 'Alle Uploads'
})

const canManageAllUploads = computed(() =>
  uploads.value.length > 0 && Boolean(authStore.token),
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
  if (uploadGalleryFilter.value === 'new') {
    return {
      icon: 'mdi-image-plus-outline',
      title: 'Keine neuen Uploads',
      description: 'Neu hinzugekommene Bilder erscheinen hier, sobald während dieser Sitzung neue Uploads eingehen.',
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

const activeMode = computed(() => optimisticMode.value ?? appModeStore.mode)

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
  if (activeMode.value === 'selfie') {
    return [
      {
        id: 'selfie:moderation',
        label: selfieDraft.moderation_mode === 'auto_approve' ? 'Freigabe auto' : 'Freigabe manuell',
        color: 'primary' as const,
        loading: isBusy('selfie:moderation'),
        disabled: isBooting.value,
        active: selfieDraft.moderation_mode === 'manual_approve',
      },
      {
        id: 'selfie:shuffle',
        label: selfieDraft.slideshow_shuffle ? 'Shuffle an' : 'Shuffle aus',
        color: 'primary' as const,
        loading: isBusy('selfie:shuffle'),
        disabled: isBooting.value,
        active: selfieDraft.slideshow_shuffle,
      },
      {
        id: 'selfie:vintage',
        label: selfieDraft.vintage_look_enabled ? 'Vintage an' : 'Vintage aus',
        color: 'primary' as const,
        loading: isBusy('selfie:vintage'),
        disabled: isBooting.value,
        active: selfieDraft.vintage_look_enabled,
      },
      {
        id: 'selfie:overlay-mode',
        label: overlayModeLabel(selfieDraft.overlay_mode),
        color: 'primary' as const,
        loading: isBusy('selfie:overlay-mode'),
        disabled: isBooting.value,
        active: selfieDraft.overlay_mode !== 'off',
      },
      {
        id: 'selfie:guest-qr',
        label: 'Gäste-Upload QR-Code',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value || !guestUploadUrl.value,
        active: false,
      },
    ]
  }

  if (activeMode.value === 'visualizer') {
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
        label: visualizerDraft.auto_cycle_enabled ? 'Automatikwechsel an' : 'Automatikwechsel aus',
        color: 'secondary' as const,
        loading: isBusy('visualizer:auto-cycle'),
        disabled: isBooting.value,
        active: visualizerDraft.auto_cycle_enabled,
      },
      {
        id: 'visualizer:overlay-mode',
        label: overlayModeLabel(visualizerDraft.overlay_mode),
        color: 'secondary' as const,
        loading: isBusy('visualizer:overlay-mode'),
        disabled: isBooting.value,
        active: visualizerDraft.overlay_mode !== 'off',
      },
    ]
  }

  if (activeMode.value === 'video') {
    return [
      {
        id: 'video:upload',
        label: 'Video hochladen',
        color: 'primary' as const,
        loading: isUploadingVideos.value || isSavingVideo.value,
        disabled: isBooting.value,
      },
      {
        id: 'video:vintage',
        label: videoDraft.vintage_filter_enabled ? 'Vintage ein' : 'Vintage aus',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value,
        active: videoDraft.vintage_filter_enabled,
      },
      {
        id: 'video:transition',
        label: videoDraft.transition === 'fade' ? 'Übergang ein' : 'Übergang aus',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value,
        active: videoDraft.transition === 'fade',
      },
      {
        id: 'video:overlay-mode',
        label: overlayModeLabel(videoDraft.overlay_mode),
        color: 'primary' as const,
        loading: isBusy('video:overlay-mode'),
        disabled: isBooting.value,
        active: videoDraft.overlay_mode !== 'off',
      },
    ]
  }

  return []
})

const moderationSummaryLabel = computed(() =>
  selfieStore.moderationMode === 'auto_approve' ? 'Auto' : 'Manuell',
)

const showUploadModerationActions = computed(() =>
  selfieDraft.moderation_mode === 'manual_approve',
)

const visualizerAutoCycleSummaryLabel = computed(() =>
  visualizerStore.autoCycleEnabled ? 'Aktiv' : 'Pausiert',
)

const visualizerTelemetryLabel = computed(
  () =>
    `T ${visualizerStore.speed} / I ${visualizerStore.intensity} / H ${visualizerStore.brightness}`,
)

const visualizerPresetItems = computed(() => {
  const presets: VisualizerPreset[] = visualizerStore.presets.length
    ? [...visualizerStore.presets]
    : ['particles', 'kaleidoscope', 'warehouse', 'nebel', 'vanta_halo', 'hydra_rave', 'hydra_chromaflow']

  return presets.map((preset) => ({
    title: visualizerPresetLabels[preset] ?? preset,
    value: preset,
  }))
})

const hydraQualityItems = computed(() => {
  const qualities: HydraQuality[] = visualizerStore.hydraQualities.length
    ? [...visualizerStore.hydraQualities]
    : ['low', 'medium', 'high']

  return qualities.map((quality) => ({
    title: hydraQualityLabels[quality] ?? quality,
    value: quality,
  }))
})

const hydraPaletteModeItems = computed(() => {
  const modes: HydraPaletteMode[] = visualizerStore.hydraPaletteModes.length
    ? [...visualizerStore.hydraPaletteModes]
    : ['auto', 'neon', 'warm', 'cold', 'acid']

  return modes.map((mode) => ({
    title: hydraPaletteModeLabels[mode] ?? mode,
    value: mode,
  }))
})

const isHydraChromaflowPreset = computed(
  () => visualizerDraft.active_preset === 'hydra_chromaflow',
)

function clampAutoCycleMinutes(value: number) {
  return Math.max(5, Math.min(30, value))
}

const isBlackoutMode = computed(() => activeMode.value === 'blackout')

const isStandbyMode = computed(() => activeMode.value === 'idle')

const isSlideshowMode = computed(() => activeMode.value === 'selfie')

const isVideoMode = computed(() => activeMode.value === 'video')

const isVisualizerMode = computed(() => activeMode.value === 'visualizer')

const orderedVideoAssets = computed(() =>
  [...videoStore.assets].sort((left, right) => left.position - right.position),
)

const videoSizeLimitLabel = computed(() =>
  formatBytes(systemStatusStore.videoUploadMaxBytes),
)

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
    : systemStatusStore.fanActive === true
      ? systemStatusStore.fanRpm != null && systemStatusStore.fanRpm > 0
        ? `Lüfter läuft · ${systemStatusStore.fanRpm} RPM`
        : 'Lüfter läuft'
      : systemStatusStore.fanActive === false
        ? 'Lüfter aktuell aus'
        : 'Temperaturdaten vom Gerät · Lüfterstatus unbekannt',
)

const temperatureHintClass = computed(() => {
  if (systemStatusStore.cpuTemperatureCelsius == null) {
    return 'device-metric-card__meta--fan-unknown'
  }
  if (systemStatusStore.fanActive === true) {
    return 'device-metric-card__meta--fan-running'
  }
  if (systemStatusStore.fanActive === false) {
    return 'device-metric-card__meta--fan-off'
  }
  return 'device-metric-card__meta--fan-unknown'
})

const internetStatusLabel = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? 'Setup-Modus aktiv'
    : systemStatusStore.networkStatus.online
      ? 'Online'
      : 'Offline',
)

const internetStatusHint = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? 'Mit dem Setup-WLAN verbinden, um das Event-Netzwerk auszuwählen.'
    : systemStatusStore.networkStatus.online
      ? 'Externe Verbindung verfügbar'
      : 'Keine externe Verbindung erkannt',
)

const internetStatusClass = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? 'device-metric-card__value--warning'
    : systemStatusStore.networkStatus.online
      ? 'device-metric-card__value--online'
      : 'device-metric-card__value--offline',
)

const internetSsidLabel = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? systemStatusStore.setupModeStatus.ssid
    : systemStatusStore.networkStatus.ssid || 'Nicht verbunden',
)

const internetIpLabel = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? systemStatusStore.setupModeStatus.ip
    : systemStatusStore.networkStatus.ip || 'Nicht verfügbar',
)

const internetSignalLabel = computed(() => {
  if (systemStatusStore.setupModeStatus.enabled || systemStatusStore.networkStatus.signal_percent == null) {
    return 'Nicht verfügbar'
  }
  return `${renderSignalGlyph(systemStatusStore.networkStatus.signal_bars)} ${systemStatusStore.networkStatus.signal_percent}%`
})

const setupModeActionLabel = computed(() =>
  systemStatusStore.setupModeStatus.enabled ? 'Setup-Modus beenden' : 'Setup-Modus starten',
)

const guestUploadUrl = computed(() => publicRuntimeStore.urls.guest_upload_url)

onMounted(async () => {
  if (!authStore.token) {
    isBooting.value = false
    return
  }

  try {
    const adminToken = authStore.token
    const [latestUploads] = await Promise.all([
      fetchAdminUploads(adminToken, adminUploadFetchLimit),
      appModeStore.refresh(),
      publicRuntimeStore.refresh(),
      selfieStore.refresh(),
      standbyStore.refresh(),
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
      syncStandbyDraftFromStore(),
      syncVideoDraftFromStore(),
      syncRemoteVisualizerDraftFromStore(),
      syncRemoteRendererDraftFromStore(),
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
  if (standbyPersistTimer) {
    window.clearTimeout(standbyPersistTimer)
  }
  if (videoPersistTimer) {
    window.clearTimeout(videoPersistTimer)
  }
  if (remoteVisualizerPersistTimer) {
    window.clearTimeout(remoteVisualizerPersistTimer)
  }
  if (remoteRendererPersistTimer) {
    window.clearTimeout(remoteRendererPersistTimer)
  }
  if (systemActionNoticeTimer) {
    window.clearTimeout(systemActionNoticeTimer)
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
    visualizerDraft.hydra_colorfulness,
    visualizerDraft.hydra_scene_change_rate,
    visualizerDraft.hydra_symmetry_amount,
    visualizerDraft.hydra_feedback_amount,
    visualizerDraft.hydra_quality,
    visualizerDraft.hydra_audio_reactivity_enabled,
    visualizerDraft.hydra_palette_mode,
    visualizerDraft.overlay_mode,
    visualizerDraft.auto_cycle_enabled,
    visualizerDraft.auto_cycle_interval_minutes,
  ],
  () => {
    if (!isHydratingVisualizerDraft.value) {
      scheduleVisualizerPersist()
    }
  },
)

watch(
  activeWorkspaceSection,
  (section) => {
    if (section === 'uploads') {
      const unseenIds = adminUploadsBadgeStore.consumeUnseenUploadIds()
      if (unseenIds.length) {
        sessionNewUploadIds.value = Array.from(new Set([...unseenIds, ...sessionNewUploadIds.value]))
      }
      return
    }
    sessionNewUploadIds.value = []
  },
  { immediate: true },
)

watch(
  () => [
    standbyDraft.headline,
    standbyDraft.subheadline,
    standbyDraft.hue_shift_degrees,
  ],
  () => {
    if (!isHydratingStandbyDraft.value) {
      scheduleStandbyPersist()
    }
  },
)

watch(
  () => [
    selfieDraft.slideshow_enabled,
    selfieDraft.slideshow_interval_seconds,
    selfieDraft.slideshow_max_visible_photos,
    selfieDraft.slideshow_min_uploads_to_start,
    selfieDraft.slideshow_shuffle,
    selfieDraft.overlay_mode,
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
    videoDraft.overlay_mode,
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

watch(
  () => [
    remoteVisualizerDraft.remote_visualizer_enabled,
    remoteVisualizerDraft.remote_visualizer_url,
    remoteVisualizerDraft.remote_visualizer_reconnect_ms,
    remoteVisualizerDraft.remote_visualizer_fallback,
  ],
  () => {
    if (!isHydratingRemoteVisualizerDraft.value) {
      scheduleRemoteVisualizerPersist()
    }
  },
)

watch(
  () => [
    remoteRendererDraft.display_render_mode,
    remoteRendererDraft.remote_renderer_base_url,
    remoteRendererDraft.remote_renderer_output_path,
    remoteRendererDraft.remote_renderer_health_url,
    remoteRendererDraft.remote_renderer_reconnect_ms,
    remoteRendererDraft.remote_renderer_fallback,
  ],
  () => {
    if (!isHydratingRemoteRendererDraft.value) {
      scheduleRemoteRendererPersist()
    }
  },
)

async function switchMode(mode: AppMode) {
  if (isSwitchingMode.value || mode === activeMode.value) {
    return
  }

  errorMessage.value = ''
  optimisticMode.value = mode
  isSwitchingMode.value = true
  try {
    await appModeStore.setMode(mode)
    await refreshSystemOnly()
  } catch (error) {
    optimisticMode.value = null
    errorMessage.value = error instanceof Error ? error.message : 'Moduswechsel fehlgeschlagen'
  } finally {
    optimisticMode.value = null
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
  visualizerDraft.hydra_colorfulness = visualizerStore.hydraColorfulness
  visualizerDraft.hydra_scene_change_rate = visualizerStore.hydraSceneChangeRate
  visualizerDraft.hydra_symmetry_amount = visualizerStore.hydraSymmetryAmount
  visualizerDraft.hydra_feedback_amount = visualizerStore.hydraFeedbackAmount
  visualizerDraft.hydra_quality = visualizerStore.hydraQuality
  visualizerDraft.hydra_audio_reactivity_enabled = visualizerStore.hydraAudioReactivityEnabled
  visualizerDraft.hydra_palette_mode = visualizerStore.hydraPaletteMode
  visualizerDraft.overlay_mode = visualizerStore.overlayMode
  visualizerDraft.auto_cycle_enabled = visualizerStore.autoCycleEnabled
  visualizerDraft.auto_cycle_interval_minutes = clampAutoCycleMinutes(
    Math.round(visualizerStore.autoCycleIntervalSeconds / 60),
  )
  await nextTick()
  isHydratingVisualizerDraft.value = false
}

async function syncSelfieDraftFromStore() {
  isHydratingSelfieDraft.value = true
  selfieDraft.slideshow_enabled = selfieStore.slideshowEnabled
  selfieDraft.slideshow_interval_seconds = selfieStore.slideshowIntervalSeconds
  selfieDraft.slideshow_max_visible_photos = selfieStore.slideshowMaxVisiblePhotos
  selfieDraft.slideshow_min_uploads_to_start = clampSlideshowUploadThreshold(
    selfieStore.slideshowMinUploadsToStart,
  )
  selfieDraft.slideshow_shuffle = selfieStore.slideshowShuffle
  selfieDraft.overlay_mode = selfieStore.overlayMode
  selfieDraft.vintage_look_enabled = selfieStore.vintageLookEnabled
  selfieDraft.moderation_mode = selfieStore.moderationMode
  await nextTick()
  isHydratingSelfieDraft.value = false
}

async function syncStandbyDraftFromStore() {
  isHydratingStandbyDraft.value = true
  standbyDraft.headline = standbyStore.headline
  standbyDraft.subheadline = standbyStore.subheadline
  standbyDraft.hue_shift_degrees = standbyStore.hueShiftDegrees
  await nextTick()
  isHydratingStandbyDraft.value = false
}

async function syncVideoDraftFromStore() {
  isHydratingVideoDraft.value = true
  videoDraft.playlist_enabled = videoStore.playlistEnabled
  videoDraft.loop_enabled = videoStore.loopEnabled
  videoDraft.playback_order = videoStore.playbackOrder
  videoDraft.vintage_filter_enabled = videoStore.vintageFilterEnabled
  videoDraft.overlay_mode = videoStore.overlayMode
  videoDraft.object_fit = videoStore.objectFit
  videoDraft.transition = videoStore.transition
  videoDraft.active_video_id = videoStore.activeVideoId
  await nextTick()
  isHydratingVideoDraft.value = false
}

async function syncRemoteVisualizerDraftFromStore() {
  isHydratingRemoteVisualizerDraft.value = true
  remoteVisualizerDraft.remote_visualizer_enabled = publicRuntimeStore.remoteVisualizerEnabled
  remoteVisualizerDraft.remote_visualizer_url = publicRuntimeStore.remoteVisualizerUrl
  remoteVisualizerDraft.remote_visualizer_reconnect_ms = publicRuntimeStore.remoteVisualizerReconnectMs
  remoteVisualizerDraft.remote_visualizer_fallback = publicRuntimeStore.remoteVisualizerFallback
  await nextTick()
  isHydratingRemoteVisualizerDraft.value = false
}

async function syncRemoteRendererDraftFromStore() {
  isHydratingRemoteRendererDraft.value = true
  remoteRendererDraft.display_render_mode = publicRuntimeStore.displayRenderMode
  remoteRendererDraft.remote_renderer_base_url = publicRuntimeStore.remoteRendererBaseUrl
  remoteRendererDraft.remote_renderer_output_path = publicRuntimeStore.remoteRendererOutputPath
  remoteRendererDraft.remote_renderer_health_url = publicRuntimeStore.remoteRendererHealthUrl
  remoteRendererDraft.remote_renderer_reconnect_ms = publicRuntimeStore.remoteRendererReconnectMs
  remoteRendererDraft.remote_renderer_fallback = publicRuntimeStore.remoteRendererFallback
  await nextTick()
  isHydratingRemoteRendererDraft.value = false
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

function scheduleStandbyPersist() {
  if (standbyPersistTimer) {
    window.clearTimeout(standbyPersistTimer)
  }

  standbyPersistTimer = window.setTimeout(() => {
    void saveStandbyDraft()
  }, 200)
}

function scheduleVideoPersist() {
  if (videoPersistTimer) {
    window.clearTimeout(videoPersistTimer)
  }

  videoPersistTimer = window.setTimeout(() => {
    void saveVideoDraft()
  }, 180)
}

function scheduleRemoteVisualizerPersist() {
  if (remoteVisualizerPersistTimer) {
    window.clearTimeout(remoteVisualizerPersistTimer)
  }

  remoteVisualizerPersistTimer = window.setTimeout(() => {
    void saveRemoteVisualizerDraft()
  }, 260)
}

function scheduleRemoteRendererPersist() {
  if (remoteRendererPersistTimer) {
    window.clearTimeout(remoteRendererPersistTimer)
  }

  remoteRendererPersistTimer = window.setTimeout(() => {
    void saveRemoteRendererDraft()
  }, 260)
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
      hydra_colorfulness: visualizerDraft.hydra_colorfulness,
      hydra_scene_change_rate: visualizerDraft.hydra_scene_change_rate,
      hydra_symmetry_amount: visualizerDraft.hydra_symmetry_amount,
      hydra_feedback_amount: visualizerDraft.hydra_feedback_amount,
      hydra_quality: visualizerDraft.hydra_quality,
      hydra_audio_reactivity_enabled: visualizerDraft.hydra_audio_reactivity_enabled,
      hydra_palette_mode: visualizerDraft.hydra_palette_mode,
      overlay_mode: visualizerDraft.overlay_mode,
      auto_cycle_enabled: visualizerDraft.auto_cycle_enabled,
      auto_cycle_interval_seconds: visualizerDraft.auto_cycle_interval_minutes * 60,
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
      slideshow_min_uploads_to_start: clampSlideshowUploadThreshold(
        selfieDraft.slideshow_min_uploads_to_start,
      ),
      slideshow_shuffle: selfieDraft.slideshow_shuffle,
      overlay_mode: selfieDraft.overlay_mode,
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

async function saveStandbyDraft() {
  standbyError.value = ''
  isSavingStandby.value = true
  try {
    await standbyStore.save({
      headline: standbyDraft.headline,
      subheadline: standbyDraft.subheadline,
      hue_shift_degrees: standbyDraft.hue_shift_degrees,
    })
    await refreshSystemOnly()
  } catch (error) {
    standbyError.value =
      error instanceof Error ? error.message : 'Standby-Texte konnten nicht gespeichert werden'
  } finally {
    isSavingStandby.value = false
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
      overlay_mode: videoDraft.overlay_mode,
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

async function saveRemoteVisualizerDraft() {
  remoteVisualizerError.value = ''
  isSavingRemoteVisualizer.value = true
  try {
    const reconnectMs = Number.isFinite(remoteVisualizerDraft.remote_visualizer_reconnect_ms)
      ? Math.round(remoteVisualizerDraft.remote_visualizer_reconnect_ms)
      : 3000
    remoteVisualizerDraft.remote_visualizer_reconnect_ms = reconnectMs
    remoteVisualizerDraft.remote_visualizer_url = remoteVisualizerDraft.remote_visualizer_url.trim()
    await publicRuntimeStore.saveRuntimeConfig(buildRuntimeConfigPayload())
    await refreshSystemOnly()
  } catch (error) {
    remoteVisualizerError.value =
      error instanceof Error ? error.message : 'Remote-Visualizer konnte nicht gespeichert werden'
  } finally {
    isSavingRemoteVisualizer.value = false
  }
}

async function saveRemoteRendererDraft() {
  remoteRendererError.value = ''
  isSavingRemoteRenderer.value = true
  try {
    const reconnectMs = Number.isFinite(remoteRendererDraft.remote_renderer_reconnect_ms)
      ? Math.round(remoteRendererDraft.remote_renderer_reconnect_ms)
      : 3000
    remoteRendererDraft.remote_renderer_reconnect_ms = reconnectMs
    remoteRendererDraft.remote_renderer_base_url = remoteRendererDraft.remote_renderer_base_url.trim()
    remoteRendererDraft.remote_renderer_output_path = normalizeRuntimePath(
      remoteRendererDraft.remote_renderer_output_path,
      '/preview',
    )
    remoteRendererDraft.remote_renderer_health_url = remoteRendererDraft.remote_renderer_health_url.trim()
    await publicRuntimeStore.saveRuntimeConfig(buildRuntimeConfigPayload())
    await refreshSystemOnly()
  } catch (error) {
    remoteRendererError.value =
      error instanceof Error ? error.message : 'Remote-Renderer konnte nicht gespeichert werden'
  } finally {
    isSavingRemoteRenderer.value = false
  }
}

function buildRuntimeConfigPayload() {
  return {
    remote_visualizer_enabled: remoteVisualizerDraft.remote_visualizer_enabled,
    remote_visualizer_url: remoteVisualizerDraft.remote_visualizer_url.trim(),
    remote_visualizer_reconnect_ms: Number.isFinite(remoteVisualizerDraft.remote_visualizer_reconnect_ms)
      ? Math.round(remoteVisualizerDraft.remote_visualizer_reconnect_ms)
      : 3000,
    remote_visualizer_fallback: remoteVisualizerDraft.remote_visualizer_fallback,
    display_render_mode: remoteRendererDraft.display_render_mode,
    remote_renderer_base_url: remoteRendererDraft.remote_renderer_base_url.trim(),
    remote_renderer_output_path: normalizeRuntimePath(remoteRendererDraft.remote_renderer_output_path, '/preview'),
    remote_renderer_health_url: remoteRendererDraft.remote_renderer_health_url.trim(),
    remote_renderer_reconnect_ms: Number.isFinite(remoteRendererDraft.remote_renderer_reconnect_ms)
      ? Math.round(remoteRendererDraft.remote_renderer_reconnect_ms)
      : 3000,
    remote_renderer_fallback: remoteRendererDraft.remote_renderer_fallback,
  }
}

function normalizeRuntimePath(value: string, fallback: string) {
  const normalized = value.trim() || fallback
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function renderSignalGlyph(bars: number) {
  const normalized = Math.max(0, Math.min(bars, 5))
  return `${'█'.repeat(normalized)}${'░'.repeat(5 - normalized)}`
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
  uploads.value = await fetchAdminUploads(authStore.token, adminUploadFetchLimit)
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
  clearSystemActionNotice()
  isShuttingDown.value = true

  try {
    await triggerSystemShutdown(authStore.token)
    showSystemActionNotice(
      'Ausschalten läuft',
      'Der Raspberry Pi fährt jetzt herunter.',
      'mdi-power',
    )
  } catch (error) {
    systemActionError.value =
      error instanceof Error ? error.message : 'Ausschalten konnte nicht ausgelöst werden'
  } finally {
    isShuttingDown.value = false
  }
}

async function restartSystem() {
  if (!authStore.token || isRestartingSystem.value) {
    return
  }

  systemActionError.value = ''
  clearSystemActionNotice()
  isRestartingSystem.value = true

  try {
    await triggerSystemRestart(authStore.token)
    showSystemActionNotice(
      'Neustart läuft',
      'Der Raspberry Pi startet jetzt neu.',
      'mdi-restart',
    )
  } catch (error) {
    systemActionError.value =
      error instanceof Error ? error.message : 'Neustart konnte nicht ausgelöst werden'
  } finally {
    isRestartingSystem.value = false
  }
}

async function toggleSetupMode() {
  if (!authStore.token || isTogglingSetupMode.value) {
    return
  }

  systemActionError.value = ''
  clearSystemActionNotice()
  isTogglingSetupMode.value = true

  try {
    const enablingSetupMode = !systemStatusStore.setupModeStatus.enabled
    const response = systemStatusStore.setupModeStatus.enabled
      ? await stopSetupMode(authStore.token)
      : await startSetupMode(authStore.token)
    showSystemActionNotice(
      enablingSetupMode ? 'Setup-Modus aktiv' : 'Setup-Modus beendet',
      response.message,
      enablingSetupMode ? 'mdi-wifi-cog' : 'mdi-wifi-off',
    )
    await refreshSystemOnly()
  } catch (error) {
    systemActionError.value =
      error instanceof Error ? error.message : 'Setup-Modus konnte nicht umgeschaltet werden'
  } finally {
    isTogglingSetupMode.value = false
  }
}

function openGuestQrDialog() {
  isGuestQrDialogOpen.value = true
}

function clearSystemActionNotice() {
  if (systemActionNoticeTimer) {
    window.clearTimeout(systemActionNoticeTimer)
    systemActionNoticeTimer = undefined
  }
  systemActionNotice.value = null
}

function showSystemActionNotice(title: string, text: string, icon: string) {
  clearSystemActionNotice()
  systemActionNotice.value = { title, text, icon }
  systemActionNoticeTimer = window.setTimeout(() => {
    systemActionNotice.value = null
    systemActionNoticeTimer = undefined
  }, 4200)
}

async function copyGuestUploadUrl() {
  if (!guestUploadUrl.value) {
    return
  }

  try {
    await navigator.clipboard.writeText(guestUploadUrl.value)
  } catch {
    // Keep the dialog quiet if clipboard access is unavailable.
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

async function fetchAllUploadsForBulkAction() {
  if (!authStore.token) {
    return []
  }

  const latestUploads = await fetchAdminUploads(authStore.token, adminUploadFetchLimit)
  uploads.value = latestUploads
  await loadAdminThumbnails(latestUploads)
  return latestUploads
}

async function downloadAllUploadArchive() {
  if (!authStore.token || !canManageAllUploads.value || isDownloadingUploadArchive.value || isDeletingAllUploads.value) {
    return
  }

  uploadError.value = ''
  isUploadBulkMenuOpen.value = false
  isDownloadingUploadArchive.value = true

  try {
    const allUploads = await fetchAllUploadsForBulkAction()
    if (!allUploads.length) {
      return
    }

    const archive = await downloadAdminUploadArchive(
      allUploads.map((upload) => upload.id),
      authStore.token,
    )
    triggerBlobDownload(archive, buildUploadArchiveFilename('all'))
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Download fehlgeschlagen'
  } finally {
    isDownloadingUploadArchive.value = false
  }
}

function openDeleteAllUploadsDialog() {
  if (!canManageAllUploads.value || isDeletingAllUploads.value || isDownloadingUploadArchive.value) {
    return
  }

  isUploadBulkMenuOpen.value = false
  isDeleteAllUploadsDialogOpen.value = true
}

async function deleteAllUploads() {
  if (!authStore.token || isDeletingAllUploads.value || isDownloadingUploadArchive.value) {
    return
  }

  uploadError.value = ''
  isDeletingAllUploads.value = true

  try {
    const allUploads = await fetchAllUploadsForBulkAction()
    for (const upload of allUploads) {
      await deleteUpload(upload.id, authStore.token)
    }
    isDeleteAllUploadsDialogOpen.value = false
    await refreshOperationalState()
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Löschen fehlgeschlagen'
  } finally {
    isDeletingAllUploads.value = false
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
      : ['particles', 'kaleidoscope', 'warehouse', 'nebel', 'vanta_halo', 'hydra_rave', 'hydra_chromaflow']
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

async function cycleVisualizerOverlayModeQuick(actionKey = 'visualizer:overlay-mode') {
  const key = actionKey
  setBusy(key, true)
  try {
    if (visualizerPersistTimer) {
      window.clearTimeout(visualizerPersistTimer)
    }
    isHydratingVisualizerDraft.value = true
    visualizerDraft.overlay_mode = nextOverlayMode(visualizerDraft.overlay_mode)
    await nextTick()
    isHydratingVisualizerDraft.value = false
    await saveVisualizerDraft()
  } finally {
    setBusy(key, false)
  }
}

async function cycleSelfieOverlayModeQuick() {
  const key = 'selfie:overlay-mode'
  setBusy(key, true)
  try {
    if (selfiePersistTimer) {
      window.clearTimeout(selfiePersistTimer)
    }
    isHydratingSelfieDraft.value = true
    selfieDraft.overlay_mode = nextOverlayMode(selfieDraft.overlay_mode)
    await nextTick()
    isHydratingSelfieDraft.value = false
    await saveSelfieDraft()
  } finally {
    setBusy(key, false)
  }
}

async function cycleVideoOverlayModeQuick() {
  const key = 'video:overlay-mode'
  setBusy(key, true)
  try {
    if (videoPersistTimer) {
      window.clearTimeout(videoPersistTimer)
    }
    isHydratingVideoDraft.value = true
    videoDraft.overlay_mode = nextOverlayMode(videoDraft.overlay_mode)
    await nextTick()
    isHydratingVideoDraft.value = false
    await saveVideoDraft()
  } finally {
    setBusy(key, false)
  }
}

async function runHeaderAction(actionId: string) {
  if (actionId === 'selfie:moderation') {
    const key = 'selfie:moderation'
    setBusy(key, true)
    try {
      toggleSelfieModerationMode()
      await saveSelfieDraft()
    } finally {
      setBusy(key, false)
    }
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
  if (actionId === 'selfie:overlay-mode') {
    await cycleSelfieOverlayModeQuick()
    return
  }
  if (actionId === 'selfie:guest-qr') {
    openGuestQrDialog()
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
  if (actionId === 'visualizer:overlay-mode') {
    await cycleVisualizerOverlayModeQuick()
    return
  }
  if (actionId === 'video:vintage') {
    toggleVideoVintageFilter()
    return
  }
  if (actionId === 'video:transition') {
    toggleVideoTransition()
    return
  }
  if (actionId === 'video:overlay-mode') {
    await cycleVideoOverlayModeQuick()
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

  source.addEventListener('public_runtime_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('public_runtime_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    publicRuntimeStore.applyRuntimeInfo(payload)
    await syncRemoteVisualizerDraftFromStore()
    await syncRemoteRendererDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('public_runtime_updated', async (event) => {
    pushRecentEvent('public_runtime_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    publicRuntimeStore.applyRuntimeInfo(payload)
    await syncRemoteVisualizerDraftFromStore()
    await syncRemoteRendererDraftFromStore()
    await refreshSystemOnly()
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

  source.addEventListener('standby_snapshot', async (event) => {
    dashboardLiveActive.value = true
    pushRecentEvent('standby_snapshot')
    const payload = parseEventPayload(event)
    if (!payload) return
    standbyStore.applyState(payload)
    await syncStandbyDraftFromStore()
    await refreshSystemOnly()
  })

  source.addEventListener('standby_settings_updated', async (event) => {
    pushRecentEvent('standby_settings_updated')
    const payload = parseEventPayload(event)
    if (!payload) return
    standbyStore.applyState(payload)
    await syncStandbyDraftFromStore()
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

  source.addEventListener('upload_created', (event) => {
    pushRecentEvent('upload_created')
    const payload = parseEventPayload(event) as { id?: unknown } | null
    const uploadId = typeof payload?.id === 'number' ? payload.id : null
    if (activeWorkspaceSection.value !== 'uploads') {
      if (uploadId != null) {
        adminUploadsBadgeStore.markNewUpload(uploadId)
      }
    } else {
      if (uploadId != null && !sessionNewUploadIds.value.includes(uploadId)) {
        sessionNewUploadIds.value = [uploadId, ...sessionNewUploadIds.value]
      }
    }
    void refreshOperationalState()
  })

  source.addEventListener('upload_deleted', (event) => {
    pushRecentEvent('upload_deleted')
    const payload = parseEventPayload(event) as { id?: unknown } | null
    const uploadId = typeof payload?.id === 'number' ? payload.id : null
    if (uploadId != null) {
      adminUploadsBadgeStore.removeUpload(uploadId)
      sessionNewUploadIds.value = sessionNewUploadIds.value.filter((id) => id !== uploadId)
    }
    void refreshOperationalState()
  })

  for (const eventName of [
    'upload_approved',
    'upload_rejected',
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

function isNewUpload(upload: UploadItem) {
  return sessionNewUploadIds.value.includes(upload.id)
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

function moderationActionCount(upload: UploadItem) {
  let count = 0
  if (canApprove(upload)) count += 1
  if (canReject(upload)) count += 1
  return count
}

function toggleSelfieModerationMode() {
  selfieDraft.moderation_mode =
    selfieDraft.moderation_mode === 'auto_approve' ? 'manual_approve' : 'auto_approve'
}

function toggleVideoVintageFilter() {
  videoDraft.vintage_filter_enabled = !videoDraft.vintage_filter_enabled
}

function toggleVideoTransition() {
  videoDraft.transition = videoDraft.transition === 'fade' ? 'none' : 'fade'
}

function formatModerationStatusLabel(status: UploadItem['moderation_status']) {
  if (status === 'pending') return 'Ausstehend'
  if (status === 'approved') return 'Genehmigt'
  return 'Abgelehnt'
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

function clampSlideshowUploadThreshold(value: number) {
  return Math.min(10, Math.max(1, Math.round(value)))
}

function formatUploadThreshold(value: number) {
  const threshold = clampSlideshowUploadThreshold(value)
  return threshold === 1 ? '1 Upload' : `${threshold} Uploads`
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

function nextOverlayMode(current: OverlayMode): OverlayMode {
  if (current === 'logo') return 'qr'
  if (current === 'qr') return 'off'
  return 'logo'
}

function overlayModeLabel(mode: OverlayMode) {
  if (mode === 'logo') return 'Overlay: Logo'
  if (mode === 'qr') return 'Overlay: QR-Code'
  return 'Overlay: Aus'
}
</script>

<template>
  <section class="admin-workspace-shell">
    <Transition name="admin-system-banner">
      <div
        v-if="systemActionNotice"
        class="admin-system-banner-wrap"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="admin-system-banner" role="status">
          <div class="admin-system-banner__icon">
            <v-icon :icon="systemActionNotice.icon" size="20" />
          </div>
          <div class="admin-system-banner__copy">
            <div class="admin-system-banner__title">{{ systemActionNotice.title }}</div>
            <div class="admin-system-banner__text">{{ systemActionNotice.text }}</div>
          </div>
        </div>
      </div>
    </Transition>

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
              :current-mode="activeMode"
              :mode-options="modeButtons"
              :context-actions="contextActions"
              :is-booting="isBooting"
              :is-switching-mode="isSwitchingMode"
              @switch-mode="switchMode"
              @run-action="runHeaderAction"
            />
          </v-col>

          <v-col cols="12">
            <div class="mode-panel-stage">
              <v-expand-transition>
                <section v-show="isBlackoutMode" class="settings-section">
              <div class="settings-group">
                <div class="settings-explainer">
                  <div class="settings-explainer__icon-shell" aria-hidden="true">
                    <v-icon
                      icon="mdi-lightbulb-off-outline"
                      size="20"
                      class="settings-explainer__icon"
                    />
                  </div>
                  <div class="settings-explainer__copy inline-note settings-copy">
                    Der Bildschirm ist derzeit komplett abgeschaltet. Einstellungen für Slideshow und
                    Visualizer stehen wieder zur Verfügung, sobald du in einen dieser Modi wechselst.
                  </div>
                </div>
              </div>
                </section>
              </v-expand-transition>

              <v-expand-transition>
                <section v-show="isStandbyMode" class="settings-section">
              <div class="settings-group">
                <div class="settings-control">
                  <div class="settings-control__label">Headline</div>
                  <v-text-field
                    v-model="standbyDraft.headline"
                    class="admin-text-input"
                    :disabled="isBooting || isSavingStandby"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>

                <div class="settings-control">
                  <div class="settings-control__label">Subline</div>
                  <v-text-field
                    v-model="standbyDraft.subheadline"
                    class="admin-text-input"
                    :disabled="isBooting || isSavingStandby"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>

                <div class="settings-slider-row settings-slider-row--wide settings-slider-row--spaced">
                  <div class="settings-slider-row__header">
                    <div class="settings-slider-row__label">Farbton</div>
                    <div class="settings-slider-row__value">{{ standbyDraft.hue_shift_degrees }}°</div>
                  </div>
                  <v-slider
                    v-model="standbyDraft.hue_shift_degrees"
                    min="-180"
                    max="180"
                    step="1"
                    hide-details
                  />
                </div>
              </div>
              <v-alert v-if="standbyError" type="error" variant="tonal" class="mt-4">
                {{ standbyError }}
              </v-alert>
                </section>
              </v-expand-transition>

              <v-expand-transition>
                <section v-show="isVideoMode" class="settings-section">
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
                <div v-if="!videoDraft.playlist_enabled" class="inline-note">
                  Wenn die Playlist deaktiviert ist, wird das oben markierte Einzelvideo abgespielt.
                </div>
              </div>

              <div class="settings-divider" />

              <div class="settings-group">
                <div class="settings-group__label">Darstellung</div>
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
              </div>

              <v-alert v-if="videoError" type="error" variant="tonal" class="mt-4">
                {{ videoError }}
              </v-alert>
                </section>
              </v-expand-transition>

              <v-expand-transition>
                <section v-show="isSlideshowMode" class="settings-section">
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
                <div class="settings-slider-row settings-slider-row--wide">
                  <div class="settings-slider-row__header">
                    <div class="settings-slider-row__label">Slideshow startet nach</div>
                    <div class="settings-slider-row__value">
                      {{ formatUploadThreshold(selfieDraft.slideshow_min_uploads_to_start) }}
                    </div>
                  </div>
                  <v-slider
                    v-model="selfieDraft.slideshow_min_uploads_to_start"
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
              </v-expand-transition>

              <v-expand-transition>
                <section v-show="isVisualizerMode" class="settings-section">
              <div class="settings-section__header">
                <div class="settings-section__label">Visualizer</div>
              </div>
              <div class="settings-group settings-group--spaced">
                <div class="settings-control">
                  <div class="settings-control__label">Stil</div>
                  <v-select
                    v-model="visualizerDraft.active_preset"
                    class="admin-select"
                    :items="visualizerPresetItems"
                    :disabled="isBooting"
                    item-title="title"
                    item-value="value"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>
              </div>

              <div class="settings-group">
                <div v-if="!isHydraChromaflowPreset" class="settings-control">
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
                <template v-else>
                  <div class="settings-control">
                    <div class="settings-control__label">Palette</div>
                    <v-select
                      v-model="visualizerDraft.hydra_palette_mode"
                      class="admin-select"
                      :items="hydraPaletteModeItems"
                      :disabled="isBooting"
                      item-title="title"
                      item-value="value"
                      hide-details
                      variant="solo"
                      density="comfortable"
                    />
                  </div>
                  <div class="settings-control settings-control--spaced">
                    <div class="settings-control__label">Qualität</div>
                    <v-select
                      v-model="visualizerDraft.hydra_quality"
                      class="admin-select"
                      :items="hydraQualityItems"
                      :disabled="isBooting"
                      item-title="title"
                      item-value="value"
                      hide-details
                      variant="solo"
                      density="comfortable"
                    />
                  </div>
                  <div class="settings-control settings-control--spaced">
                    <div class="settings-control__label">Audio-Reaktivität</div>
                    <v-switch
                      v-model="visualizerDraft.hydra_audio_reactivity_enabled"
                      color="primary"
                      hide-details
                      inset
                    />
                  </div>
                </template>
              </div>

              <div class="settings-divider" />

              <div class="settings-group settings-group--sliders">
                <v-expand-transition>
                  <div
                    v-if="visualizerDraft.auto_cycle_enabled"
                    class="settings-slider-row settings-slider-row--wide"
                  >
                    <div class="settings-slider-row__header">
                      <div class="settings-slider-row__label">Presetwechsel alle</div>
                      <div class="settings-slider-row__value">{{ visualizerDraft.auto_cycle_interval_minutes }} min</div>
                    </div>
                    <v-slider
                      v-model="visualizerDraft.auto_cycle_interval_minutes"
                      min="5"
                      max="30"
                      step="1"
                      hide-details
                    />
                  </div>
                </v-expand-transition>
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
            <template v-if="isHydraChromaflowPreset">
              <div class="settings-slider-row">
                <div class="settings-slider-row__header">
                  <div class="settings-slider-row__label">Colorfulness</div>
                  <div class="settings-slider-row__value">{{ visualizerDraft.hydra_colorfulness }}</div>
                </div>
                <v-slider
                  v-model="visualizerDraft.hydra_colorfulness"
                  min="0"
                  max="100"
                  step="1"
                  hide-details
                />
              </div>
              <div class="settings-slider-row">
                <div class="settings-slider-row__header">
                  <div class="settings-slider-row__label">Scene Change Rate</div>
                  <div class="settings-slider-row__value">{{ visualizerDraft.hydra_scene_change_rate }}</div>
                </div>
                <v-slider
                  v-model="visualizerDraft.hydra_scene_change_rate"
                  min="0"
                  max="100"
                  step="1"
                  hide-details
                />
              </div>
              <div class="settings-slider-row">
                <div class="settings-slider-row__header">
                  <div class="settings-slider-row__label">Symmetry Amount</div>
                  <div class="settings-slider-row__value">{{ visualizerDraft.hydra_symmetry_amount }}</div>
                </div>
                <v-slider
                  v-model="visualizerDraft.hydra_symmetry_amount"
                  min="0"
                  max="100"
                  step="1"
                  hide-details
                />
              </div>
              <div class="settings-slider-row">
                <div class="settings-slider-row__header">
                  <div class="settings-slider-row__label">Feedback Amount</div>
                  <div class="settings-slider-row__value">{{ visualizerDraft.hydra_feedback_amount }}</div>
                </div>
                <v-slider
                  v-model="visualizerDraft.hydra_feedback_amount"
                  min="0"
                  max="100"
                  step="1"
                  hide-details
                />
              </div>
            </template>
              </div>
              <v-alert v-if="visualizerError" type="error" variant="tonal" class="mt-4">
                {{ visualizerError }}
              </v-alert>
                </section>
              </v-expand-transition>
            </div>
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
              <div class="device-metric-card__meta" :class="temperatureHintClass">{{ temperatureHint }}</div>
            </article>

            <article class="device-metric-card">
              <div class="device-metric-card__label">Freier Speicher</div>
              <div class="device-metric-card__value">
                {{ formatOptionalBytes(systemStatusStore.appliance.storage.free_bytes) }}
              </div>
              <div class="device-metric-card__meta">Verfügbar auf dem Gerät</div>
            </article>

            <article class="device-metric-card">
              <div class="device-metric-card__label">Internet</div>
              <div class="device-metric-card__value" :class="internetStatusClass">{{ internetStatusLabel }}</div>
              <div class="device-metric-card__meta">{{ internetStatusHint }}</div>
              <div class="device-metric-card__network-detail">
                <span class="device-metric-card__network-key">SSID</span>
                <span class="device-metric-card__network-value">{{ internetSsidLabel }}</span>
              </div>
              <div class="device-metric-card__network-detail">
                <span class="device-metric-card__network-key">IP-Adresse</span>
                <span class="device-metric-card__network-value">{{ internetIpLabel }}</span>
              </div>
              <div class="device-metric-card__network-detail">
                <span class="device-metric-card__network-key">Signal</span>
                <span class="device-metric-card__network-value">{{ internetSignalLabel }}</span>
              </div>
              <div class="device-metric-card__actions">
                <v-btn
                  size="small"
                  variant="text"
                  color="primary"
                  class="device-metric-card__action"
                  prepend-icon="mdi-wifi-cog"
                  :loading="isTogglingSetupMode"
                  @click="toggleSetupMode"
                >
                  {{ setupModeActionLabel }}
                </v-btn>
                <v-btn
                  v-if="systemStatusStore.setupModeStatus.enabled"
                  size="small"
                  variant="text"
                  color="primary"
                  class="device-metric-card__action"
                  prepend-icon="mdi-open-in-new"
                  to="/setup"
                >
                  Setup-Seite
                </v-btn>
              </div>
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

          <article class="device-danger-zone device-danger-zone--restart">
            <div class="device-danger-zone__copy">
              <div class="device-danger-zone__label">Wartungsaktion</div>
              <div class="device-danger-zone__title">Raspberry Pi neu starten</div>
              <div class="device-danger-zone__meta">
                Startet das Gerät neu und stellt den lokalen Event-Betrieb danach erneut her.
              </div>
            </div>
            <v-btn
              color="warning"
              variant="tonal"
              class="device-danger-zone__button device-danger-zone__button--restart"
              prepend-icon="mdi-restart"
              :loading="isRestartingSystem"
              @click="restartSystem"
            >
              Neustarten
            </v-btn>
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
          :class="{ 'workspace-overview-card--active upload-filter-card--active': uploadGalleryFilter === 'new' }"
          variant="flat"
          @click="setUploadGalleryFilter('new')"
        >
          <div class="workspace-overview-label">Neue Uploads</div>
          <div class="workspace-overview-value">
            {{ newUploadCount }}
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" class="upload-gallery-col">
        <section class="upload-gallery-panel">
          <div v-if="uploads.length" class="upload-gallery-header">
            <div class="section-title upload-gallery-header__title">{{ uploadGalleryTitle }}</div>
            <v-menu
              v-model="isUploadBulkMenuOpen"
              location="bottom end"
              offset="8"
            >
              <template #activator="{ props }">
                <v-btn
                  icon="mdi-menu"
                  size="small"
                  variant="text"
                  color="primary"
                  class="upload-gallery-header__action upload-gallery-header__action--menu"
                  :loading="isDownloadingUploadArchive || isDeletingAllUploads"
                  :disabled="!canManageAllUploads"
                  v-bind="props"
                />
              </template>

              <v-list class="upload-bulk-menu" bg-color="surface">
                <v-list-item
                  prepend-icon="mdi-download-box-outline"
                  title="Alle Bilder herunterladen"
                  :disabled="!canManageAllUploads || isDeletingAllUploads || isDownloadingUploadArchive"
                  @click="downloadAllUploadArchive"
                />
                <v-list-item
                  prepend-icon="mdi-delete-sweep-outline"
                  title="Alle Bilder löschen"
                  class="upload-bulk-menu__delete"
                  :disabled="!canManageAllUploads || isDeletingAllUploads || isDownloadingUploadArchive"
                  @click="openDeleteAllUploadsDialog"
                />
              </v-list>
            </v-menu>
          </div>
          <v-alert v-if="uploadError" type="error" variant="tonal" class="mb-4">
            {{ uploadError }}
          </v-alert>

          <TransitionGroup
            v-if="filteredUploadGallery.length"
            name="upload-card-list"
            tag="div"
            class="v-row upload-gallery-grid"
          >
            <v-col v-for="upload in filteredUploadGallery" :key="upload.id" cols="12" sm="6" md="4" xl="3">
              <v-card class="upload-card" variant="flat">
                <div class="upload-card__media">
                  <div v-if="isNewUpload(upload)" class="upload-card__new-badge">
                    Neu
                  </div>
                  <div
                    v-if="upload.moderation_status === 'approved' && upload.status === 'processed'"
                    class="upload-card__stamp upload-card__stamp--approved"
                  >
                    Genehmigt
                  </div>
                  <div
                    v-else-if="upload.moderation_status === 'rejected' && upload.status === 'processed'"
                    class="upload-card__stamp upload-card__stamp--rejected"
                  >
                    Abgelehnt
                  </div>
                  <div class="upload-card__image-wrapper">
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
                </div>
                <div class="upload-card__body">
                  <div class="upload-card__meta-top">
                    <div class="upload-card__timestamp">{{ formatCompactDate(upload.created_at) }}</div>
                    <v-btn
                      size="small"
                      variant="text"
                      class="upload-card__delete-action"
                      prepend-icon="mdi-trash-can-outline"
                      :loading="isBusy(`delete:${upload.id}`)"
                      :disabled="isBusy(`approve:${upload.id}`) || isBusy(`reject:${upload.id}`)"
                      @click="runUploadAction(upload, 'delete')"
                    >
                      Löschen
                    </v-btn>
                  </div>
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
                  <div
                    v-if="showUploadModerationActions && upload.status === 'processed' && moderationActionCount(upload) > 0"
                    class="upload-card__actions-block"
                  >
                    <div
                      class="upload-card__primary-actions"
                      :class="{ 'upload-card__primary-actions--single': moderationActionCount(upload) === 1 }"
                    >
                      <v-btn
                        v-if="canApprove(upload)"
                        size="small"
                        color="success"
                        variant="tonal"
                        class="upload-card__primary-action"
                        :loading="isBusy(`approve:${upload.id}`)"
                        :disabled="!canApprove(upload) || isBusy(`reject:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                        @click="runUploadAction(upload, 'approve')"
                      >
                        {{ approveLabel(upload) }}
                      </v-btn>
                      <v-btn
                        v-if="canReject(upload)"
                        size="small"
                        color="error"
                        variant="tonal"
                        class="upload-card__primary-action"
                        :loading="isBusy(`reject:${upload.id}`)"
                        :disabled="!canReject(upload) || isBusy(`approve:${upload.id}`) || isBusy(`delete:${upload.id}`)"
                        @click="runUploadAction(upload, 'reject')"
                      >
                        Ablehnen
                      </v-btn>
                    </div>
                  </div>
                </div>
              </v-card>
            </v-col>
          </TransitionGroup>

          <div v-else class="upload-empty-state">
            <div class="upload-empty-state__icon-shell" aria-hidden="true">
              <v-icon :icon="uploadEmptyState.icon" size="34" class="upload-empty-state__icon" />
            </div>
            <div class="upload-empty-state__title">{{ uploadEmptyState.title }}</div>
            <div class="upload-empty-state__copy">{{ uploadEmptyState.description }}</div>
          </div>
        </section>
      </v-col>
        </template>
      </v-row>
    </div>

    <v-dialog
      v-model="isDeleteAllUploadsDialogOpen"
      max-width="27.5rem"
      :persistent="isDeletingAllUploads"
      scrim="rgba(2, 6, 12, 0.76)"
      class="upload-bulk-overlay"
      content-class="upload-bulk-dialog__content"
    >
      <v-card class="upload-bulk-dialog" variant="flat">
        <div class="upload-bulk-dialog__label">Uploads</div>
        <div class="upload-bulk-dialog__title">Alle Bilder löschen?</div>
        <div class="upload-bulk-dialog__copy">
          Diese Aktion entfernt alle Uploads dauerhaft aus dem System.
        </div>
        <div class="upload-bulk-dialog__actions">
          <v-btn
            variant="outlined"
            class="upload-bulk-dialog__button upload-bulk-dialog__button--cancel"
            :disabled="isDeletingAllUploads"
            @click="isDeleteAllUploadsDialogOpen = false"
          >
            Abbrechen
          </v-btn>
          <v-btn
            variant="flat"
            class="upload-bulk-dialog__button upload-bulk-dialog__button--confirm"
            prepend-icon="mdi-delete-sweep-outline"
            :loading="isDeletingAllUploads"
            @click="deleteAllUploads"
          >
            Löschen
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isGuestQrDialogOpen"
      max-width="27.5rem"
      scrim="rgba(2, 6, 12, 0.76)"
      class="guest-qr-overlay"
      content-class="guest-qr-dialog__content"
    >
      <v-card class="guest-qr-dialog" variant="flat">
        <div class="guest-qr-dialog__label">Gäste-Upload</div>
        <div class="guest-qr-dialog__title">Link zum Gäste-Upload</div>

        <div class="guest-qr-dialog__body">
          <div v-if="guestUploadUrl" class="guest-qr-dialog__code-shell">
            <div class="guest-qr-dialog__code-card">
              <QrCodeMatrix class="guest-qr-dialog__qr" :text="guestUploadUrl" :quiet-zone="5" />
            </div>
          </div>

          <div v-else class="guest-qr-dialog__empty">
            Die Gäste-Upload-URL ist aktuell nicht verfügbar.
          </div>
        </div>

        <div class="guest-qr-dialog__actions">
          <v-btn
            variant="outlined"
            class="guest-qr-dialog__button guest-qr-dialog__button--cancel"
            :disabled="!guestUploadUrl"
            @click="isGuestQrDialogOpen = false"
          >
            Schließen
          </v-btn>
          <v-btn
            variant="flat"
            class="guest-qr-dialog__button guest-qr-dialog__button--confirm"
            prepend-icon="mdi-content-copy"
            :disabled="!guestUploadUrl"
            @click="copyGuestUploadUrl"
          >
            Link kopieren
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.admin-workspace-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-x: hidden;
}

.admin-system-banner-wrap {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 4.75rem);
  left: 0.75rem;
  right: 0.75rem;
  z-index: 40;
  pointer-events: none;
}

.admin-system-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(138, 226, 177, 0.18);
  background:
    linear-gradient(180deg, rgba(24, 34, 43, 0.92), rgba(12, 18, 24, 0.96)),
    rgba(11, 17, 23, 0.94);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.28),
    0 0 0 1px rgba(154, 235, 193, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}

.admin-system-banner__icon {
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: rgba(166, 244, 199, 0.98);
  background: radial-gradient(circle at 30% 30%, rgba(124, 236, 176, 0.22), rgba(50, 115, 78, 0.12));
}

.admin-system-banner__copy {
  min-width: 0;
}

.admin-system-banner__title {
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(244, 249, 246, 0.96);
}

.admin-system-banner__text {
  margin-top: 0.18rem;
  font-size: 0.855rem;
  line-height: 1.35;
  color: rgba(219, 231, 223, 0.8);
}

.admin-system-banner-enter-active,
.admin-system-banner-leave-active {
  transition:
    opacity 220ms ease,
    transform 240ms cubic-bezier(0.2, 0.76, 0.24, 1);
}

.admin-system-banner-enter-from,
.admin-system-banner-leave-to {
  opacity: 0;
  transform: translateY(-12px);
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

@media (max-width: 700px) {
  .admin-system-banner-wrap {
    top: calc(env(safe-area-inset-top, 0px) + 4.4rem);
    left: 0.625rem;
    right: 0.625rem;
  }
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
  isolation: isolate;
}

.admin-workspace-shell :deep(.v-btn__overlay),
.admin-workspace-shell :deep(.v-ripple__container),
.admin-workspace-shell :deep(.v-selection-control__input::before),
.admin-workspace-shell :deep(.v-selection-control__input::after) {
  display: none !important;
  opacity: 0 !important;
}

.mode-panel-stage {
  width: 100%;
  min-width: 0;
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

.upload-gallery-header__action--menu {
  width: 2.25rem;
  min-width: 2.25rem;
  padding-inline: 0;
  border-radius: 999px;
}

.upload-bulk-menu {
  min-width: 16.5rem;
  padding: 0.35rem;
  border: 1px solid rgba(148, 178, 208, 0.16);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(15, 25, 38, 0.98), rgba(9, 17, 28, 0.98)) !important;
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.upload-bulk-menu :deep(.v-list-item) {
  border-radius: 12px;
  min-height: 2.8rem;
}

.upload-bulk-menu__delete {
  color: rgba(255, 122, 122, 0.96);
}

.upload-bulk-menu__delete:hover {
  background: rgba(255, 92, 92, 0.08);
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
  gap: 0.65rem;
  padding: 1.2rem 0.8rem;
  text-align: center;
}

.upload-empty-state__icon-shell {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(132, 182, 224, 0.12);
  background:
    radial-gradient(circle at top, rgba(101, 198, 255, 0.12), transparent 62%),
    rgba(10, 18, 28, 0.58);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 14px 26px rgba(4, 10, 18, 0.12);
}

.upload-empty-state__icon {
  color: rgba(137, 203, 255, 0.88);
  filter: drop-shadow(0 0 16px rgba(90, 185, 255, 0.22));
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

.device-metric-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.2rem;
}

.device-metric-card__action {
  padding-inline: 0;
  min-height: 2rem;
  text-transform: none;
  letter-spacing: 0.01em;
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

.device-metric-card__value--online {
  color: rgba(133, 227, 173, 0.94);
}

.device-metric-card__value--offline {
  color: rgba(255, 162, 162, 0.94);
}

.device-metric-card__value--warning {
  color: rgba(255, 206, 113, 0.94);
}

.device-metric-card__network-detail {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  margin-top: 0.24rem;
  font-size: 0.82rem;
}

.device-metric-card__network-key {
  color: rgba(194, 211, 228, 0.5);
}

.device-metric-card__network-value {
  color: rgba(239, 245, 251, 0.92);
  font-family: "SFMono-Regular", "Roboto Mono", monospace;
  text-align: right;
}

.device-metric-card__meta,
.device-health-card__meta,
.device-danger-zone__meta {
  color: rgba(201, 214, 228, 0.62);
  font-size: 0.8rem;
  line-height: 1.35;
}

.device-metric-card__meta--fan-running {
  color: rgba(133, 227, 173, 0.9);
}

.device-metric-card__meta--fan-off {
  color: rgba(255, 188, 102, 0.92);
}

.device-metric-card__meta--fan-unknown {
  color: rgba(201, 214, 228, 0.62);
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

.device-danger-zone--restart {
  background: rgba(110, 58, 12, 0.18);
  border-color: rgba(255, 171, 64, 0.2);
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

.device-danger-zone__button--restart {
  color: rgba(255, 203, 128, 0.96) !important;
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

.settings-control--spaced {
  margin-top: 0.42rem;
}

.settings-control__label {
  color: rgba(221, 231, 241, 0.78);
  font-size: 0.78rem;
  font-weight: 650;
  line-height: 1.2;
}

.settings-action {
  display: grid;
  gap: 0.55rem;
}

.settings-actions-grid {
  display: grid;
  gap: 0.55rem;
}

.settings-action__value {
  color: rgba(244, 249, 255, 0.94);
  font-size: 0.92rem;
  font-weight: 680;
  line-height: 1.3;
}

.settings-action__button {
  justify-self: start;
  min-height: 2.3rem;
  padding-inline: 0.9rem;
  border-radius: 12px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.guest-qr-dialog {
  width: min(100%, 27.5rem);
  border-radius: 22px !important;
  padding: 1.85rem;
  background:
    linear-gradient(180deg, rgba(18, 28, 42, 0.96), rgba(10, 18, 30, 0.96)) !important;
  border: 1px solid rgba(120, 170, 220, 0.18);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
  animation: wifiConnectDialogRise 260ms cubic-bezier(0.2, 0.9, 0.22, 1);
}

.upload-bulk-dialog {
  width: min(100%, 27.5rem);
  border-radius: 22px !important;
  padding: 1.85rem;
  background:
    linear-gradient(180deg, rgba(18, 28, 42, 0.96), rgba(10, 18, 30, 0.96)) !important;
  border: 1px solid rgba(120, 170, 220, 0.18);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.6),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
  animation: wifiConnectDialogRise 260ms cubic-bezier(0.2, 0.9, 0.22, 1);
}

:deep(.upload-bulk-overlay .v-overlay__scrim) {
  background: rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(12px) saturate(0.62) brightness(0.5);
}

:deep(.upload-bulk-dialog__content) {
  width: min(27.5rem, calc(100vw - 2rem));
  margin: 1rem;
}

.upload-bulk-dialog__label {
  color: rgba(194, 211, 228, 0.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
}

.upload-bulk-dialog__title {
  margin-top: 0.48rem;
  color: rgba(247, 250, 255, 0.98);
  font-size: 1.45rem;
  font-weight: 760;
  line-height: 1.15;
}

.upload-bulk-dialog__copy {
  margin-top: 0.8rem;
  color: rgba(214, 224, 235, 0.76);
  font-size: 0.98rem;
  line-height: 1.5;
}

.upload-bulk-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.45rem;
}

.upload-bulk-dialog__button {
  min-height: 3.2rem;
  min-width: 0;
  border-radius: 14px;
  padding-inline: 0.8rem;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.upload-bulk-dialog__button :deep(.v-btn__content) {
  min-width: 0;
  white-space: normal;
  text-align: center;
  line-height: 1.15;
}

.upload-bulk-dialog__button :deep(.v-btn__prepend) {
  margin-inline-end: 0.4rem;
}

.upload-bulk-dialog__button--cancel {
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(226, 234, 242, 0.82);
  background: rgba(255, 255, 255, 0.04);
}

.upload-bulk-dialog__button--confirm {
  color: rgba(255, 244, 244, 0.98);
  background:
    linear-gradient(180deg, #c74e4e, #982f2f) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 24px rgba(151, 47, 47, 0.28);
}

:deep(.guest-qr-overlay .v-overlay__scrim) {
  background: rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(12px) saturate(0.62) brightness(0.5);
}

:deep(.guest-qr-dialog__content) {
  width: min(27.5rem, calc(100vw - 2rem));
  margin: 1rem;
}

.guest-qr-dialog__label {
  color: rgba(194, 211, 228, 0.5);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
}

.guest-qr-dialog__title {
  margin-top: 0.48rem;
  color: rgba(247, 250, 255, 0.98);
  font-size: 1.45rem;
  font-weight: 760;
  line-height: 1.15;
}

.guest-qr-dialog__body {
  display: grid;
  gap: 0.9rem;
  margin-top: 1rem;
}

.guest-qr-dialog__code-shell {
  display: grid;
  justify-items: center;
  gap: 0.85rem;
}

.guest-qr-dialog__code-card {
  width: min(100%, 21.2rem);
  padding: 1.1rem;
  border-radius: 24px;
  background: #fff;
  box-shadow:
    inset 0 0 0 1px rgba(8, 14, 22, 0.04),
    0 18px 40px rgba(0, 0, 0, 0.16);
}

.guest-qr-dialog__qr {
  display: block;
  width: 100%;
  height: auto;
  color: #111;
}

.guest-qr-dialog__hint {
  color: rgba(221, 231, 241, 0.78);
  font-size: 0.86rem;
  line-height: 1.45;
  text-align: center;
}

.guest-qr-dialog__empty {
  padding: 1rem 0.4rem;
  color: rgba(214, 224, 235, 0.76);
  text-align: center;
  line-height: 1.45;
}

.guest-qr-dialog__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.45rem;
}

.guest-qr-dialog__button {
  min-height: 3.2rem;
  border-radius: 14px;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.guest-qr-dialog__button--cancel {
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(226, 234, 242, 0.82);
  background: rgba(255, 255, 255, 0.04);
}

.guest-qr-dialog__button--cancel:hover {
  border-color: rgba(164, 191, 218, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

.guest-qr-dialog__button--confirm {
  color: rgba(243, 249, 255, 0.96);
  background:
    linear-gradient(180deg, #4d7cc7, #2d5298) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 24px rgba(45, 82, 152, 0.28);
}

.guest-qr-dialog__button--confirm:hover {
  background:
    linear-gradient(180deg, #5b8ad5, #375ea7) !important;
}

.settings-explainer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
}

.settings-explainer__icon-shell {
  width: 2.2rem;
  height: 2.2rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(143, 177, 209, 0.1);
  background:
    radial-gradient(circle at top, rgba(94, 211, 244, 0.08), transparent 62%),
    rgba(10, 18, 28, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 20px rgba(4, 10, 18, 0.1);
}

.settings-explainer__icon {
  color: rgba(176, 214, 241, 0.88);
}

.settings-explainer__copy {
  min-width: 0;
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
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      rgba(20, 30, 40, 0.9),
      rgba(10, 18, 28, 0.95)
    ) !important;
  border: 1px solid rgba(120, 200, 255, 0.15);
  backdrop-filter: blur(14px);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
  transition:
    transform 150ms ease,
    box-shadow 180ms ease,
    border-color 160ms ease;
}

.upload-card__media {
  position: relative;
  overflow: hidden;
  border-radius: 17px 17px 0 0;
  isolation: isolate;
}

.upload-card__image-wrapper {
  border-radius: inherit;
  overflow: hidden;
  background: rgba(10, 18, 28, 0.96);
}

.upload-card__new-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.45rem;
  padding: 0.18rem 0.52rem;
  border-radius: 999px;
  background: rgba(255, 92, 92, 0.96);
  color: #fff7f7;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08),
    0 10px 20px rgba(65, 10, 10, 0.28);
}

.upload-card__stamp {
  position: absolute;
  left: 50%;
  top: 52%;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: min(86%, 17.5rem);
  min-height: 3.9rem;
  padding: 0.58rem 1.25rem;
  border-radius: 10px;
  font-size: clamp(1.16rem, 4vw, 1.42rem);
  font-weight: 900;
  letter-spacing: 0.2em;
  line-height: 1;
  text-transform: uppercase;
  transform: translate(-50%, -50%) rotate(-15deg);
  transform-origin: center;
  pointer-events: none;
  overflow: hidden;
  text-align: center;
  white-space: nowrap;
  mix-blend-mode: screen;
  filter:
    drop-shadow(0 4px 8px rgba(0, 0, 0, 0.62))
    drop-shadow(0 0 16px rgba(0, 0, 0, 0.22));
  animation: uploadStampIn 220ms cubic-bezier(0.2, 0.9, 0.22, 1.18) both;
  will-change: transform, opacity, filter;
}

.upload-card__stamp::before,
.upload-card__stamp::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.upload-card__stamp::before {
  inset: -0.1rem;
  border-radius: 12px;
  background:
    radial-gradient(circle at center, rgba(3, 10, 7, 0.16), rgba(3, 10, 7, 0.28) 72%, rgba(0, 0, 0, 0.34));
  filter: blur(10px);
  opacity: 0.72;
}

.upload-card__stamp::after {
  inset: 0.3rem;
  border: 2px solid currentColor;
  border-radius: 6px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.18);
  background:
    repeating-linear-gradient(
      -11deg,
      rgba(255, 255, 255, 0.12) 0,
      rgba(255, 255, 255, 0.12) 2px,
      transparent 2px,
      transparent 11px
    ),
    radial-gradient(circle at 18% 30%, rgba(255, 255, 255, 0.16), transparent 18%),
    radial-gradient(circle at 80% 72%, rgba(255, 255, 255, 0.1), transparent 16%);
  opacity: 0.28;
  mix-blend-mode: screen;
}

.upload-card__stamp--approved {
  color: rgba(163, 255, 195, 0.98);
  border: 4px solid rgba(34, 197, 94, 0.98);
  background: rgba(10, 38, 20, 0.22);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 0 2px rgba(7, 22, 12, 0.28),
    0 0 24px rgba(34, 197, 94, 0.14);
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.36),
    0 0 10px rgba(7, 24, 12, 0.34),
    0 0 16px rgba(34, 197, 94, 0.18);
}

.upload-card__stamp--rejected {
  color: rgba(255, 197, 197, 0.98);
  border: 4px solid rgba(239, 68, 68, 0.98);
  background: rgba(48, 12, 16, 0.24);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 0 0 2px rgba(29, 8, 10, 0.3),
    0 0 24px rgba(239, 68, 68, 0.14);
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.38),
    0 0 10px rgba(35, 8, 10, 0.34),
    0 0 16px rgba(239, 68, 68, 0.18);
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
  gap: 0.56rem;
  padding: 0.96rem 0.95rem 0.75rem;
}

.upload-card__meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.upload-card__timestamp {
  color: rgba(221, 231, 242, 0.88);
  font-size: 0.94rem;
  font-weight: 560;
  line-height: 1.2;
  min-width: 0;
}

.upload-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  margin-top: 0.08rem;
  color: rgba(200, 220, 240, 0.7);
}

.upload-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.2;
}

.upload-card__meta-separator {
  color: rgba(194, 208, 223, 0.38);
}

.upload-card__delete-action {
  min-height: 1.6rem;
  padding-inline: 0.1rem;
  color: rgba(221, 231, 242, 0.64);
  font-size: 0.76rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-transform: none;
  flex: 0 0 auto;
}

.upload-card__delete-action:hover {
  color: #ff6b6b;
}

.upload-card__actions-block {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
}

.upload-card__primary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.upload-card__primary-actions--single {
  grid-template-columns: minmax(0, 1fr);
}

.upload-card__primary-action {
  min-width: 0;
  min-height: 2.3rem;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: none;
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

:deep(.upload-preview),
:deep(.upload-preview .v-responsive),
:deep(.upload-preview .v-responsive__content),
:deep(.upload-preview .v-img__img),
:deep(.upload-preview .v-img__picture),
:deep(.upload-preview .v-img__gradient) {
  border-radius: inherit;
}

:deep(.upload-preview .v-responsive__content) {
  position: relative;
  z-index: 1;
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

.upload-card:hover {
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.52),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(120, 200, 255, 0.17);
}

.upload-card-list-move,
.upload-card-list-enter-active,
.upload-card-list-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.upload-card-list-enter-from,
.upload-card-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}

.upload-card-list-leave-active {
  pointer-events: none;
}

@keyframes uploadStampIn {
  0% {
    opacity: 0.18;
    transform: translate(-50%, -56%) rotate(-15deg) scale(1.1);
    filter:
      drop-shadow(0 10px 18px rgba(0, 0, 0, 0.28))
      blur(1.2px);
  }
  58% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-15deg) scale(0.958);
    filter:
      drop-shadow(0 6px 10px rgba(0, 0, 0, 0.42))
      blur(0.18px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-15deg) scale(1);
    filter:
      drop-shadow(0 4px 8px rgba(0, 0, 0, 0.62))
      drop-shadow(0 0 16px rgba(0, 0, 0, 0.22));
  }
}

@keyframes wifiConnectDialogRise {
  from {
    opacity: 0;
    transform: translate3d(0, 1rem, 0) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
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

:deep(.settings-section .admin-text-input) {
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

:deep(.settings-section .admin-text-input .v-field) {
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

:deep(.settings-section .admin-text-input .v-field__overlay) {
  opacity: 0;
}

:deep(.settings-section .admin-select .v-field__outline) {
  display: none;
}

:deep(.settings-section .admin-text-input .v-field__outline) {
  display: none;
}

:deep(.settings-section .admin-select .v-field__input) {
  min-height: 47px;
  padding-top: 8px;
  padding-bottom: 8px;
}

:deep(.settings-section .admin-text-input .v-field__input) {
  min-height: 47px;
  padding-top: 8px;
  padding-bottom: 8px;
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.92rem;
}

:deep(.settings-section .admin-select .v-select__selection) {
  color: rgba(245, 249, 255, 0.96);
  line-height: 1.2;
  font-size: 0.88rem;
}

:deep(.settings-section .admin-select .v-field__append-inner) {
  align-self: center;
}

:deep(.settings-section .admin-text-input .v-field__append-inner) {
  align-self: center;
}

:deep(.settings-section .admin-select .v-field--focused) {
  border-color: rgba(89, 214, 228, 0.42);
  box-shadow:
    0 0 0 1px rgba(89, 214, 228, 0.22),
    0 10px 20px rgba(5, 16, 27, 0.14);
}

:deep(.settings-section .admin-text-input .v-field--focused) {
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

.settings-slider-row--spaced {
  margin-top: 0.32rem;
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

  .upload-card__status-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .upload-card__delete-action {
    margin-left: -0.1rem;
  }

  .upload-bulk-dialog__button {
    min-height: 3.05rem;
    padding-inline: 0.65rem;
    font-size: 0.94rem;
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
