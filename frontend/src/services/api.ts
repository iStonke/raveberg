export type AppMode = 'visualizer' | 'selfie' | 'video' | 'blackout' | 'idle'
export type UserRole = 'admin' | 'guest'
export type ModerationMode = 'auto_approve' | 'manual_approve'
export type UploadModerationStatus = 'pending' | 'approved' | 'rejected'
export type VideoPlaybackOrder = 'upload_order' | 'random'
export type VideoObjectFit = 'contain' | 'cover'
export type VideoTransition = 'none' | 'fade'
export type OverlayMode = 'logo' | 'qr' | 'off'
export type RemoteVisualizerFallback = 'local' | 'none'
export type DisplayRenderMode = 'local' | 'remote_headless'
export type RemoteRendererFallback = 'local' | 'notice'
export type AmbientColorPreset = 'blue' | 'cyan' | 'violet' | 'custom'
export type HydraQuality = 'low' | 'medium' | 'high'
export type HydraPaletteMode = 'auto' | 'neon' | 'warm' | 'cold' | 'acid'

export interface SessionUser {
  id: number
  username: string
  role: UserRole
}

export interface HealthResponse {
  status: string
  app: string
  environment: string
}

export interface ModeResponse {
  mode: AppMode
  source: string
  updated_at: string | null
}

export interface SystemInfoResponse {
  app_name: string
  environment: string
  default_mode: AppMode
  video_upload_max_bytes: number
  status: {
    backend_reachable: boolean
    db_reachable: boolean
    internet_reachable: boolean
    upload_count: number
    current_mode: AppMode
    moderation_mode: ModerationMode
    display_target: string
    display_live_connected: boolean
    display_state_stale: boolean
    slideshow_enabled: boolean
    video_playlist_enabled: boolean
    visualizer_auto_cycle_enabled: boolean
    rate_limit_trigger_count: number
    last_rate_limit_at: string | null
    last_cleanup_at: string | null
    last_cleanup_removed: number
    last_display_heartbeat_at: string | null
    last_display_state_sync_at: string | null
  }
  network_status: NetworkStatus
  setup_mode_status: SetupModeStatus
  telemetry: {
    cpu_load_percent: number | null
    memory_used_bytes: number | null
    memory_total_bytes: number | null
    memory_percent: number | null
    cpu_temperature_celsius: number | null
    fan_active: boolean | null
    fan_rpm: number | null
  }
  storage: {
    app_data_path: string
    uploads_path: string
    display_cache_path: string
  }
  appliance: {
    event_name: string
    event_tagline: string
    display_overlay_enabled: boolean
    remote_visualizer_enabled: boolean
    remote_visualizer_url: string
    remote_visualizer_reconnect_ms: number
    remote_visualizer_fallback: RemoteVisualizerFallback
    ambient_color_preset: AmbientColorPreset
    ambient_color_custom_hue_degrees: number
    display_render_mode: DisplayRenderMode
    remote_renderer_base_url: string
    remote_renderer_output_path: string
    remote_renderer_health_url: string
    remote_renderer_reconnect_ms: number
    remote_renderer_fallback: RemoteRendererFallback
    urls: {
      base_url: string
      guest_upload_url: string
      admin_url: string
      display_url: string
      kiosk_start_url: string
    }
    network: {
      appliance_mode: boolean
      ap_enabled: boolean
      ap_ssid: string
      ap_address: string
      local_hostname: string
    }
    storage: {
      free_bytes: number | null
      total_bytes: number | null
    }
  }
}

export interface PublicRuntimeInfoResponse {
  app_name: string
  event_name: string
  event_tagline: string
  display_overlay_enabled: boolean
  remote_visualizer_enabled: boolean
  remote_visualizer_url: string
  remote_visualizer_reconnect_ms: number
  remote_visualizer_fallback: RemoteVisualizerFallback
  ambient_color_preset: AmbientColorPreset
  ambient_color_custom_hue_degrees: number
  display_render_mode: DisplayRenderMode
  remote_renderer_base_url: string
  remote_renderer_output_path: string
  remote_renderer_health_url: string
  remote_renderer_reconnect_ms: number
  remote_renderer_fallback: RemoteRendererFallback
  moderation_mode: ModerationMode
  guest_upload_enabled: boolean
  guest_upload_requires_approval: boolean
  guest_upload_session_timeout_hours: number
  session_expires_at: string
  session_is_expired: boolean
  upload_max_bytes: number
  video_upload_max_bytes: number
  urls: {
    base_url: string
    guest_upload_url: string
    admin_url: string
    display_url: string
    kiosk_start_url: string
  }
  network: {
    appliance_mode: boolean
    ap_enabled: boolean
    ap_ssid: string
    ap_address: string
    local_hostname: string
  }
}

export interface SystemActionResponse {
  message: string
  pending: boolean
  network_status: NetworkStatus | null
  setup_mode_status: SetupModeStatus | null
}

export interface GuestUploadConfig {
  guest_upload_enabled: boolean
  guest_upload_requires_approval: boolean
  guest_upload_session_timeout_hours: number
  session_started_at: string
  session_expires_at: string
  session_is_expired: boolean
  updated_at: string | null
}

export interface GuestUploadConfigUpdatePayload {
  guest_upload_enabled: boolean
  guest_upload_requires_approval: boolean
  guest_upload_session_timeout_hours: number
}

export interface WifiConnectPayload {
  ssid: string
  password: string
}

export interface WifiScanResult {
  ssid: string
  signal: number
  security: string
  active: boolean
}

export interface NetworkStatus {
  online: boolean
  connected: boolean
  ssid: string | null
  ip: string | null
  signal_percent: number | null
  signal_bars: number
  setup_mode: boolean
  network_mode: 'normal' | 'setup'
}

export interface SetupModeStatus {
  enabled: boolean
  ssid: string
  ip: string
  portal_url: string
  last_error: string | null
  connect_state: 'idle' | 'pending' | 'failed' | 'succeeded'
  connecting_to_ssid: string | null
  last_transition_at: string | null
}

export interface RuntimeConfig {
  remote_visualizer_enabled: boolean
  remote_visualizer_url: string
  remote_visualizer_reconnect_ms: number
  remote_visualizer_fallback: RemoteVisualizerFallback
  ambient_color_preset: AmbientColorPreset
  ambient_color_custom_hue_degrees: number
  display_render_mode: DisplayRenderMode
  remote_renderer_base_url: string
  remote_renderer_output_path: string
  remote_renderer_health_url: string
  remote_renderer_reconnect_ms: number
  remote_renderer_fallback: RemoteRendererFallback
}

export interface SelfiePlaybackEvent {
  action: 'next' | 'reload_pool'
  sequence: number
  issued_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: SessionUser
}

export interface AdminAccessUpdatePayload {
  username: string
  current_password: string
  new_password: string
}

export interface AdminAccessUpdateResponse {
  message: string
  user: SessionUser
}

export interface UploadItem {
  id: number
  filename_original: string
  filename_display: string | null
  mime_type: string
  size: number
  comment: string | null
  created_at: string
  status: 'uploaded' | 'processed' | 'error'
  moderation_status: UploadModerationStatus
  approved: boolean
  display_url: string | null
  admin_display_url: string | null
}

export interface AdminUploadListSummary {
  total: number
  pending: number
  rejected: number
}

export interface AdminUploadListResponse {
  items: UploadItem[]
  total: number
  has_more: boolean
  offset: number
  limit: number
  summary: AdminUploadListSummary
}

export interface SelfieState {
  slideshow_enabled: boolean
  slideshow_interval_seconds: number
  slideshow_max_visible_photos: number
  slideshow_min_uploads_to_start: number
  slideshow_shuffle: boolean
  overlay_mode: OverlayMode
  vintage_look_enabled: boolean
  moderation_mode: ModerationMode
  slideshow_updated_at: string | null
}

export interface StandbyState {
  screen_variant: 'standard' | 'blackout'
  headline: string
  subheadline: string
  hue_shift_degrees: number
  updated_at: string | null
}

export interface VideoAsset {
  id: number
  filename_original: string
  mime_type: string
  size: number
  position: number
  created_at: string
  stream_url: string
}

export interface VideoState {
  playlist_enabled: boolean
  loop_enabled: boolean
  playback_order: VideoPlaybackOrder
  vintage_filter_enabled: boolean
  overlay_mode: OverlayMode
  object_fit: VideoObjectFit
  transition: VideoTransition
  active_video_id: number | null
  loop_video_id: number | null
  updated_at: string | null
}

export type VisualizerPreset =
  | 'particles'
  | 'kaleidoscope'
  | 'warehouse'
  | 'storm_lightning'
  | 'retro_cube'
  | 'retro_pipes'
  | 'dvd_bounce'
  | 'matrix_screen'
  | 'nebel'
  | 'vanta_halo'
  | 'hydra_rave'
  | 'hydra_chromaflow'
export type ColorScheme = 'mono' | 'acid' | 'ultraviolet' | 'redline'

export interface VisualizerState {
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
  auto_cycle_interval_seconds: number
  updated_at: string | null
}

export interface VisualizerOptionsResponse {
  presets: VisualizerPreset[]
  color_schemes: ColorScheme[]
  hydra_qualities: HydraQuality[]
  hydra_palette_modes: HydraPaletteMode[]
}

export interface VisualizerPresetOrderResponse {
  presets: VisualizerPreset[]
  skipped_presets: VisualizerPreset[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {})
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(parseErrorMessage(message, response.status))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function parseErrorMessage(message: string, status: number) {
  if (status === 413) {
    return 'Die Datei ist zu groß. Bitte wähle eine kleinere Datei.'
  }

  if (!message) {
    return `Request failed with ${status}`
  }

  if (looksLikeHtml(message)) {
    return fallbackMessageForStatus(status)
  }

  try {
    const parsed = JSON.parse(message) as { detail?: unknown }
    return humanizeApiErrorMessage(formatApiErrorDetail(parsed.detail) ?? message, status)
  } catch {
    return humanizeApiErrorMessage(looksLikeHtml(message) ? fallbackMessageForStatus(status) : message, status)
  }
}

function humanizeApiErrorMessage(message: string, status: number) {
  if (/No restart command available/i.test(message)) {
    return 'Neustart ist auf diesem Gerät derzeit nicht verfügbar.'
  }
  if (/No shutdown command available/i.test(message)) {
    return 'Ausschalten ist auf diesem Gerät derzeit nicht verfügbar.'
  }

  return message || fallbackMessageForStatus(status)
}

function looksLikeHtml(message: string) {
  const sample = message.trim().slice(0, 256).toLowerCase()
  return sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.includes('<head>') || sample.includes('<body>')
}

function fallbackMessageForStatus(status: number) {
  if (status === 400) {
    return 'Die Anfrage konnte nicht verarbeitet werden.'
  }
  if (status === 401) {
    return 'Die Sitzung ist abgelaufen. Bitte neu anmelden.'
  }
  if (status === 403) {
    return 'Diese Aktion ist aktuell nicht erlaubt.'
  }
  if (status === 404) {
    return 'Der angeforderte Dienst wurde nicht gefunden.'
  }
  if (status >= 500) {
    return 'Der Server antwortet gerade nicht korrekt. Bitte gleich noch einmal versuchen.'
  }

  return `Request failed with ${status}`
}

function formatApiErrorDetail(detail: unknown): string | null {
  if (detail == null) {
    return null
  }

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => formatApiErrorEntry(entry))
      .filter((entry): entry is string => Boolean(entry))

    return messages.length ? messages.join(' | ') : 'Validation failed'
  }

  if (typeof detail === 'object') {
    return formatApiErrorEntry(detail) ?? 'Request failed'
  }

  return String(detail)
}

function formatApiErrorEntry(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') {
    return typeof entry === 'string' ? entry : null
  }

  const candidate = entry as {
    msg?: unknown
    loc?: unknown
    detail?: unknown
  }

  if (typeof candidate.msg === 'string') {
    const location = Array.isArray(candidate.loc)
      ? candidate.loc.filter((item) => typeof item === 'string' || typeof item === 'number').join('.')
      : null
    return location ? `${location}: ${candidate.msg}` : candidate.msg
  }

  if (typeof candidate.detail === 'string') {
    return candidate.detail
  }

  try {
    return JSON.stringify(entry)
  } catch {
    return 'Request failed'
  }
}

function withAuth(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export function fetchHealth() {
  return request<HealthResponse>('/api/health')
}

export function fetchMode() {
  return request<ModeResponse>('/api/mode')
}

export function updateMode(mode: AppMode, token: string) {
  return request<ModeResponse>('/api/mode', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify({ mode }),
  })
}

export function fetchSystemInfo(token: string) {
  return request<SystemInfoResponse>('/api/system', {
    headers: withAuth(token),
  })
}

export function triggerSystemShutdown(token: string) {
  return request<SystemActionResponse>('/api/system/shutdown', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function triggerSystemRestart(token: string) {
  return request<SystemActionResponse>('/api/system/restart', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function connectWifi(payload: WifiConnectPayload, token: string) {
  return request<SystemActionResponse>('/api/system/wifi/connect', {
    method: 'POST',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function connectWifiFromSetup(payload: WifiConnectPayload) {
  return request<SystemActionResponse>('/api/system/wifi/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchWifiScan(token?: string) {
  return request<WifiScanResult[]>('/api/system/wifi/scan', {
    headers: token ? withAuth(token) : undefined,
  })
}

export function fetchNetworkStatus(token?: string) {
  return request<NetworkStatus>('/api/system/network-status', {
    headers: token ? withAuth(token) : undefined,
  })
}

export function fetchSetupModeStatus(token?: string) {
  return request<SetupModeStatus>('/api/system/setup-mode/status', {
    headers: token ? withAuth(token) : undefined,
  })
}

export function startSetupMode(token: string) {
  return request<SystemActionResponse>('/api/system/setup-mode/start', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function stopSetupMode(token?: string) {
  return request<SystemActionResponse>('/api/system/setup-mode/stop', {
    method: 'POST',
    headers: token ? withAuth(token) : undefined,
  })
}

export function fetchPublicRuntimeInfo() {
  return request<PublicRuntimeInfoResponse>('/api/public-info')
}

export function fetchGuestUploadConfig(token: string) {
  return request<GuestUploadConfig>('/api/system/guest-upload-config', {
    headers: withAuth(token),
  })
}

export function updateGuestUploadConfig(payload: GuestUploadConfigUpdatePayload, token: string) {
  return request<GuestUploadConfig>('/api/system/guest-upload-config', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function fetchRuntimeConfig(token: string) {
  return request<RuntimeConfig>('/api/system/runtime-config', {
    headers: withAuth(token),
  })
}

export function updateRuntimeConfig(payload: RuntimeConfig, token: string) {
  return request<RuntimeConfig>('/api/system/runtime-config', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function loginAdmin(username: string, password: string) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchSession(token: string) {
  return request<LoginResponse>('/api/auth/session', {
    headers: withAuth(token),
  })
}

export function logoutAdmin(token: string) {
  return request<void>('/api/auth/logout', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function updateAdminAccess(payload: AdminAccessUpdatePayload, token: string) {
  return request<AdminAccessUpdateResponse>('/api/auth/account', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function fetchPublicUploads(limit = 100) {
  return request<UploadItem[]>(`/api/uploads?limit=${limit}`)
}

export function fetchAdminUploads(
  token: string,
  options: {
    limit?: number
    offset?: number
    moderationStatus?: UploadModerationStatus
    ids?: number[]
  } = {},
) {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 12))
  params.set('offset', String(options.offset ?? 0))
  if (options.moderationStatus) {
    params.set('moderation_status', options.moderationStatus)
  }
  for (const id of options.ids ?? []) {
    params.append('ids', String(id))
  }

  return request<AdminUploadListResponse>(`/api/uploads/admin?${params.toString()}`, {
    headers: withAuth(token),
  })
}

export async function downloadAdminUploadArchive(uploadIds: number[], token: string) {
  const params = new URLSearchParams()
  uploadIds.forEach((id) => {
    params.append('ids', String(id))
  })

  const response = await fetch(`/api/uploads/admin/archive?${params.toString()}`, {
    headers: withAuth(token),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(parseErrorMessage(body, response.status))
  }

  return response.blob()
}

export function fetchPublicVideos() {
  return request<VideoAsset[]>('/api/videos')
}

export function fetchAdminVideos(token: string) {
  return request<VideoAsset[]>('/api/videos/admin', {
    headers: withAuth(token),
  })
}

export function triggerSelfieNext(token: string) {
  return request<SelfiePlaybackEvent>('/api/selfie/actions/next', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function triggerSelfieReload(token: string) {
  return request<SelfiePlaybackEvent>('/api/selfie/actions/reload', {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function approveUpload(uploadId: number, token: string) {
  return request<UploadItem>(`/api/uploads/${uploadId}/approve`, {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function rejectUpload(uploadId: number, token: string) {
  return request<UploadItem>(`/api/uploads/${uploadId}/reject`, {
    method: 'POST',
    headers: withAuth(token),
  })
}

export function deleteUpload(uploadId: number, token: string) {
  return request<void>(`/api/uploads/${uploadId}`, {
    method: 'DELETE',
    headers: withAuth(token),
  })
}

export function uploadGuestImage(
  file: File,
  comment?: string | null,
  onProgress?: (progress: number) => void,
) {
  return new Promise<UploadItem>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)
    if (comment && comment.trim()) {
      formData.append('comment', comment.trim())
    }

    xhr.open('POST', '/api/uploads')
    xhr.responseType = 'text'

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const body = xhr.responseText || ''
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(body) as UploadItem)
        return
      }
      reject(new Error(parseErrorMessage(body, xhr.status)))
    }

    xhr.onerror = () => {
      reject(new Error('Upload failed'))
    }

    xhr.send(formData)
  })
}

export function fetchVisualizerState() {
  return request<VisualizerState>('/api/visualizer')
}

export function fetchSelfieState() {
  return request<SelfieState>('/api/selfie')
}

export function fetchStandbyState() {
  return request<StandbyState>('/api/standby')
}

export function fetchVideoState() {
  return request<VideoState>('/api/video')
}

export function sendDisplayHeartbeat(payload: {
  current_mode: AppMode
  renderer_label: string
  sse_connected: boolean
  last_state_sync_at: string | null
}) {
  return request('/api/display/heartbeat', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchVisualizerOptions() {
  return request<VisualizerOptionsResponse>('/api/visualizer/presets')
}

export function fetchVisualizerPresetOrder(token: string) {
  return request<VisualizerPresetOrderResponse>('/api/visualizer/order', {
    headers: withAuth(token),
  })
}

export function updateSelfieState(payload: Omit<SelfieState, 'slideshow_updated_at'>, token: string) {
  return request<SelfieState>('/api/selfie', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function updateStandbyState(payload: Omit<StandbyState, 'updated_at'>, token: string) {
  return request<StandbyState>('/api/standby', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function updateVideoState(payload: Omit<VideoState, 'updated_at'>, token: string) {
  return request<VideoState>('/api/video', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function reorderVideoAssets(ids: number[], token: string) {
  return request<VideoAsset[]>('/api/videos/reorder', {
    method: 'POST',
    headers: withAuth(token),
    body: JSON.stringify({ ids }),
  })
}

export function deleteVideoAsset(videoId: number, token: string) {
  return request<void>(`/api/videos/${videoId}`, {
    method: 'DELETE',
    headers: withAuth(token),
  })
}

export function uploadAdminVideo(file: File, token: string, onProgress?: (progress: number) => void) {
  return new Promise<VideoAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.open('POST', '/api/videos')
    xhr.responseType = 'text'
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const body = xhr.responseText || ''
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(body) as VideoAsset)
        return
      }
      reject(new Error(parseErrorMessage(body, xhr.status)))
    }

    xhr.onerror = () => {
      reject(new Error('Video-Upload fehlgeschlagen'))
    }

    xhr.send(formData)
  })
}

export function updateVisualizerState(payload: Omit<VisualizerState, 'updated_at'>, token: string) {
  return request<VisualizerState>('/api/visualizer', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify(payload),
  })
}

export function updateVisualizerPresetOrder(
  presets: VisualizerPreset[],
  skippedPresets: VisualizerPreset[],
  token: string,
) {
  return request<VisualizerPresetOrderResponse>('/api/visualizer/order', {
    method: 'PUT',
    headers: withAuth(token),
    body: JSON.stringify({ presets, skipped_presets: skippedPresets }),
  })
}
