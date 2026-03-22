<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type {
  AdminUploadListResponse,
  AmbientColorPreset,
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
  VideoObjectFit,
  VideoPlaybackOrder,
  VideoTransition,
  VisualizerPreset,
} from '../../services/api'
import {
  approveUpload,
  deleteUpload,
  downloadAdminUploadArchive,
  fetchAdminUploads,
  fetchGuestUploadConfig,
  rejectUpload,
  startSetupMode,
  stopSetupMode,
  triggerSystemRestart,
  triggerSystemShutdown,
  updateAdminAccess,
  updateGuestUploadConfig,
} from '../../services/api'
import QrCodeMatrix from '../../components/branding/QrCodeMatrix.vue'
import AdminShowControlHeader from '../../components/admin/AdminShowControlHeader.vue'
import SystemSettingsPanel from '../../components/admin/SystemSettingsPanel.vue'
import {
  defaultVisualizerPresetSequence,
  visualizerPresetLabels,
} from '../../constants/visualizerPresets'
import { useAdminVideoLibrary } from '../../composables/useAdminVideoLibrary'
import { useAdminAlert } from '../../stores/adminAlert'
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
const router = useRouter()
const authStore = useAuthStore()
const adminAlert = useAdminAlert()
const adminUploadsBadgeStore = useAdminUploadsBadgeStore()
const appModeStore = useAppModeStore()
const publicRuntimeStore = usePublicRuntimeStore()
const selfieStore = useSelfieStore()
const standbyStore = useStandbyStore()
const systemStatusStore = useSystemStatusStore()
const videoStore = useVideoStore()
const visualizerStore = useVisualizerStore()
const {
  orderedVideoAssets,
  totalVideoDurationSeconds,
  refreshVideoLibrary,
  loadVideoMetadata,
} = useAdminVideoLibrary({
  onVideoStateSynced: syncVideoDraftFromStore,
  onSystemRefresh: refreshSystemOnly,
})

type AdminWorkspaceSection = 'modus' | 'system' | 'uploads'
type UploadGalleryFilter = 'all' | 'pending' | 'rejected' | 'new'
type RecentEventEntry = {
  name: string
  at: string
}
type SlideshowSettingOption = {
  value: number
  label: string
  description?: string
}

const isBooting = ref(true)
const isSwitchingMode = ref(false)
const optimisticMode = ref<AppMode | null>(null)
const isSavingDisplayTheme = ref(false)
const isSavingVisualizer = ref(false)
const isSavingSelfie = ref(false)
const isSavingStandby = ref(false)
const isSavingVideo = ref(false)
const isSavingRemoteVisualizer = ref(false)
const isSavingRemoteRenderer = ref(false)
const isSavingAccess = ref(false)
const isSavingSecurity = ref(false)
const securityError = ref('')
const isShuttingDown = ref(false)
const isRestartingSystem = ref(false)
const isTogglingSetupMode = ref(false)
const isDownloadingUploadArchive = ref(false)
const isDeletingAllUploads = ref(false)
const dashboardLiveActive = ref(false)
const uploads = ref<UploadItem[]>([])
const uploadSummary = ref({
  total: 0,
  pending: 0,
  rejected: 0,
})
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
const isRefreshingUploadWorkspace = ref(false)
const pendingUploadWorkspaceRefresh = ref(false)
const recentEvents = ref<RecentEventEntry[]>([])
const uploadGalleryFilter = ref<UploadGalleryFilter>('all')
const uploadListSentinel = ref<HTMLElement | null>(null)
const uploadListHasMore = ref(false)
const isLoadingMoreUploads = ref(false)
const uploadListError = ref('')
const uploadListInitialized = ref(false)
const isUploadBulkMenuOpen = ref(false)
const isDeleteAllUploadsDialogOpen = ref(false)
const isGuestQrDialogOpen = ref(false)
const sessionNewUploadIds = ref<number[]>([])
const activeStandbyTextField = ref<'headline' | 'subheadline' | null>(null)
const accessResetCounter = ref(0)
const uploadPageSize = 12
const adminUploadBulkFetchLimit = 100
const ambientColorPresetDraft = ref<AmbientColorPreset>('blue')
const ambientColorCustomHueDraft = ref(0)
const guestUploadEnabled = ref(true)
const guestUploadRequiresApproval = ref(false)
const guestUploadSessionTimeoutHours = ref(24)
const guestUploadSessionExpiresAt = ref<string | null>(null)
const guestUploadSessionExpired = ref(false)

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
  overlay_mode: 'qr',
  vintage_look_enabled: false,
  moderation_mode: 'auto_approve',
})

const standbyDraft = reactive<{
  screen_variant: 'standard' | 'spotlight_reveal'
  headline: string
  subheadline: string
}>({
  screen_variant: 'standard',
  headline: 'Unterm Berg beginnt die Nacht',
  subheadline: 'Willkommen im Auberg-Keller',
})

const ambientColorPresets = [
  {
    id: 'blue',
    label: 'Blau',
    swatch: 'linear-gradient(135deg, #55c8ff 0%, #2d6dff 100%)',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    swatch: 'linear-gradient(135deg, #79f4ff 0%, #2fb8d8 100%)',
  },
  {
    id: 'violet',
    label: 'Violett',
    swatch: 'linear-gradient(135deg, #8b7bff 0%, #d166ff 100%)',
  },
  {
    id: 'custom',
    label: 'Andere',
    swatch: '',
    icon: 'mdi-palette-outline',
  },
] as const

const standbyScreenOptions = [
  {
    id: 'standard',
    title: 'Particle Chaos',
    note: 'Standard-Bühne',
    disabled: false,
  },
  {
    id: 'spotlight_reveal',
    title: 'Spotlight Reveal',
    note: 'Derzeit deaktiviert',
    disabled: true,
  },
] as const

const slideshowDensityOptions: SlideshowSettingOption[] = [
  { value: 3, label: 'Locker', description: 'Weniger Bilder gleichzeitig' },
  { value: 5, label: 'Ausgewogen', description: 'Ruhige Standard-Dichte' },
  { value: 7, label: 'Dicht', description: 'Mehr Bilder parallel' },
]

const slideshowIntervalOptions: SlideshowSettingOption[] = Array.from({ length: 19 }, (_, index) => {
  const value = index + 2
  return {
    value,
    label: `${value} Sekunden`,
  }
})

const slideshowStartAfterOptions: SlideshowSettingOption[] = Array.from({ length: 10 }, (_, index) => {
  const value = index + 1
  return {
    value,
    label: value === 1 ? '1 Upload' : `${value} Uploads`,
  }
})

function buildNumericSelectOptions(
  min: number,
  max: number,
  step: number,
  current: number,
  formatLabel: (value: number) => string,
) {
  const values = new Set<number>()

  for (let value = min; value <= max; value += step) {
    values.add(value)
  }

  values.add(Math.max(min, Math.min(max, Math.round(current))))

  return Array.from(values)
    .sort((left, right) => left - right)
    .map((value) => ({
      title: formatLabel(value),
      value,
    }))
}

function clampVisualizerPercentStep(value: number) {
  return Math.max(0, Math.min(100, Math.round(value / 25) * 25))
}

const visualizerSpeedOptions = computed(() =>
  buildNumericSelectOptions(0, 100, 25, clampVisualizerPercentStep(visualizerDraft.speed), (value) => `${value}%`),
)

const visualizerIntensityOptions = computed(() =>
  buildNumericSelectOptions(0, 100, 25, clampVisualizerPercentStep(visualizerDraft.intensity), (value) => `${value}%`),
)

const visualizerAutoCycleIntervalOptions = computed(() =>
  buildNumericSelectOptions(5, 30, 1, visualizerDraft.auto_cycle_interval_minutes, (value) => `${value} min`),
)

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getStandbyScreenPreviewStyle(dimmed = false) {
  const previewPresetId = ambientColorPresetDraft.value === 'custom' ? 'violet' : ambientColorPresetDraft.value
  const preset = ambientColorPresets.find((entry) => entry.id === previewPresetId)
  const [startColor = '#55c8ff', endColor = '#2d6dff'] = preset?.swatch.match(/#(?:[0-9a-fA-F]{3}){1,2}/g) ?? []

  return {
    '--standby-preview-color-a': hexToRgba(startColor, dimmed ? 0.22 : 0.3),
    '--standby-preview-color-a-strong': hexToRgba(startColor, dimmed ? 0.28 : 0.42),
    '--standby-preview-color-b': hexToRgba(endColor, dimmed ? 0.18 : 0.24),
    '--standby-preview-color-b-strong': hexToRgba(endColor, dimmed ? 0.22 : 0.3),
    '--standby-preview-saturation': dimmed ? '0.72' : '1',
    '--standby-preview-brightness': dimmed ? '0.8' : '1',
    '--standby-preview-opacity': dimmed ? '0.84' : '1',
  }
}

function normalizeAmbientHueShift(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(-180, Math.min(180, Math.round(value)))
}

function getAmbientCustomSwatch() {
  const primaryHue = 205 + ambientColorCustomHueDraft.value
  const secondaryHue = 228 + ambientColorCustomHueDraft.value
  return `linear-gradient(135deg, hsl(${primaryHue} 92% 68%) 0%, hsl(${secondaryHue} 88% 58%) 100%)`
}

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

const videoFitItems = [
  { title: 'Video einpassen', value: 'contain' },
  { title: 'Video zuschneiden', value: 'cover' },
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

const uploadSessionTimeoutItems = [
  { title: '1 Stunde', value: 1 },
  { title: '6 Stunden', value: 6 },
  { title: '12 Stunden', value: 12 },
  { title: '24 Stunden', value: 24 },
  { title: '48 Stunden', value: 48 },
  { title: '72 Stunden', value: 72 },
] as const

let visualizerPersistTimer: number | undefined
let selfiePersistTimer: number | undefined
let standbyPersistTimer: number | undefined
let videoPersistTimer: number | undefined
let remoteVisualizerPersistTimer: number | undefined
let remoteRendererPersistTimer: number | undefined
let ambientColorPersistTimer: number | undefined
let uploadListObserver: IntersectionObserver | null = null
let uploadThumbnailObserver: IntersectionObserver | null = null
let uploadListRequestVersion = 0
const observedUploadCards = new Map<number, Element>()
const loadingThumbnailIds = new Set<number>()

const slideshowRunningLabel = computed(() =>
  selfieStore.slideshowEnabled ? 'läuft' : 'pausiert',
)

const displayUploads = computed(() => uploads.value)

const pendingCount = computed(() => uploadSummary.value.pending)

const rejectedCount = computed(() => uploadSummary.value.rejected)

const newUploadCount = computed(() => sessionNewUploadIds.value.length)

const filteredUploadGallery = computed(() => displayUploads.value)

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
  uploadSummary.value.total > 0 && Boolean(authStore.token),
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

const activeWorkspaceSection = computed<AdminWorkspaceSection>(() => {
  const hash = route.hash.replace('#', '')
  if (hash === 'uploads') {
    return 'uploads'
  }
  if (hash === 'status' || hash === 'system') {
    return 'system'
  }
  return 'modus'
})

const activeMode = computed(() => optimisticMode.value ?? appModeStore.mode)
type OverlayControlModule = 'visualizer' | 'selfie' | 'video'

function normalizeOverlayModeForModule(module: OverlayControlModule, mode: OverlayMode): OverlayMode {
  if (module === 'selfie') {
    return mode === 'qr' ? 'qr' : 'off'
  }

  return mode === 'logo' ? 'logo' : 'off'
}

function nextOverlayModeForModule(module: OverlayControlModule, current: OverlayMode): OverlayMode {
  const normalized = normalizeOverlayModeForModule(module, current)

  if (module === 'selfie') {
    return normalized === 'qr' ? 'off' : 'qr'
  }

  return normalized === 'logo' ? 'off' : 'logo'
}

function overlayModeLabelForModule(module: OverlayControlModule, mode: OverlayMode) {
  const normalized = normalizeOverlayModeForModule(module, mode)
  if (module === 'video' || module === 'visualizer') {
    return normalized === 'off' ? 'Overlay aus' : 'Overlay an'
  }
  if (normalized === 'qr') return 'Overlay an'
  return 'Overlay aus'
}

const contextActions = computed(() => {
  if (activeMode.value === 'selfie') {
    return [
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
        label: overlayModeLabelForModule('selfie', selfieDraft.overlay_mode),
        color: 'primary' as const,
        loading: isBusy('selfie:overlay-mode'),
        disabled: isBooting.value,
        active: normalizeOverlayModeForModule('selfie', selfieDraft.overlay_mode) !== 'off',
      },
    ]
  }

  if (activeMode.value === 'visualizer') {
    return [
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
        label: overlayModeLabelForModule('visualizer', visualizerDraft.overlay_mode),
        color: 'secondary' as const,
        loading: isBusy('visualizer:overlay-mode'),
        disabled: isBooting.value,
        active: normalizeOverlayModeForModule('visualizer', visualizerDraft.overlay_mode) !== 'off',
      },
    ]
  }

  if (activeMode.value === 'video') {
    return [
      {
        id: 'video:playlist',
        label: videoDraft.playlist_enabled ? 'Automatikwechsel an' : 'Automatikwechsel aus',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value,
        active: videoDraft.playlist_enabled,
      },
      {
        id: 'video:vintage',
        label: videoDraft.vintage_filter_enabled ? 'Vintage an' : 'Vintage aus',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value,
        active: videoDraft.vintage_filter_enabled,
      },
      {
        id: 'video:transition',
        label: videoDraft.transition === 'fade' ? 'Übergang an' : 'Übergang aus',
        color: 'primary' as const,
        loading: false,
        disabled: isBooting.value,
        active: videoDraft.transition === 'fade',
      },
      {
        id: 'video:overlay-mode',
        label: overlayModeLabelForModule('video', videoDraft.overlay_mode),
        color: 'primary' as const,
        loading: isBusy('video:overlay-mode'),
        disabled: isBooting.value,
        active: normalizeOverlayModeForModule('video', videoDraft.overlay_mode) !== 'off',
      },
    ]
  }

  return []
})

const showUploadModerationActions = computed(() =>
  guestUploadRequiresApproval.value,
)

const visualizerAutoCycleSummaryLabel = computed(() =>
  visualizerStore.autoCycleEnabled ? 'Aktiv' : 'Pausiert',
)

const visualizerTelemetryLabel = computed(
  () =>
    `T ${visualizerStore.speed} / I ${visualizerStore.intensity} / H ${visualizerStore.brightness}`,
)

const activeVisualizerPresetLabel = computed(
  () => visualizerPresetLabels[visualizerDraft.active_preset] ?? visualizerDraft.active_preset,
)

const visualizerSequenceCountLabel = computed(() => {
  const count = visualizerStore.presetSequence.length || defaultVisualizerPresetSequence.length
  return `${count} Stile`
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

const videoLibrarySummaryLabel = computed(() => {
  const count = orderedVideoAssets.value.length
  if (count === 0) {
    return 'Noch keine Videos hochgeladen'
  }
  if (count === 1) {
    return '1 Video hochgeladen'
  }
  return `${count} Videos hochgeladen`
})

const videoLibraryDurationLabel = computed(() => {
  if (!orderedVideoAssets.value.length) {
    return 'Gesamtdauer 0:00'
  }

  if (totalVideoDurationSeconds.value <= 0) {
    return 'Gesamtdauer wird gelesen'
  }

  return `Gesamtdauer ${formatVideoDurationLabel(totalVideoDurationSeconds.value)}`
})

const cpuLoadLabel = computed(() => formatPercent(systemStatusStore.cpuLoadPercent))

const memoryPercentLabel = computed(() => formatPercent(systemStatusStore.memoryPercent))

const cpuTemperatureLabel = computed(() => {
  if (systemStatusStore.cpuTemperatureCelsius == null) {
    return 'Nicht verfügbar'
  }
  return `${systemStatusStore.cpuTemperatureCelsius.toFixed(1)} °C`
})

const cpuLoadBarValue = computed(() => Math.max(0, Math.min(systemStatusStore.cpuLoadPercent ?? 0, 100)))

const memoryBarValue = computed(() => Math.max(0, Math.min(systemStatusStore.memoryPercent ?? 0, 100)))

const systemNetworkStateLabel = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? 'Setup-Modus aktiv'
    : systemStatusStore.networkStatus.online
      ? 'Online'
      : 'Offline',
)

const systemNetworkStateDetail = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? 'Mit dem Setup-WLAN verbinden, um das Event-Netzwerk auszuwählen.'
    : systemStatusStore.networkStatus.online
      ? 'Externe Verbindung verfügbar'
      : 'Keine externe Verbindung erkannt',
)

const systemNetworkName = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? systemStatusStore.setupModeStatus.ssid
    : systemStatusStore.networkStatus.ssid || 'Nicht verbunden',
)

const systemIpAddress = computed(() =>
  systemStatusStore.setupModeStatus.enabled
    ? systemStatusStore.setupModeStatus.ip
    : systemStatusStore.networkStatus.ip || 'Nicht verfügbar',
)

const systemHostname = computed(() =>
  systemStatusStore.appliance.network.local_hostname
  || publicRuntimeStore.network.local_hostname
  || 'Nicht verfügbar',
)

const guestUploadUrl = computed(() => publicRuntimeStore.urls.guest_upload_url)
const uploadControlSessionTimeoutLabel = computed(() => {
  const matched = uploadSessionTimeoutItems.find((item) => item.value === guestUploadSessionTimeoutHours.value)
  return matched?.title ?? `${guestUploadSessionTimeoutHours.value} Stunden`
})
const systemSessionExpiresAtLabel = computed(() => formatSessionExpiryLabel(guestUploadSessionExpiresAt.value))

function buildUploadQueryOptions(limit: number, offset = 0) {
  const options: {
    limit: number
    offset: number
    moderationStatus?: 'pending' | 'rejected'
    ids?: number[]
  } = {
    limit,
    offset,
  }

  if (uploadGalleryFilter.value === 'pending') {
    options.moderationStatus = 'pending'
  } else if (uploadGalleryFilter.value === 'rejected') {
    options.moderationStatus = 'rejected'
  } else if (uploadGalleryFilter.value === 'new') {
    options.ids = [...sessionNewUploadIds.value]
  }

  return options
}

function applyUploadSummary(response: AdminUploadListResponse) {
  uploadSummary.value = {
    total: response.summary.total,
    pending: response.summary.pending,
    rejected: response.summary.rejected,
  }
}

function mergeUploads(existing: UploadItem[], incoming: UploadItem[]) {
  const byId = new Map<number, UploadItem>()
  for (const upload of existing) {
    byId.set(upload.id, upload)
  }
  for (const upload of incoming) {
    byId.set(upload.id, upload)
  }

  return [...byId.values()].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )
}

function syncThumbnailCache(items: UploadItem[]) {
  const activeIds = new Set(items.map((upload) => upload.id))
  for (const [id, url] of Object.entries(thumbnailUrls.value)) {
    if (!activeIds.has(Number(id))) {
      URL.revokeObjectURL(url)
      delete thumbnailUrls.value[Number(id)]
    }
  }
}

async function ensureUploadThumbnail(uploadId: number) {
  const upload = uploads.value.find((entry) => entry.id === uploadId)
  if (!upload || !authStore.token || !upload.admin_display_url || upload.status !== 'processed') {
    return
  }
  if (thumbnailUrls.value[upload.id] || loadingThumbnailIds.has(upload.id)) {
    return
  }

  loadingThumbnailIds.add(upload.id)

  try {
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
  } finally {
    loadingThumbnailIds.delete(upload.id)
  }
}

function ensureUploadListObserver() {
  if (uploadListObserver || typeof IntersectionObserver === 'undefined') {
    return
  }

  uploadListObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) {
      return
    }
    void loadMoreUploads()
  }, {
    rootMargin: '280px 0px',
  })
}

function ensureUploadThumbnailObserver() {
  if (uploadThumbnailObserver || typeof IntersectionObserver === 'undefined') {
    return
  }

  uploadThumbnailObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue
      }

      const uploadId = Number((entry.target as HTMLElement).dataset.uploadId)
      if (Number.isFinite(uploadId)) {
        void ensureUploadThumbnail(uploadId)
      }
      uploadThumbnailObserver?.unobserve(entry.target)
    }
  }, {
    rootMargin: '240px 0px',
  })
}

function resolveObservedElement(
  target: Element | ComponentPublicInstance | null,
): Element | null {
  if (!target) {
    return null
  }

  if (target instanceof Element) {
    return target
  }

  return target.$el instanceof Element ? target.$el : null
}

function setUploadListSentinel(target: Element | ComponentPublicInstance | null) {
  const element = resolveObservedElement(target)
  if (uploadListSentinel.value && uploadListObserver) {
    uploadListObserver.unobserve(uploadListSentinel.value)
  }

  uploadListSentinel.value = element as HTMLElement | null
  if (uploadListSentinel.value) {
    ensureUploadListObserver()
    uploadListObserver?.observe(uploadListSentinel.value)
  }
}

function setUploadCardObserverRef(
  uploadId: number,
  target: Element | ComponentPublicInstance | null,
) {
  const element = resolveObservedElement(target)
  const previousElement = observedUploadCards.get(uploadId)
  if (previousElement && uploadThumbnailObserver) {
    uploadThumbnailObserver.unobserve(previousElement)
  }

  if (!element) {
    observedUploadCards.delete(uploadId)
    return
  }

  observedUploadCards.set(uploadId, element)
  ensureUploadThumbnailObserver()
  uploadThumbnailObserver?.observe(element)
}

async function fetchUploadPage(limit: number, offset: number) {
  if (!authStore.token) {
    return null
  }

  if (uploadGalleryFilter.value === 'new' && sessionNewUploadIds.value.length === 0) {
    const emptyResponse: AdminUploadListResponse = {
      items: [],
      total: 0,
      has_more: false,
      offset: 0,
      limit,
      summary: {
        total: uploadSummary.value.total,
        pending: uploadSummary.value.pending,
        rejected: uploadSummary.value.rejected,
      },
    }
    return emptyResponse
  }

  return fetchAdminUploads(authStore.token, buildUploadQueryOptions(limit, offset))
}

async function refreshUploads(options: { preserveVisible?: boolean } = {}) {
  const preserveVisible = options.preserveVisible ?? true
  const limit = preserveVisible
    ? Math.max(uploadPageSize, uploads.value.length || uploadPageSize)
    : uploadPageSize

  if (!preserveVisible) {
    uploads.value = []
    uploadListHasMore.value = false
    syncThumbnailCache([])
  }

  uploadListError.value = ''
  const requestVersion = ++uploadListRequestVersion
  const response = await fetchUploadPage(limit, 0)
  if (!response || requestVersion !== uploadListRequestVersion) {
    return
  }

  applyUploadSummary(response)
  uploads.value = response.items
  uploadListHasMore.value = response.has_more
  uploadListInitialized.value = true
  syncThumbnailCache(response.items)
}

async function loadMoreUploads() {
  if (!authStore.token || isLoadingMoreUploads.value || !uploadListHasMore.value) {
    return
  }

  isLoadingMoreUploads.value = true
  uploadListError.value = ''
  const requestVersion = ++uploadListRequestVersion

  try {
    const response = await fetchUploadPage(uploadPageSize, uploads.value.length)
    if (!response || requestVersion !== uploadListRequestVersion) {
      return
    }

    applyUploadSummary(response)
    uploads.value = mergeUploads(uploads.value, response.items)
    uploadListHasMore.value = response.has_more
    syncThumbnailCache(uploads.value)
  } catch (error) {
    if (requestVersion === uploadListRequestVersion) {
      uploadListError.value = error instanceof Error
        ? error.message
        : 'Weitere Uploads konnten nicht geladen werden.'
    }
  } finally {
    if (requestVersion === uploadListRequestVersion) {
      isLoadingMoreUploads.value = false
    }
  }
}

onMounted(async () => {
  if (!authStore.token) {
    isBooting.value = false
    return
  }

  try {
    const adminToken = authStore.token
    const [initialUploadPage, guestUploadConfig] = await Promise.all([
      fetchAdminUploads(adminToken, buildUploadQueryOptions(uploadPageSize, 0)),
      fetchGuestUploadConfig(adminToken),
      appModeStore.refresh(),
      publicRuntimeStore.refresh(),
      selfieStore.refresh(),
      standbyStore.refresh(),
      videoStore.refreshState(),
      refreshVideoLibrary(),
      systemStatusStore.refresh(adminToken),
      visualizerStore.refresh(),
      visualizerStore.refreshOptions(),
      visualizerStore.refreshPresetSequence(),
    ])

    applyUploadSummary(initialUploadPage)
    uploads.value = initialUploadPage.items
    uploadListHasMore.value = initialUploadPage.has_more
    uploadListInitialized.value = true
    await Promise.all([
      syncVisualizerDraftFromStore(),
      syncSelfieDraftFromStore(),
      syncStandbyDraftFromStore(),
      syncVideoDraftFromStore(),
      syncRemoteVisualizerDraftFromStore(),
      syncRemoteRendererDraftFromStore(),
    ])
    applyGuestUploadConfig(guestUploadConfig)
    syncThumbnailCache(initialUploadPage.items)
    connectLiveEvents()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Dashboard konnte nicht geladen werden',
    )
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
  if (ambientColorPersistTimer) {
    window.clearTimeout(ambientColorPersistTimer)
  }
  if (reconnectTimer.value) {
    window.clearTimeout(reconnectTimer.value)
  }
  eventSource.value?.close()
  uploadListObserver?.disconnect()
  uploadListObserver = null
  uploadThumbnailObserver?.disconnect()
  uploadThumbnailObserver = null
  observedUploadCards.clear()
  loadingThumbnailIds.clear()
  revokeAllThumbnails()
})

watch(uploadGalleryFilter, async () => {
  await refreshUploads({ preserveVisible: false })
})

watch(sessionNewUploadIds, async () => {
  if (uploadGalleryFilter.value === 'new' && uploadListInitialized.value) {
    await refreshUploads({ preserveVisible: false })
  }
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
  () => publicRuntimeStore.ambientColorPreset,
  (value) => {
    ambientColorPresetDraft.value = value
  },
  { immediate: true },
)

watch(
  () => publicRuntimeStore.ambientColorCustomHueDegrees,
  (value) => {
    ambientColorCustomHueDraft.value = value
  },
  { immediate: true },
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
    standbyDraft.screen_variant,
    standbyDraft.headline,
    standbyDraft.subheadline,
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

  optimisticMode.value = mode
  isSwitchingMode.value = true
  try {
    await appModeStore.setMode(mode)
    await refreshSystemOnly()
  } catch (error) {
    optimisticMode.value = null
    adminAlert.error(error instanceof Error ? error.message : 'Moduswechsel fehlgeschlagen')
  } finally {
    optimisticMode.value = null
    isSwitchingMode.value = false
  }
}

async function syncVisualizerDraftFromStore() {
  isHydratingVisualizerDraft.value = true
  visualizerDraft.active_preset = visualizerStore.activePreset
  visualizerDraft.intensity = clampVisualizerPercentStep(visualizerStore.intensity)
  visualizerDraft.speed = clampVisualizerPercentStep(visualizerStore.speed)
  visualizerDraft.brightness = visualizerStore.brightness
  visualizerDraft.color_scheme = visualizerStore.colorScheme
  visualizerDraft.hydra_colorfulness = visualizerStore.hydraColorfulness
  visualizerDraft.hydra_scene_change_rate = visualizerStore.hydraSceneChangeRate
  visualizerDraft.hydra_symmetry_amount = visualizerStore.hydraSymmetryAmount
  visualizerDraft.hydra_feedback_amount = visualizerStore.hydraFeedbackAmount
  visualizerDraft.hydra_quality = visualizerStore.hydraQuality
  visualizerDraft.hydra_audio_reactivity_enabled = visualizerStore.hydraAudioReactivityEnabled
  visualizerDraft.hydra_palette_mode = visualizerStore.hydraPaletteMode
  visualizerDraft.overlay_mode = normalizeOverlayModeForModule('visualizer', visualizerStore.overlayMode)
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
  selfieDraft.overlay_mode = normalizeOverlayModeForModule('selfie', selfieStore.overlayMode)
  selfieDraft.vintage_look_enabled = selfieStore.vintageLookEnabled
  selfieDraft.moderation_mode = selfieStore.moderationMode
  await nextTick()
  isHydratingSelfieDraft.value = false
}

async function syncStandbyDraftFromStore() {
  isHydratingStandbyDraft.value = true
  standbyDraft.screen_variant = standbyStore.screenVariant
  if (!activeStandbyTextField.value) {
    standbyDraft.headline = standbyStore.headline
    standbyDraft.subheadline = standbyStore.subheadline
  }
  await nextTick()
  isHydratingStandbyDraft.value = false
}

async function syncVideoDraftFromStore() {
  isHydratingVideoDraft.value = true
  videoDraft.playlist_enabled = videoStore.playlistEnabled
  videoDraft.loop_enabled = videoStore.loopEnabled
  videoDraft.playback_order = videoStore.playbackOrder
  videoDraft.vintage_filter_enabled = videoStore.vintageFilterEnabled
  videoDraft.overlay_mode = normalizeOverlayModeForModule('video', videoStore.overlayMode)
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

function handleStandbyTextFocus(field: 'headline' | 'subheadline') {
  activeStandbyTextField.value = field
}

async function handleStandbyTextBlur() {
  activeStandbyTextField.value = null
  if (standbyPersistTimer) {
    window.clearTimeout(standbyPersistTimer)
    standbyPersistTimer = undefined
  }
  await saveStandbyDraft()
}

function selectAmbientColorPreset(value: AmbientColorPreset) {
  if (ambientColorPresetDraft.value === value) {
    return
  }

  ambientColorPresetDraft.value = value
  if (value === 'custom') {
    void saveAmbientColorPreset()
    return
  }

  void saveAmbientColorPreset()
}

function scheduleAmbientColorPersist() {
  if (ambientColorPersistTimer) {
    window.clearTimeout(ambientColorPersistTimer)
  }

  ambientColorPersistTimer = window.setTimeout(() => {
    void saveAmbientColorPreset()
  }, 140)
}

function handleAmbientCustomHueInput(value: number) {
  ambientColorCustomHueDraft.value = normalizeAmbientHueShift(value)
  if (ambientColorPresetDraft.value !== 'custom') {
    ambientColorPresetDraft.value = 'custom'
  }
  scheduleAmbientColorPersist()
}

function selectStandbyScreenVariant(value: 'standard' | 'spotlight_reveal') {
  standbyDraft.screen_variant = value
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
  isSavingVisualizer.value = true
  try {
    visualizerDraft.overlay_mode = normalizeOverlayModeForModule('visualizer', visualizerDraft.overlay_mode)
    visualizerDraft.intensity = clampVisualizerPercentStep(visualizerDraft.intensity)
    visualizerDraft.speed = clampVisualizerPercentStep(visualizerDraft.speed)
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
    adminAlert.error(error instanceof Error ? error.message : 'Visualizer-Update fehlgeschlagen')
  } finally {
    isSavingVisualizer.value = false
  }
}

async function saveSelfieDraft() {
  isSavingSelfie.value = true
  try {
    selfieDraft.overlay_mode = normalizeOverlayModeForModule('selfie', selfieDraft.overlay_mode)
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
    adminAlert.error(
      error instanceof Error ? error.message : 'Selfie-Settings konnten nicht gespeichert werden',
    )
  } finally {
    isSavingSelfie.value = false
  }
}

async function saveStandbyDraft() {
  isSavingStandby.value = true
  try {
    await standbyStore.save({
      screen_variant: standbyDraft.screen_variant,
      headline: standbyDraft.headline,
      subheadline: standbyDraft.subheadline,
      hue_shift_degrees: publicRuntimeStore.ambientHueShiftDegrees,
    })
    await refreshSystemOnly()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Standby-Texte konnten nicht gespeichert werden',
    )
  } finally {
    isSavingStandby.value = false
  }
}

async function saveVideoDraft() {
  isSavingVideo.value = true
  try {
    videoDraft.overlay_mode = normalizeOverlayModeForModule('video', videoDraft.overlay_mode)
    const playlistEnabled = videoDraft.playlist_enabled
    await videoStore.save({
      playlist_enabled: playlistEnabled,
      loop_enabled: playlistEnabled ? true : videoDraft.loop_enabled,
      playback_order: playlistEnabled ? 'upload_order' : videoDraft.playback_order,
      vintage_filter_enabled: videoDraft.vintage_filter_enabled,
      overlay_mode: videoDraft.overlay_mode,
      object_fit: videoDraft.object_fit,
      transition: videoDraft.transition,
      active_video_id: videoDraft.active_video_id,
    })
    await refreshSystemOnly()
  } catch (error) {
    adminAlert.error(
      error instanceof Error ? error.message : 'Video-Settings konnten nicht gespeichert werden',
    )
  } finally {
    isSavingVideo.value = false
  }
}

async function saveAmbientColorPreset() {
  isSavingDisplayTheme.value = true
  try {
    await publicRuntimeStore.saveRuntimeConfig(buildRuntimeConfigPayload())
    await refreshSystemOnly()
  } catch (error) {
    adminAlert.error(error instanceof Error ? error.message : 'Farbwelt konnte nicht gespeichert werden')
  } finally {
    isSavingDisplayTheme.value = false
  }
}

async function saveRemoteVisualizerDraft() {
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
    adminAlert.error(
      error instanceof Error ? error.message : 'Remote-Visualizer konnte nicht gespeichert werden',
    )
  } finally {
    isSavingRemoteVisualizer.value = false
  }
}

async function saveRemoteRendererDraft() {
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
    adminAlert.error(
      error instanceof Error ? error.message : 'Remote-Renderer konnte nicht gespeichert werden',
    )
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
    ambient_color_preset: ambientColorPresetDraft.value,
    ambient_color_custom_hue_degrees: normalizeAmbientHueShift(ambientColorCustomHueDraft.value),
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

async function refreshSystemOnly() {
  if (!authStore.token) {
    return
  }
  await systemStatusStore.refresh(authStore.token)
}

function applyGuestUploadConfig(payload: {
  guest_upload_enabled: boolean
  guest_upload_requires_approval: boolean
  guest_upload_session_timeout_hours: number
  session_expires_at: string
  session_is_expired: boolean
}) {
  guestUploadEnabled.value = payload.guest_upload_enabled
  guestUploadRequiresApproval.value = payload.guest_upload_requires_approval
  guestUploadSessionTimeoutHours.value = payload.guest_upload_session_timeout_hours
  guestUploadSessionExpiresAt.value = payload.session_expires_at
  guestUploadSessionExpired.value = payload.session_is_expired
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
    await Promise.all([refreshUploads(), refreshVideoLibrary(), systemStatusStore.refresh(authStore.token)])
  } finally {
    isRefreshingOperationalState.value = false
    if (pendingOperationalRefresh.value) {
      pendingOperationalRefresh.value = false
      await refreshOperationalState()
    }
  }
}

async function refreshUploadWorkspaceState(options: { preserveVisible?: boolean } = {}) {
  if (!authStore.token) {
    return
  }
  if (isRefreshingUploadWorkspace.value) {
    pendingUploadWorkspaceRefresh.value = true
    return
  }

  isRefreshingUploadWorkspace.value = true
  try {
    await refreshUploads(options)
  } finally {
    isRefreshingUploadWorkspace.value = false
    if (pendingUploadWorkspaceRefresh.value) {
      pendingUploadWorkspaceRefresh.value = false
      await refreshUploadWorkspaceState(options)
    }
  }
}

async function shutdownSystem() {
  if (!authStore.token || isShuttingDown.value) {
    return
  }

  isShuttingDown.value = true

  try {
    await triggerSystemShutdown(authStore.token)
    adminAlert.warning('Der Raspberry Pi fährt jetzt herunter.', {
      title: 'Ausschalten läuft',
      duration: 5200,
    })
  } catch (error) {
    showSystemActionError(error instanceof Error ? error.message : 'Ausschalten konnte nicht ausgelöst werden')
  } finally {
    isShuttingDown.value = false
  }
}

async function restartSystem() {
  if (!authStore.token || isRestartingSystem.value) {
    return
  }

  isRestartingSystem.value = true

  try {
    await triggerSystemRestart(authStore.token)
    adminAlert.info('Der Raspberry Pi startet jetzt neu.', {
      title: 'Neustart läuft',
      duration: 5200,
    })
  } catch (error) {
    showSystemActionError(error instanceof Error ? error.message : 'Neustart konnte nicht ausgelöst werden')
  } finally {
    isRestartingSystem.value = false
  }
}

async function saveSystemAccess(payload: {
  username: string
  current_password: string
  new_password: string
}) {
  if (!authStore.token || isSavingAccess.value) {
    return
  }

  isSavingAccess.value = true

  try {
    const response = await updateAdminAccess(payload, authStore.token)
    authStore.applySessionUser(response.user)
    accessResetCounter.value += 1
    adminAlert.success(response.message, {
      title: 'Zugang aktualisiert',
    })
  } catch (error) {
    adminAlert.error(error instanceof Error ? error.message : 'Zugang konnte nicht gespeichert werden')
  } finally {
    isSavingAccess.value = false
  }
}

async function saveSystemSecurity(payload: {
  approvalRequired: boolean
  guestUploadsEnabled: boolean
  sessionTimeoutHours: number
}, options?: {
  silentSuccess?: boolean
}) {
  if (!authStore.token || isSavingSecurity.value) {
    return
  }

  securityError.value = ''
  isSavingSecurity.value = true

  try {
    const response = await updateGuestUploadConfig(
      {
        guest_upload_enabled: payload.guestUploadsEnabled,
        guest_upload_requires_approval: payload.approvalRequired,
        guest_upload_session_timeout_hours: payload.sessionTimeoutHours,
      },
      authStore.token,
    )

    applyGuestUploadConfig(response)
    await Promise.all([
      refreshSystemOnly(),
      publicRuntimeStore.refresh(),
      selfieStore.refresh(),
    ])
    await syncSelfieDraftFromStore()

    if (!options?.silentSuccess) {
      adminAlert.success(
        response.session_is_expired
          ? 'Konfiguration gespeichert. Die Upload-Session ist weiterhin abgelaufen.'
          : `Konfiguration gespeichert. Aktuelle Upload-Session läuft bis ${formatSessionExpiryLabel(response.session_expires_at)}.`,
        {
          title: 'Sicherheit aktualisiert',
        },
      )
    }
  } catch (error) {
    securityError.value = error instanceof Error
      ? error.message
      : 'Upload-Einstellungen konnten nicht gespeichert werden'
    adminAlert.error(
      securityError.value,
    )
  } finally {
    isSavingSecurity.value = false
  }
}

function updateUploadSettings(payload: Partial<{
  approvalRequired: boolean
  guestUploadsEnabled: boolean
  sessionTimeoutHours: number
}>) {
  const isSessionOnlyUpdate =
    payload.sessionTimeoutHours != null
    && payload.approvalRequired == null
    && payload.guestUploadsEnabled == null
  const isGuestUploadToggleOnly =
    payload.guestUploadsEnabled != null
    && payload.approvalRequired == null
    && payload.sessionTimeoutHours == null
  const isApprovalToggleOnly =
    payload.approvalRequired != null
    && payload.guestUploadsEnabled == null
    && payload.sessionTimeoutHours == null

  void saveSystemSecurity({
    approvalRequired: payload.approvalRequired ?? guestUploadRequiresApproval.value,
    guestUploadsEnabled: payload.guestUploadsEnabled ?? guestUploadEnabled.value,
    sessionTimeoutHours: payload.sessionTimeoutHours ?? guestUploadSessionTimeoutHours.value,
  }, {
    silentSuccess: isSessionOnlyUpdate || isGuestUploadToggleOnly || isApprovalToggleOnly,
  })
}

async function toggleSetupMode() {
  if (!authStore.token || isTogglingSetupMode.value) {
    return
  }

  isTogglingSetupMode.value = true

  try {
    const enablingSetupMode = !systemStatusStore.setupModeStatus.enabled
    const response = systemStatusStore.setupModeStatus.enabled
      ? await stopSetupMode(authStore.token)
      : await startSetupMode(authStore.token)
    adminAlert.info(response.message, {
      title: enablingSetupMode ? 'Setup-Modus aktiv' : 'Setup-Modus beendet',
      duration: 5000,
    })
    await refreshSystemOnly()
  } catch (error) {
    showSystemActionError(
      error instanceof Error ? error.message : 'Setup-Modus konnte nicht umgeschaltet werden',
    )
  } finally {
    isTogglingSetupMode.value = false
  }
}

function openGuestQrDialog() {
  isGuestQrDialogOpen.value = true
}

function showSystemActionError(message: string) {
  const alert = buildSystemActionErrorAlert(message)
  adminAlert.error(alert.message, {
    title: alert.title,
    duration: 6200,
  })
}

function buildSystemActionErrorAlert(message: string) {
  if (/Neustart .*nicht verfügbar/i.test(message)) {
    return {
      title: 'Neustart nicht verfügbar',
      message: 'Auf diesem Gerät aktuell deaktiviert',
    }
  }

  if (/Ausschalten .*nicht verfügbar/i.test(message)) {
    return {
      title: 'Ausschalten nicht verfügbar',
      message: 'Auf diesem Gerät aktuell deaktiviert',
    }
  }

  if (/Setup-Modus .*nicht/i.test(message) || /Netzwerk/i.test(message)) {
    return {
      title: 'Netzwerkwechsel nicht verfügbar',
      message: 'Auf diesem Gerät aktuell deaktiviert',
    }
  }

  return {
    title: 'Systemaktion nicht verfügbar',
    message,
  }
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

  try {
    if (action === 'approve') {
      await approveUpload(upload.id, authStore.token)
    } else if (action === 'reject') {
      await rejectUpload(upload.id, authStore.token)
    } else {
      await deleteUpload(upload.id, authStore.token)
    }

    await refreshUploadWorkspaceState()
  } catch (error) {
    adminAlert.error(error instanceof Error ? error.message : 'Upload-Aktion fehlgeschlagen')
  } finally {
    setBusy(key, false)
  }
}

async function fetchAllUploadsForBulkAction() {
  if (!authStore.token) {
    return []
  }

  let offset = 0
  let hasMore = true
  const allUploads: UploadItem[] = []

  while (hasMore) {
    const response = await fetchAdminUploads(authStore.token, {
      limit: adminUploadBulkFetchLimit,
      offset,
    })
    allUploads.push(...response.items)
    hasMore = response.has_more
    offset += response.items.length
  }

  return allUploads
}

async function downloadAllUploadArchive() {
  if (!authStore.token || !canManageAllUploads.value || isDownloadingUploadArchive.value || isDeletingAllUploads.value) {
    return
  }

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
    adminAlert.success('Das Archiv wird jetzt heruntergeladen.', {
      title: 'Uploads exportiert',
    })
  } catch (error) {
    adminAlert.error(error instanceof Error ? error.message : 'Download fehlgeschlagen')
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

  isDeletingAllUploads.value = true

  try {
    const allUploads = await fetchAllUploadsForBulkAction()
    for (const upload of allUploads) {
      await deleteUpload(upload.id, authStore.token)
    }
    isDeleteAllUploadsDialogOpen.value = false
    await refreshUploadWorkspaceState({ preserveVisible: false })
    adminAlert.success('Alle Uploads wurden entfernt.', {
      title: 'Uploads gelöscht',
    })
  } catch (error) {
    adminAlert.error(error instanceof Error ? error.message : 'Löschen fehlgeschlagen')
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

    const presets: VisualizerPreset[] = visualizerStore.presetSequence.length
      ? [...visualizerStore.presetSequence]
      : (visualizerStore.presets.length ? [...visualizerStore.presets] : [...defaultVisualizerPresetSequence])
    const activePresets = presets.filter((preset) => !visualizerStore.skippedPresets.includes(preset))
    const rotationPresets = activePresets.length ? activePresets : presets
    const currentIndex = rotationPresets.indexOf(visualizerDraft.active_preset)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % rotationPresets.length : 0
    visualizerDraft.active_preset = rotationPresets[nextIndex]
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
    visualizerDraft.overlay_mode = nextOverlayModeForModule('visualizer', visualizerDraft.overlay_mode)
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
    selfieDraft.overlay_mode = nextOverlayModeForModule('selfie', selfieDraft.overlay_mode)
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
    videoDraft.overlay_mode = nextOverlayModeForModule('video', videoDraft.overlay_mode)
    await nextTick()
    isHydratingVideoDraft.value = false
    await saveVideoDraft()
  } finally {
    setBusy(key, false)
  }
}

async function runHeaderAction(actionId: string) {
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
  if (actionId === 'video:playlist') {
    toggleVideoPlaylist()
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
}

function openVideoManager() {
  void router.push({ name: 'admin-videos' })
}

function openVisualizerManager() {
  void router.push({ name: 'admin-visualizers' })
}

function formatVideoDurationLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00'
  }

  const totalSeconds = Math.round(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
    void refreshUploadWorkspaceState()
  })

  source.addEventListener('upload_deleted', (event) => {
    pushRecentEvent('upload_deleted')
    const payload = parseEventPayload(event) as { id?: unknown } | null
    const uploadId = typeof payload?.id === 'number' ? payload.id : null
    if (uploadId != null) {
      adminUploadsBadgeStore.removeUpload(uploadId)
      sessionNewUploadIds.value = sessionNewUploadIds.value.filter((id) => id !== uploadId)
    }
    void refreshUploadWorkspaceState()
  })

  for (const eventName of [
    'upload_approved',
    'upload_rejected',
    'cleanup_completed',
  ]) {
    source.addEventListener(eventName, () => {
      pushRecentEvent(eventName)
      void refreshUploadWorkspaceState()
    })
  }

  source.addEventListener('rate_limit_triggered', () => {
    pushRecentEvent('rate_limit_triggered')
    void refreshSystemOnly()
  })

  source.addEventListener('heartbeat_updated', () => {
    pushRecentEvent('heartbeat_updated')
    void refreshSystemOnly()
  })
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

function revokeAllThumbnails() {
  for (const url of Object.values(thumbnailUrls.value)) {
    URL.revokeObjectURL(url)
  }
  thumbnailUrls.value = {}
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

function toggleVideoVintageFilter() {
  videoDraft.vintage_filter_enabled = !videoDraft.vintage_filter_enabled
}

function toggleVideoPlaylist() {
  videoDraft.playlist_enabled = !videoDraft.playlist_enabled
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

function formatSessionExpiryLabel(value: string | null) {
  if (!value) {
    return 'unbekannt'
  }

  const date = new Date(value)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  const sameDay = date.toDateString() === now.toDateString()

  if (sameDay) {
    return `heute ${date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })} Uhr`
  }

  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  })
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

function getSlideshowDensityOption(value: number) {
  return slideshowDensityOptions.reduce((closest, candidate) => (
    Math.abs(candidate.value - value) < Math.abs(closest.value - value)
      ? candidate
      : closest
  ))
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
        : filter === 'new'
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
      <Transition name="workspace-tab-content" mode="out-in">
        <div :key="activeWorkspaceSection" class="admin-workspace-tab">
          <div class="admin-tab-content-inner">
            <v-row class="admin-workspace">
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
                    <Transition name="mode-panel-content" mode="out-in">
                      <section v-if="isBlackoutMode" key="blackout" class="settings-section">
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

                <section v-else-if="isStandbyMode" key="idle" class="settings-section">
              <div class="settings-group settings-group--sectioned">
                <div class="settings-control">
                  <div class="settings-control__label">Bildschirm</div>
                  <div class="standby-screen-options" role="radiogroup" aria-label="Bildschirm">
                    <button
                      v-for="option in standbyScreenOptions"
                      :key="option.id"
                      type="button"
                      class="standby-screen-card"
                      :class="{
                        'standby-screen-card--active': standbyDraft.screen_variant === option.id,
                        'standby-screen-card--disabled': option.disabled,
                      }"
                      :disabled="isBooting || option.disabled"
                      :aria-checked="standbyDraft.screen_variant === option.id"
                      role="radio"
                      @click="selectStandbyScreenVariant(option.id)"
                    >
                      <div
                        class="standby-screen-card__preview"
                        :class="{
                          'standby-screen-card__preview--standard': option.id === 'standard',
                          'standby-screen-card__preview--spotlight-reveal': option.id === 'spotlight_reveal',
                        }"
                        :style="getStandbyScreenPreviewStyle()"
                        aria-hidden="true"
                      >
                        <div
                          v-if="option.id === 'spotlight_reveal'"
                          class="standby-screen-card__preview-spotlight"
                        >
                          <span class="standby-screen-card__preview-spot" />
                        </div>
                      </div>
                      <div class="standby-screen-card__body">
                        <span class="standby-screen-card__title">{{ option.title }}</span>
                        <div class="standby-screen-card__note">{{ option.note }}</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="settings-subsection settings-subsection--fields">
                  <div class="settings-control">
                    <div class="settings-control__label">Überschrift</div>
                    <v-text-field
                      v-model="standbyDraft.headline"
                      class="admin-text-input"
                      :disabled="isBooting"
                      hide-details
                      variant="solo"
                      density="comfortable"
                      @focus="handleStandbyTextFocus('headline')"
                      @blur="handleStandbyTextBlur"
                    />
                  </div>

                  <div class="settings-control">
                    <div class="settings-control__label">Untertitel</div>
                    <v-text-field
                      v-model="standbyDraft.subheadline"
                      class="admin-text-input"
                      :disabled="isBooting"
                      hide-details
                      variant="solo"
                      density="comfortable"
                      @focus="handleStandbyTextFocus('subheadline')"
                      @blur="handleStandbyTextBlur"
                    />
                  </div>
                </div>
              </div>
                </section>

                <section v-else-if="isVideoMode" key="video" class="settings-section">
              <div class="settings-group">
                <div class="settings-group__label">Videos</div>
                <div
                  class="video-library-entry"
                  role="link"
                  tabindex="0"
                  aria-label="Videoverwaltung öffnen"
                  @click="openVideoManager"
                  @keydown.enter.prevent="openVideoManager"
                  @keydown.space.prevent="openVideoManager"
                >
                  <div class="video-library-entry__body">
                    <div class="video-library-entry__header">
                      <div class="video-library-entry__title">Videos verwalten</div>
                      <v-icon icon="mdi-chevron-right" size="20" class="video-library-entry__chevron" />
                    </div>
                    <div class="video-library-entry__meta">
                      <span>{{ videoLibrarySummaryLabel }}</span>
                      <span aria-hidden="true">·</span>
                      <span>{{ videoLibraryDurationLabel }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="settings-group settings-group--video-section">
                <div class="settings-group__label">Wiedergabe</div>
                <div class="settings-control">
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

                </section>

                <section v-else-if="isSlideshowMode" key="selfie" class="settings-section">
              <div class="settings-group settings-group--menu-stack">
                <div class="settings-control">
                  <div class="settings-control__label">Start nach</div>
                  <v-select
                    v-model="selfieDraft.slideshow_min_uploads_to_start"
                    class="admin-select"
                    :items="slideshowStartAfterOptions"
                    :disabled="isBooting || isSavingSelfie"
                    item-title="label"
                    item-value="value"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>

                <div class="settings-control">
                  <div class="settings-control__label">Einblend-Intervall</div>
                  <v-select
                    v-model="selfieDraft.slideshow_interval_seconds"
                    class="admin-select"
                    :items="slideshowIntervalOptions"
                    :disabled="isBooting || isSavingSelfie"
                    item-title="label"
                    item-value="value"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>

                <div class="settings-control">
                  <div class="settings-control__label">Bühnenfüllung</div>
                  <v-select
                    v-model="selfieDraft.slideshow_max_visible_photos"
                    class="admin-select"
                    :items="slideshowDensityOptions"
                    :disabled="isBooting || isSavingSelfie"
                    item-title="label"
                    item-value="value"
                    hide-details
                    variant="solo"
                    density="comfortable"
                  />
                </div>

                <div class="settings-action settings-control--spaced">
                  <v-btn
                    color="primary"
                    variant="outlined"
                    class="settings-action__button"
                    prepend-icon="mdi-lightning-bolt-outline"
                    :disabled="isBooting || !guestUploadUrl"
                    @click="openGuestQrDialog"
                  >
                    Gäste-Upload QR-Code
                  </v-btn>
                </div>
              </div>
                </section>

                <section v-else-if="isVisualizerMode" key="visualizer" class="settings-section settings-section--field-stack">
	                <div class="settings-group settings-group--menu-stack">
	                <div class="settings-group__label">Visualizer</div>
	                <button
	                  type="button"
	                  class="video-library-entry"
	                  :disabled="isBooting"
	                  @click="openVisualizerManager"
	                  @keydown.enter.prevent="openVisualizerManager"
	                  @keydown.space.prevent="openVisualizerManager"
	                >
	                  <div class="video-library-entry__body">
	                    <div class="video-library-entry__header">
	                      <div class="video-library-entry__title">Stil festlegen</div>
	                      <v-icon icon="mdi-chevron-right" size="20" class="video-library-entry__chevron" />
	                    </div>
	                    <div class="video-library-entry__meta video-library-entry__meta--visualizer">
	                      <span>{{ activeVisualizerPresetLabel }}</span>
                        <span aria-hidden="true">·</span>
                        <span>{{ visualizerSequenceCountLabel }}</span>
	                    </div>
	                  </div>
	                </button>

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
	                <v-expand-transition>
                  <div
                    v-if="visualizerDraft.auto_cycle_enabled"
                    class="settings-control"
                  >
                    <div class="settings-control__label">Stilwechsel</div>
                    <v-select
                      v-model="visualizerDraft.auto_cycle_interval_minutes"
                      class="admin-select"
                      :items="visualizerAutoCycleIntervalOptions"
                      :disabled="isBooting"
                      item-title="title"
                      item-value="value"
                      hide-details
                      variant="solo"
                      density="comfortable"
                    />
                  </div>
                </v-expand-transition>
              </div>

		              <div class="settings-group settings-group--menu-stack">
	                <div class="settings-group__label">Feinjustieren</div>
	                <div class="settings-control">
	                  <div class="settings-control__label">Tempo</div>
	                  <v-select
	                    v-model="visualizerDraft.speed"
	                    class="admin-select"
                    :items="visualizerSpeedOptions"
                    :disabled="isBooting"
                    item-title="title"
                    item-value="value"
                    hide-details
                    variant="solo"
	                    density="comfortable"
	                  />
	                </div>
	                <div class="settings-control">
	                  <div class="settings-control__label">Stärke</div>
	                  <v-select
	                    v-model="visualizerDraft.intensity"
	                    class="admin-select"
                    :items="visualizerIntensityOptions"
                    :disabled="isBooting"
                    item-title="title"
                    item-value="value"
                    hide-details
                    variant="solo"
	                    density="comfortable"
	                  />
	                </div>
	              </div>
                      </section>
                    </Transition>
                  </div>
                </v-col>
              </template>

              <template v-else-if="activeWorkspaceSection === 'system'">
                <v-col
                  cols="12"
                  class="admin-global-settings-col"
                  :class="{ 'admin-global-settings-col--expanded': ambientColorPresetDraft === 'custom' }"
                >
                  <v-card class="workspace-panel system-display-card" variant="flat">
                    <section class="settings-section system-display-card__section">
                      <div class="system-display-card__header">
                        <div class="system-display-card__eyebrow">Darstellung</div>
                      </div>

                      <div class="settings-group">
                        <div class="settings-control">
                          <div class="display-color-presets" role="radiogroup" aria-label="Globale Farbwelt">
                            <button
                              v-for="preset in ambientColorPresets"
                              :key="preset.id"
                              type="button"
                              class="display-color-preset"
                              :class="{ 'display-color-preset--active': ambientColorPresetDraft === preset.id }"
                              :disabled="isBooting || isSavingDisplayTheme"
                              :aria-checked="ambientColorPresetDraft === preset.id"
                              role="radio"
                              @click="selectAmbientColorPreset(preset.id)"
                            >
                              <span
                                class="display-color-preset__swatch"
                                :style="{ background: preset.id === 'custom' ? getAmbientCustomSwatch() : preset.swatch }"
                                aria-hidden="true"
                              >
                                <v-icon
                                  v-if="preset.id === 'custom'"
                                  :icon="preset.icon"
                                  size="12"
                                  class="display-color-preset__icon"
                                />
                              </span>
                              <span class="display-color-preset__label">{{ preset.label }}</span>
                            </button>
                          </div>

                          <v-expand-transition>
                            <div v-if="ambientColorPresetDraft === 'custom'" class="display-color-custom-slider">
                              <div class="display-color-custom-slider__header">
                                <div class="display-color-custom-slider__label">Farbton</div>
                              </div>
                              <v-slider
                                :model-value="ambientColorCustomHueDraft"
                                min="-180"
                                max="180"
                                step="1"
                                hide-details
                                :disabled="isBooting || isSavingDisplayTheme"
                                @update:model-value="handleAmbientCustomHueInput"
                              />
                            </div>
                          </v-expand-transition>
                        </div>
                      </div>
                    </section>
                  </v-card>
                </v-col>

                <v-col cols="12">
                  <SystemSettingsPanel
                    :username="authStore.username || 'admin'"
                    :hostname="systemHostname"
                    :ip-address="systemIpAddress"
                    :network-name="systemNetworkName"
                    :network-state-label="systemNetworkStateLabel"
                    :session-timeout-hours="guestUploadSessionTimeoutHours"
                    :session-timeout-label="uploadControlSessionTimeoutLabel"
                    :session-expires-at-label="systemSessionExpiresAtLabel"
                    :session-is-expired="guestUploadSessionExpired"
                    :setup-mode-enabled="systemStatusStore.setupModeStatus.enabled"
                    :storage-free-label="formatOptionalBytes(systemStatusStore.appliance.storage.free_bytes)"
                    :cpu-load-label="cpuLoadLabel"
                    :memory-percent-label="memoryPercentLabel"
                    :temperature-label="cpuTemperatureLabel"
                    :access-reset-counter="accessResetCounter"
                    :access-saving="isSavingAccess"
                    :security-saving="isSavingSecurity"
                    :is-restarting-system="isRestartingSystem"
                    :is-shutting-down="isShuttingDown"
                    :is-toggling-setup-mode="isTogglingSetupMode"
                    @save-access="saveSystemAccess"
                    @save-session-timeout="({ sessionTimeoutHours }) => updateUploadSettings({ sessionTimeoutHours })"
                    @restart="restartSystem"
                    @shutdown="shutdownSystem"
                    @toggle-setup-mode="toggleSetupMode"
                  />
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
                    <div class="workspace-overview-value workspace-overview-value--counter">{{ uploadSummary.total }}</div>
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
                    <div class="workspace-overview-value workspace-overview-value--counter">{{ pendingCount }}</div>
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
                    <div class="workspace-overview-value workspace-overview-value--counter">{{ rejectedCount }}</div>
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
                    <div class="workspace-overview-value workspace-overview-value--counter">{{ newUploadCount }}</div>
                  </v-card>
                </v-col>

                <v-col cols="12">
                  <Transition name="upload-filter-content" mode="out-in">
                    <section v-if="uploadGalleryFilter === 'all'" key="upload-controls" class="upload-control-panel">
                      <div class="upload-control-list">
                        <button
                          type="button"
                          class="upload-control-row"
                          :class="{
                            'upload-control-row--active': guestUploadEnabled,
                            'upload-control-row--warning': !guestUploadEnabled,
                          }"
                          :disabled="isSavingSecurity"
                          @click="updateUploadSettings({ guestUploadsEnabled: !guestUploadEnabled })"
                        >
                          <span class="upload-control-row__label">Gäste-Upload aktiv</span>
                          <span
                            class="upload-control-row__value"
                            :class="{
                              'upload-control-row__value--active': guestUploadEnabled,
                              'upload-control-row__value--warning': !guestUploadEnabled,
                            }"
                          >
                            {{ guestUploadEnabled ? 'Aktiv' : 'Pausiert' }}
                          </span>
                        </button>

                        <button
                          type="button"
                          class="upload-control-row"
                          :class="{ 'upload-control-row--active': guestUploadRequiresApproval }"
                          :disabled="isSavingSecurity"
                          @click="updateUploadSettings({ approvalRequired: !guestUploadRequiresApproval })"
                        >
                          <span class="upload-control-row__label">Freigabe erforderlich</span>
                          <span class="upload-control-row__value" :class="{ 'upload-control-row__value--active': guestUploadRequiresApproval }">
                            {{ guestUploadRequiresApproval ? 'An' : 'Aus' }}
                          </span>
                        </button>
                      </div>

                      <v-alert v-if="securityError" type="error" variant="tonal" class="upload-control-alert">
                        {{ securityError }}
                      </v-alert>
                    </section>
                    <div v-else key="upload-controls-spacer" class="upload-control-panel upload-control-panel--hidden" aria-hidden="true" />
                  </Transition>
                </v-col>

                <v-col cols="12" class="upload-gallery-col">
                  <section class="upload-gallery-panel">
                    <Transition name="upload-filter-content" mode="out-in">
                      <div :key="uploadGalleryFilter" class="upload-gallery-content">
                        <div v-if="uploads.length" class="v-row upload-gallery-header-row">
                          <div class="v-col cols-12 upload-gallery-header-col">
                            <div class="upload-gallery-header">
                              <div class="upload-gallery-header__title">{{ uploadGalleryTitle }}</div>
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
                          </div>
                        </div>
                        <div
                          v-if="filteredUploadGallery.length"
                          class="v-row upload-gallery-grid"
                        >
                          <v-col v-for="upload in filteredUploadGallery" :key="upload.id" cols="12" sm="6" md="4" xl="3">
                            <div
                              :ref="(element) => setUploadCardObserverRef(upload.id, element)"
                              :data-upload-id="upload.id"
                              class="upload-card-observer"
                            >
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
                      <img
                        v-if="thumbnailUrls[upload.id]"
                        class="upload-preview"
                        :src="thumbnailUrls[upload.id]"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      >
                      <div
                        v-else
                        class="upload-card__fallback upload-card__fallback--loading"
                      >
                        <div class="upload-card__loading-surface" aria-hidden="true">
                          <div class="upload-card__loading-shimmer" />
                          <div class="upload-card__loading-glow" />
                        </div>
                      </div>
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
              </div>
            </v-col>
          </div>

          <div v-if="filteredUploadGallery.length" class="upload-gallery-load-more">
            <div
              :ref="setUploadListSentinel"
              class="upload-gallery-sentinel"
              aria-hidden="true"
            />

            <div v-if="isLoadingMoreUploads" class="upload-gallery-loading">
              <v-progress-circular
                indeterminate
                size="18"
                width="2"
                color="primary"
              />
              <span>Weitere Uploads werden geladen ...</span>
            </div>

            <div v-else-if="uploadListError" class="upload-gallery-loading upload-gallery-loading--error">
              <span>{{ uploadListError }}</span>
              <button type="button" class="upload-gallery-loading__retry" @click="loadMoreUploads">
                Erneut versuchen
              </button>
            </div>
          </div>

          <div v-else class="upload-empty-state">
            <div class="upload-empty-state__icon-shell" aria-hidden="true">
                  <v-icon :icon="uploadEmptyState.icon" size="34" class="upload-empty-state__icon" />
                </div>
                <div class="upload-empty-state__title">{{ uploadEmptyState.title }}</div>
                <div class="upload-empty-state__copy">{{ uploadEmptyState.description }}</div>
              </div>
            </div>
          </Transition>
        </section>
      </v-col>
        </template>
          </v-row>
        </div>
      </div>
      </Transition>
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
  min-height: 100%;
  display: block;
  min-width: 0;
  overflow-x: hidden;
}

.admin-workspace-scroll {
  min-height: 100%;
  overflow: visible;
  box-sizing: border-box;
  padding-top: 0;
  padding-bottom: 0.5rem;
  padding-left: 0.625rem;
  padding-right: 0.625rem;
}

.admin-workspace {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding-bottom: 0;
  min-width: 0;
}

.admin-workspace-tab {
  min-width: 0;
}

.admin-tab-content-inner {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding-inline: 0.375rem;
}

.admin-workspace > :first-child {
  padding-top: 0;
  margin-top: 0;
}

.admin-workspace > .v-col,
.admin-workspace > [class*='v-col-'] {
  padding: 6px;
  min-width: 0;
}

.workspace-tab-content-enter-active,
.workspace-tab-content-leave-active {
  transition:
    opacity 220ms ease,
    transform 240ms ease,
    filter 240ms ease;
}

.workspace-tab-content-enter-from,
.workspace-tab-content-leave-to {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(6px);
}

.workspace-tab-content-leave-active {
  pointer-events: none;
}

.admin-global-settings-col {
  padding-bottom: 0.8rem !important;
}

.admin-global-settings-col--expanded {
  padding-bottom: 1rem !important;
}

.admin-mode-sticky-col {
  padding-top: 0 !important;
  background: transparent;
  backdrop-filter: none;
  isolation: isolate;
}

@media (prefers-reduced-motion: reduce) {
  .workspace-tab-content-enter-active,
  .workspace-tab-content-leave-active {
    transition: none;
  }
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

.mode-panel-content-enter-active,
.mode-panel-content-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms ease,
    filter 200ms ease;
}

.mode-panel-content-enter-from,
.mode-panel-content-leave-to {
  opacity: 0;
  transform: translateY(10px);
  filter: blur(4px);
}

.mode-panel-content-leave-active {
  pointer-events: none;
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
  border-radius: 24px !important;
  border-color: rgba(153, 191, 223, 0.12);
  background:
    radial-gradient(circle at top right, rgba(74, 202, 255, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(14, 23, 35, 0.94), rgba(9, 17, 27, 0.92)) !important;
  box-shadow:
    0 18px 44px rgba(3, 9, 17, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(120, 165, 206, 0.03) !important;
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

.workspace-overview-card--active {
  border-color: rgba(98, 214, 231, 0.28);
  background: rgba(14, 25, 38, 0.92) !important;
  box-shadow:
    0 10px 24px rgba(4, 10, 18, 0.16),
    inset 0 0 0 1px rgba(98, 214, 231, 0.12) !important;
}

.upload-filter-card--active {
  border-color: rgba(94, 211, 244, 0.24);
  background:
    radial-gradient(circle at top right, rgba(94, 211, 244, 0.12), transparent 40%),
    rgba(12, 22, 34, 0.94) !important;
  box-shadow:
    0 18px 44px rgba(3, 9, 17, 0.28),
    0 0 0 1px rgba(94, 211, 244, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
}

.upload-filter-card--active::after {
  opacity: 1;
}

.upload-control-panel {
  display: grid;
  gap: 0.72rem;
  padding: 0.18rem 0.15rem 0.28rem;
}

.upload-control-panel--hidden {
  min-height: 0;
  padding: 0;
  gap: 0;
}

.upload-control-header {
  display: grid;
  gap: 0.18rem;
}

.upload-control-eyebrow {
  color: rgba(194, 211, 228, 0.5);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.upload-control-copy {
  color: rgba(208, 220, 232, 0.58);
  font-size: 0.78rem;
  line-height: 1.35;
}

.upload-control-list {
  display: grid;
  gap: 0.5rem;
}

.upload-control-row {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  min-width: 0;
  min-height: 3rem;
  padding: 0.78rem 0.95rem;
  border-radius: 16px;
  border: 1px solid rgba(156, 189, 218, 0.08);
  background: rgba(10, 17, 26, 0.54);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 180ms ease,
    transform 150ms ease;
}

.upload-control-row:disabled {
  opacity: 0.65;
  cursor: wait;
}

.upload-control-row--active {
  border-color: rgba(74, 213, 187, 0.22);
  background:
    radial-gradient(circle at top right, rgba(63, 204, 165, 0.12), transparent 60%),
    rgba(12, 26, 28, 0.76);
}

.upload-control-row--warning {
  border-color: rgba(255, 183, 77, 0.18);
  background:
    radial-gradient(circle at top right, rgba(255, 176, 77, 0.08), transparent 60%),
    rgba(28, 23, 16, 0.66);
}

.upload-control-row__label {
  min-width: 0;
  color: rgba(236, 242, 249, 0.92);
  font-size: 0.92rem;
  font-weight: 670;
  line-height: 1.2;
}

.upload-control-row__value,
.upload-control-row__select-value {
  flex-shrink: 0;
  color: rgba(194, 209, 223, 0.68);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.2;
}

.upload-control-row__select-value {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.upload-control-row__value--active {
  color: rgba(133, 236, 182, 0.96);
}

.upload-control-row__value--warning {
  color: rgba(255, 202, 132, 0.92);
}

.upload-control-alert {
  margin-top: 0.1rem;
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

.workspace-overview-value--counter {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
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

.status-overview-col {
  padding: 9px !important;
}

.status-overview-card {
  height: 100%;
  min-height: 168px;
  display: flex;
  flex-direction: column;
  padding: 22px 22px 24px !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.03),
    rgba(255, 255, 255, 0.01)
  ) !important;
  backdrop-filter: none;
  box-shadow: none !important;
}

.status-overview-card__header {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.status-overview-card__dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: rgba(133, 154, 177, 0.7);
}

.status-overview-card__title {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}

.status-overview-card__value {
  margin-top: 0.7rem;
  color: rgba(255, 255, 255, 0.96);
  font-size: 1.8rem;
  font-weight: 600;
  line-height: 1.15;
  text-wrap: balance;
}

.status-overview-card__value--compact {
  font-size: 1.45rem;
  line-height: 1.2;
}

.status-overview-card__detail {
  margin-top: auto;
  padding-top: 0.55rem;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.95rem;
  line-height: 1.45;
}

.status-overview-card--success .status-overview-card__dot {
  background: #39d98a;
}

.status-overview-card--warning .status-overview-card__dot {
  background: #f2c14e;
}

.status-overview-card--error .status-overview-card__dot {
  background: #ff6b6b;
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

.upload-gallery-header-row,
.upload-gallery-grid {
  width: 100%;
  min-width: 0;
  margin: 0 !important;
}

.upload-gallery-header-col {
  min-width: 0;
  padding: 0 6px !important;
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
  color: rgba(215, 228, 241, 0.52);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  line-height: 1.2;
  text-transform: uppercase;
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

.upload-gallery-content {
  display: grid;
  gap: 0.45rem;
  width: 100%;
  min-width: 0;
  min-height: inherit;
}

.upload-gallery-grid {
  row-gap: 0;
}

.upload-gallery-grid > .v-col,
.upload-gallery-grid > [class*='v-col-'] {
  min-width: 0;
  padding: 0 6px 1.2rem !important;
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

.settings-group--sectioned {
  gap: 1.65rem;
}

.settings-group--menu-stack {
  gap: 1.18rem;
}

.settings-group--video-section {
  margin-top: 1rem;
}

.settings-subsection {
  display: grid;
  min-width: 0;
}

.settings-subsection--fields {
  gap: 0.72rem;
}

.settings-group--spaced {
  margin-bottom: 0.55rem;
}

.settings-section--field-stack > .settings-group + .settings-group {
  margin-top: 0.92rem;
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

.upload-card-observer {
  height: 100%;
  contain: layout paint style;
  content-visibility: auto;
  contain-intrinsic-size: 420px;
}

.upload-preview {
  display: block;
  width: 100%;
  height: 220px;
  object-fit: cover;
  border-radius: inherit;
}

.upload-card__fallback {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(108, 198, 255, 0.12), transparent 52%),
    linear-gradient(180deg, rgba(12, 24, 38, 0.98), rgba(7, 14, 24, 0.94));
}

.upload-card__fallback--loading {
  height: 220px;
}

.upload-card__loading-surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(11, 20, 31, 0.9), rgba(8, 15, 24, 0.96));
}

.upload-card__loading-shimmer,
.upload-card__loading-glow {
  position: absolute;
  inset: 0;
}

.upload-card__loading-shimmer {
  background:
    linear-gradient(
      110deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.04) 34%,
      rgba(148, 217, 255, 0.16) 50%,
      rgba(255, 255, 255, 0.04) 66%,
      rgba(255, 255, 255, 0) 100%
    );
  transform: translateX(-100%);
  animation: uploadCardShimmer 1.35s ease-in-out infinite;
}

.upload-card__loading-glow {
  background:
    radial-gradient(circle at 20% 24%, rgba(104, 196, 255, 0.12), transparent 28%),
    radial-gradient(circle at 72% 74%, rgba(76, 148, 255, 0.08), transparent 26%);
  opacity: 0.85;
  animation: uploadCardPulse 2.4s ease-in-out infinite;
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

.upload-gallery-load-more {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding-top: 0.45rem;
}

.upload-gallery-sentinel {
  width: 100%;
  height: 1px;
}

.upload-gallery-loading {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2rem;
  color: rgba(203, 217, 231, 0.66);
  font-size: 0.8rem;
  line-height: 1.2;
}

.upload-gallery-loading--error {
  gap: 0.7rem;
  color: rgba(255, 190, 190, 0.88);
}

.upload-gallery-loading__retry {
  appearance: none;
  border: 0;
  background: transparent;
  color: rgba(144, 214, 255, 0.96);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
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

.upload-filter-content-enter-active,
.upload-filter-content-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms ease,
    filter 200ms ease;
}

.upload-filter-content-enter-from,
.upload-filter-content-leave-to {
  opacity: 0;
  transform: translateY(10px);
  filter: blur(4px);
}

.upload-filter-content-leave-active {
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

@keyframes uploadCardShimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

@keyframes uploadCardPulse {
  0%,
  100% {
    opacity: 0.56;
  }

  50% {
    opacity: 0.9;
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
  touch-action: pan-y;
  --settings-slider-accent-start: rgba(74, 218, 238, 0.96);
  --settings-slider-accent-end: rgba(56, 151, 247, 0.94);
  --v-slider-thumb-size: 1.875rem;
  --v-slider-track-size: 0.5rem;
}

:deep(.settings-section .v-slider + .v-slider) {
  margin-top: 0.25rem;
}

:deep(.settings-section .v-input--horizontal) {
  column-gap: 0.8rem;
}

:deep(.settings-section .v-slider .v-input__control) {
  min-height: 2.75rem;
}

:deep(.settings-section .v-slider-track__background),
:deep(.workspace-panel .v-slider-track__background) {
  opacity: 1;
  background:
    linear-gradient(180deg, rgba(22, 33, 47, 0.96), rgba(16, 25, 37, 0.96));
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.03),
    inset 0 -1px 1px rgba(3, 8, 14, 0.34);
}

:deep(.settings-section .v-slider-track__fill),
:deep(.workspace-panel .v-slider-track__fill) {
  background: linear-gradient(90deg, var(--settings-slider-accent-start), var(--settings-slider-accent-end));
  box-shadow:
    0 0 0 1px rgba(94, 216, 255, 0.08),
    0 0 16px rgba(45, 148, 245, 0.16);
}

:deep(.settings-section .v-slider-thumb__surface),
:deep(.workspace-panel .v-slider-thumb__surface) {
  background: #f7fbff;
  border: 1px solid rgba(200, 228, 247, 0.96);
  box-shadow:
    0 8px 18px rgba(4, 10, 18, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  transition:
    box-shadow 160ms ease,
    border-color 140ms ease;
}

:deep(.settings-section .v-slider-thumb__surface::before),
:deep(.workspace-panel .v-slider-thumb__surface::before) {
  display: none;
}

:deep(.settings-section .v-slider-thumb--focused .v-slider-thumb__surface),
:deep(.workspace-panel .v-slider-thumb--focused .v-slider-thumb__surface),
:deep(.settings-section .v-slider-thumb--pressed .v-slider-thumb__surface),
:deep(.workspace-panel .v-slider-thumb--pressed .v-slider-thumb__surface) {
  border-color: rgba(232, 245, 255, 1);
  box-shadow:
    0 10px 22px rgba(4, 10, 18, 0.28),
    0 0 0 2px rgba(94, 216, 255, 0.12);
}

.settings-control--spaced {
  margin-top: 0.32rem;
}

.standby-screen-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.standby-screen-card {
  appearance: none;
  border: 1px solid rgba(167, 196, 224, 0.12);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(13, 20, 30, 0.9), rgba(9, 15, 23, 0.96));
  min-height: 8.2rem;
  padding: 0.45rem;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.4rem;
  text-align: left;
  transition:
    border-color 150ms ease,
    box-shadow 180ms ease,
    background-color 150ms ease,
    transform 150ms ease;
}

.standby-screen-card:disabled {
  opacity: 0.6;
}

.standby-screen-card--disabled {
  cursor: not-allowed;
}

.standby-screen-card__preview {
  position: relative;
  min-height: 4.85rem;
  border-radius: 10px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 18%, var(--standby-preview-color-a), transparent 34%),
    radial-gradient(circle at 52% 54%, var(--standby-preview-color-b), transparent 52%),
    linear-gradient(180deg, rgba(9, 20, 34, 0.96), rgba(5, 11, 20, 0.98));
  filter:
    saturate(var(--standby-preview-saturation, 1))
    brightness(var(--standby-preview-brightness, 1));
  opacity: var(--standby-preview-opacity, 1);
}

.standby-screen-card__preview::before,
.standby-screen-card__preview::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.standby-screen-card__preview::before {
  background:
    radial-gradient(circle at 50% 14%, var(--standby-preview-color-a-strong), transparent 26%),
    radial-gradient(circle at 28% 78%, rgba(18, 38, 64, 0.42), transparent 40%),
    radial-gradient(circle at 76% 72%, var(--standby-preview-color-b), transparent 42%);
  filter: blur(16px);
  opacity: 0.92;
}

.standby-screen-card__preview::after {
  inset: -8%;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.1), transparent 18%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 32%, rgba(0, 0, 0, 0.18) 100%);
  filter: blur(18px);
  opacity: 0.78;
}

.standby-screen-card__preview--standard {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 26px rgba(5, 11, 20, 0.2);
}

.standby-screen-card__preview--standard {
  --ghost-top: 38%;
  --ghost-bottom: 56%;
}

.standby-screen-card__preview--standard::before {
  background:
    radial-gradient(circle at 50% 16%, var(--standby-preview-color-a-strong), transparent 24%),
    radial-gradient(circle at 54% 56%, var(--standby-preview-color-b-strong), transparent 46%),
    linear-gradient(180deg, transparent 0%, transparent 100%);
}

.standby-screen-card__preview--standard::after {
  background:
    radial-gradient(circle at 50% 12%, rgba(255, 255, 255, 0.12), transparent 16%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 30%, rgba(0, 0, 0, 0.14) 100%),
    linear-gradient(90deg, transparent 22%, rgba(243, 248, 255, 0.12) 38%, rgba(243, 248, 255, 0.18) 50%, rgba(243, 248, 255, 0.12) 62%, transparent 78%),
    linear-gradient(90deg, transparent 18%, rgba(200, 216, 236, 0.1) 35%, rgba(200, 216, 236, 0.14) 50%, rgba(200, 216, 236, 0.1) 65%, transparent 82%);
  background-size:
    auto,
    auto,
    100% 0.54rem,
    100% 0.32rem;
  background-position:
    center,
    center,
    center var(--ghost-top),
    center var(--ghost-bottom);
  background-repeat: no-repeat;
  filter: blur(12px);
  opacity: 0.82;
}

.standby-screen-card__preview--spotlight-reveal {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.02),
    0 8px 18px rgba(4, 10, 18, 0.14);
}

.standby-screen-card__preview--spotlight-reveal::before {
  background:
    radial-gradient(circle at 50% 78%, rgba(16, 28, 42, 0.2), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.01), transparent 30%, rgba(0, 0, 0, 0.18) 100%);
  filter: blur(16px);
  opacity: 0.66;
}

.standby-screen-card__preview--spotlight-reveal::after {
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.025), transparent 18%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 30%, rgba(0, 0, 0, 0.22) 100%);
  filter: blur(16px);
  opacity: 0.54;
}

.standby-screen-card__preview-spotlight {
  position: absolute;
  inset: 0;
}

.standby-screen-card__preview-spot {
  position: absolute;
  top: 22%;
  left: 22%;
  width: 44%;
  height: 42%;
  border-radius: 58% 42% 54% 46% / 44% 56% 46% 54%;
  transform: rotate(-8deg);
  filter: blur(6px);
  mix-blend-mode: screen;
  background:
    radial-gradient(ellipse at 48% 50%, rgba(248, 252, 255, 0.44) 0%, rgba(194, 230, 255, 0.2) 20%, rgba(92, 174, 255, 0.08) 38%, transparent 72%);
  opacity: 0.9;
}

.standby-screen-card__body {
  display: grid;
  gap: 0.12rem;
}

.standby-screen-card__title {
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.2;
}

.standby-screen-card__note {
  color: rgba(194, 208, 223, 0.58);
  font-size: 0.66rem;
  line-height: 1.2;
}

.standby-screen-card--active {
  border-color: rgba(101, 215, 255, 0.52);
  background:
    linear-gradient(180deg, rgba(17, 29, 42, 0.98), rgba(11, 18, 27, 0.98));
  box-shadow:
    0 0 0 1px rgba(94, 216, 255, 0.18),
    0 8px 18px rgba(7, 16, 28, 0.1);
  transform: scale(1.012);
}

.display-color-presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.display-color-preset {
  appearance: none;
  border: 1px solid rgba(167, 196, 224, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  min-height: 2.85rem;
  padding: 0.56rem 0.72rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.55rem;
  transition:
    border-color 150ms ease,
    box-shadow 180ms ease,
    background-color 150ms ease,
    transform 150ms ease;
  text-align: left;
}

.display-color-preset:disabled {
  opacity: 0.6;
}

.display-color-preset__swatch {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 3px 8px rgba(4, 10, 18, 0.16);
}

.display-color-preset__icon {
  color: rgba(247, 251, 255, 0.96);
  filter: drop-shadow(0 1px 3px rgba(6, 12, 20, 0.2));
}

.display-color-preset__label {
  color: rgba(221, 232, 243, 0.74);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.1;
  text-align: left;
}

.display-color-preset--active {
  border-color: rgba(101, 215, 255, 0.28);
  background:
    linear-gradient(180deg, rgba(18, 30, 43, 0.94), rgba(12, 20, 30, 0.96)),
    rgba(79, 198, 255, 0.05);
  box-shadow:
    0 0 0 1px rgba(94, 216, 255, 0.12),
    0 6px 16px rgba(8, 18, 30, 0.12);
}

.display-color-preset--active .display-color-preset__label {
  color: rgba(245, 250, 255, 0.96);
}

.display-color-custom-slider {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.14rem;
  padding: 0.28rem 0.05rem 0.02rem;
}

.display-color-custom-slider__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.display-color-custom-slider__label {
  color: rgba(221, 231, 241, 0.74);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.2;
}

.system-display-card {
  position: relative;
  overflow: hidden;
  padding: 1.15rem !important;
  border-radius: 24px !important;
  border: 1px solid rgba(153, 191, 223, 0.12) !important;
  background:
    radial-gradient(circle at top right, rgba(74, 202, 255, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(14, 23, 35, 0.94), rgba(9, 17, 27, 0.92)) !important;
  box-shadow:
    0 18px 44px rgba(3, 9, 17, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 0 1px rgba(120, 165, 206, 0.03) !important;
}

.system-display-card::after {
  display: none;
}

.system-display-card__section {
  gap: 0.55rem;
}

.system-display-card__header {
  display: grid;
  gap: 0.22rem;
  margin-bottom: 0.2rem;
}

.system-display-card__eyebrow {
  color: rgba(215, 228, 241, 0.52);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.system-display-card__description {
  color: rgba(206, 219, 232, 0.58);
  font-size: 0.82rem;
  line-height: 1.4;
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

.video-upload-status {
  display: grid;
  gap: 0.35rem;
}

.video-library-entry {
  display: grid;
  gap: 0.55rem;
  padding: 0.72rem 0.8rem;
  border-radius: 18px;
  border: 1px solid rgba(126, 189, 226, 0.12);
  background:
    radial-gradient(circle at top right, rgba(86, 209, 255, 0.08), transparent 36%),
    rgba(13, 22, 33, 0.72);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 150ms ease,
    box-shadow 180ms ease;
  cursor: pointer;
}

.video-library-entry:hover {
  border-color: rgba(102, 215, 231, 0.24);
  background:
    radial-gradient(circle at top right, rgba(86, 209, 255, 0.12), transparent 40%),
    rgba(14, 24, 36, 0.82);
  box-shadow:
    0 14px 28px rgba(5, 12, 20, 0.18),
    inset 0 0 0 1px rgba(102, 215, 231, 0.06);
}

.video-library-entry:focus-visible {
  outline: none;
  border-color: rgba(102, 215, 231, 0.32);
  box-shadow:
    0 0 0 1px rgba(102, 215, 231, 0.16),
    0 14px 28px rgba(5, 12, 20, 0.18);
}

.video-library-entry__body {
  min-width: 0;
  display: grid;
  gap: 0.26rem;
}

.video-library-entry__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
}

.video-library-entry__title {
  color: rgba(245, 249, 255, 0.96);
  font-size: 0.92rem;
  font-weight: 720;
  line-height: 1.2;
}

.video-library-entry__chevron {
  color: rgba(154, 198, 231, 0.62);
}

.video-library-entry__copy {
  color: rgba(205, 218, 231, 0.66);
  font-size: 0.78rem;
  line-height: 1.36;
  max-width: 34rem;
}

.video-library-entry__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.24rem;
  align-items: center;
  color: rgba(255, 191, 122, 0.84);
  font-size: 0.71rem;
  font-weight: 650;
  line-height: 1.2;
}

.video-library-entry__meta--visualizer {
  color: rgba(137, 189, 255, 0.84);
}

@media (max-width: 959px) {
  .admin-tab-content-inner {
    padding-inline: 0.25rem;
  }

  .admin-workspace-scroll {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .status-overview-col {
    padding: 9px !important;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

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

  .settings-group--sectioned {
    gap: 1.55rem;
  }

  .settings-group--menu-stack {
    gap: 1.05rem;
  }

  .settings-group--video-section {
    margin-top: 0.88rem;
  }

  .settings-subsection--fields {
    gap: 0.68rem;
  }

  .settings-group--spaced {
    margin-bottom: 0.5rem;
  }

  .settings-section--field-stack > .settings-group + .settings-group {
    margin-top: 0.82rem;
  }

  .standby-screen-options {
    gap: 0.5rem;
  }

  .admin-global-display-col {
    padding-bottom: 0.9rem !important;
  }

  .admin-global-display-col--expanded {
    padding-bottom: 1.25rem !important;
  }

  .standby-screen-card {
    padding: 0.42rem;
    min-height: 7.7rem;
  }

  .standby-screen-card__preview {
    min-height: 4.45rem;
  }

  .display-color-presets {
    gap: 0.45rem;
  }

  .display-color-preset {
    min-height: 2.7rem;
    padding-inline: 0.62rem;
  }

  .display-color-preset__swatch {
    width: 0.98rem;
    height: 0.98rem;
  }

  .display-color-custom-slider {
    margin-top: 0.1rem;
  }

  :deep(.settings-section .v-slider) {
    --v-slider-thumb-size: 2rem;
    --v-slider-track-size: 0.625rem;
    padding-block: 0.08rem;
  }

  :deep(.settings-section .v-slider .v-input__control) {
    min-height: 3rem;
  }

  :deep(.settings-section .v-slider-track__background),
  :deep(.workspace-panel .v-slider-track__background) {
    background: rgba(103, 124, 147, 0.3);
  }

  :deep(.settings-section .v-slider-thumb__surface),
  :deep(.workspace-panel .v-slider-thumb__surface) {
    box-shadow:
      0 9px 20px rgba(4, 10, 18, 0.28),
      0 0 0 1px rgba(255, 255, 255, 0.06);
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

  .video-library-entry {
    padding: 0.7rem 0.72rem;
  }
}
</style>
