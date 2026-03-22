import { computed, ref } from 'vue'

import type { OverlayMode, VideoAsset } from '../services/api'
import {
  deleteVideoAsset,
  reorderVideoAssets,
  uploadAdminVideo,
} from '../services/api'
import { useAdminAlert } from '../stores/adminAlert'
import { useAuthStore } from '../stores/auth'
import { useSystemStatusStore } from '../stores/systemStatus'
import { useVideoStore } from '../stores/video'

type UseAdminVideoLibraryOptions = {
  onVideoStateSynced?: () => Promise<void> | void
  onSystemRefresh?: () => Promise<void> | void
}

function normalizeVideoOverlayMode(mode: OverlayMode): OverlayMode {
  return mode === 'logo' ? 'logo' : 'off'
}

export function useAdminVideoLibrary(options: UseAdminVideoLibraryOptions = {}) {
  const authStore = useAuthStore()
  const adminAlert = useAdminAlert()
  const systemStatusStore = useSystemStatusStore()
  const videoStore = useVideoStore()

  const videoFileInput = ref<HTMLInputElement | null>(null)
  const busyActions = ref<Record<string, boolean>>({})
  const isUploadingVideos = ref(false)
  const videoUploadLabel = ref('')
  const videoDurations = ref<Record<number, string>>({})
  const videoDurationSeconds = ref<Record<number, number | null>>({})
  const videoMetadataLoading = ref<Record<number, boolean>>({})

  const orderedVideoAssets = computed(() =>
    [...videoStore.assets].sort((left, right) => left.position - right.position),
  )

  const totalVideoDurationSeconds = computed(() =>
    orderedVideoAssets.value.reduce((total, asset) => total + (videoDurationSeconds.value[asset.id] ?? 0), 0),
  )

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

  async function refreshVideoLibrary() {
    if (!authStore.token) {
      return
    }

    await videoStore.refreshAdminLibrary(authStore.token)
    await loadVideoMetadata(videoStore.assets)
  }

  async function refreshVideoState() {
    await videoStore.refreshState()
    await options.onVideoStateSynced?.()
  }

  async function initializeVideoLibrary() {
    await Promise.all([
      refreshVideoLibrary(),
      refreshVideoState(),
    ])
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

      await Promise.all([
        refreshVideoLibrary(),
        refreshVideoState(),
        options.onSystemRefresh?.(),
      ])
    } finally {
      isUploadingVideos.value = false
      videoUploadLabel.value = ''
    }

    if (errors.length) {
      adminAlert.error(errors.join(' | '), {
        title: 'Video-Upload unvollständig',
        duration: 7000,
      })
      return
    }

    adminAlert.success(
      files.length === 1 ? 'Video wurde hinzugefügt.' : `${files.length} Videos wurden hinzugefügt.`,
      {
        title: 'Video-Bibliothek aktualisiert',
      },
    )
  }

  function validateVideoFile(file: File) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!['.mp4', '.webm'].includes(extension)) {
      return 'nur MP4 oder WebM'
    }
    if (file.size > systemStatusStore.videoUploadMaxBytes) {
      return `zu gross, maximal ${formatBytes(systemStatusStore.videoUploadMaxBytes)}`
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
      adminAlert.error(
        error instanceof Error ? error.message : 'Video-Reihenfolge konnte nicht gespeichert werden',
      )
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

    try {
      await deleteVideoAsset(asset.id, authStore.token)
      await Promise.all([
        refreshVideoLibrary(),
        refreshVideoState(),
        options.onSystemRefresh?.(),
      ])
      adminAlert.info('Das Video wurde aus der Bibliothek entfernt.', {
        title: 'Video gelöscht',
      })
    } catch (error) {
      adminAlert.error(error instanceof Error ? error.message : 'Video konnte nicht gelöscht werden')
    } finally {
      setBusy(key, false)
    }
  }

  async function setActiveVideo(asset: VideoAsset) {
    await videoStore.save({
      playlist_enabled: videoStore.playlistEnabled,
      loop_enabled: videoStore.loopEnabled,
      playback_order: videoStore.playbackOrder,
      vintage_filter_enabled: videoStore.vintageFilterEnabled,
      overlay_mode: normalizeVideoOverlayMode(videoStore.overlayMode),
      object_fit: videoStore.objectFit,
      transition: videoStore.transition,
      active_video_id: asset.id,
    })
    await options.onVideoStateSynced?.()
    await options.onSystemRefresh?.()
  }

  async function loadVideoMetadata(items: VideoAsset[]) {
    const activeIds = new Set(items.map((asset) => asset.id))
    const nextDurations = { ...videoDurations.value }
    const nextDurationSeconds = { ...videoDurationSeconds.value }

    for (const key of Object.keys(nextDurations)) {
      const numericKey = Number(key)
      if (!activeIds.has(numericKey)) {
        delete nextDurations[numericKey]
        delete nextDurationSeconds[numericKey]
      }
    }

    videoDurations.value = nextDurations
    videoDurationSeconds.value = nextDurationSeconds

    await Promise.all(
      items.map(async (asset) => {
        if (videoDurations.value[asset.id] || videoMetadataLoading.value[asset.id]) {
          return
        }

        videoMetadataLoading.value = { ...videoMetadataLoading.value, [asset.id]: true }
        try {
          const duration = await readVideoDuration(asset.stream_url)
          videoDurationSeconds.value = {
            ...videoDurationSeconds.value,
            [asset.id]: duration,
          }
          videoDurations.value = {
            ...videoDurations.value,
            [asset.id]: formatDuration(duration),
          }
        } catch {
          videoDurationSeconds.value = {
            ...videoDurationSeconds.value,
            [asset.id]: null,
          }
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

  return {
    videoFileInput,
    busyActions,
    isUploadingVideos,
    videoUploadLabel,
    videoDurations,
    videoMetadataLoading,
    orderedVideoAssets,
    totalVideoDurationSeconds,
    initializeVideoLibrary,
    refreshVideoLibrary,
    refreshVideoState,
    loadVideoMetadata,
    openVideoPicker,
    handleVideoFileSelection,
    moveVideo,
    removeVideo,
    setActiveVideo,
    isBusy,
  }
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 'Unbekannt'
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
