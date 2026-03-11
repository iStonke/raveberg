export type AppMode = 'visualizer' | 'selfie' | 'video' | 'blackout' | 'idle'
export type UserRole = 'admin' | 'guest'
export type ModerationMode = 'auto_approve' | 'manual_approve'
export type UploadModerationStatus = 'pending' | 'approved' | 'rejected'
export type VideoPlaybackOrder = 'upload_order' | 'random'
export type VideoObjectFit = 'contain' | 'cover'
export type VideoTransition = 'none' | 'fade'
export type OverlayMode = 'logo' | 'qr' | 'off'

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
  telemetry: {
    cpu_load_percent: number | null
    memory_used_bytes: number | null
    memory_total_bytes: number | null
    memory_percent: number | null
    cpu_temperature_celsius: number | null
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
  moderation_mode: ModerationMode
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
  updated_at: string | null
}

export type VisualizerPreset =
  | 'particles'
  | 'kaleidoscope'
  | 'warehouse'
  | 'swarm_collision'
  | 'vanta_fog'
  | 'vanta_halo'
  | 'hydra_rave'
  | 'particle_swarm'
export type ColorScheme = 'mono' | 'acid' | 'ultraviolet' | 'redline'

export interface VisualizerState {
  active_preset: VisualizerPreset
  intensity: number
  speed: number
  brightness: number
  color_scheme: ColorScheme
  overlay_mode: OverlayMode
  auto_cycle_enabled: boolean
  auto_cycle_interval_seconds: number
  updated_at: string | null
}

export interface VisualizerOptionsResponse {
  presets: VisualizerPreset[]
  color_schemes: ColorScheme[]
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
  if (!message) {
    return `Request failed with ${status}`
  }

  try {
    const parsed = JSON.parse(message) as { detail?: unknown }
    return formatApiErrorDetail(parsed.detail) ?? message
  } catch {
    return message
  }
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

export function fetchPublicRuntimeInfo() {
  return request<PublicRuntimeInfoResponse>('/api/public-info')
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

export function fetchPublicUploads(limit = 100) {
  return request<UploadItem[]>(`/api/uploads?limit=${limit}`)
}

export function fetchAdminUploads(token: string, limit = 20) {
  return request<UploadItem[]>(`/api/uploads/admin?limit=${limit}`, {
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
