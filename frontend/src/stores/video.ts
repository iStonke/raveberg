import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { VideoAsset, VideoState } from '../services/api'
import {
  fetchAdminVideos,
  fetchPublicVideos,
  fetchVideoState,
  updateVideoState,
} from '../services/api'

export const useVideoStore = defineStore('video', () => {
  const playlistEnabled = ref(true)
  const loopEnabled = ref(true)
  const playbackOrder = ref<VideoState['playback_order']>('upload_order')
  const vintageFilterEnabled = ref(false)
  const logoOverlayEnabled = ref(true)
  const objectFit = ref<VideoState['object_fit']>('contain')
  const transition = ref<VideoState['transition']>('none')
  const activeVideoId = ref<number | null>(null)
  const updatedAt = ref<string | null>(null)
  const assets = ref<VideoAsset[]>([])

  async function refreshState() {
    applyState(await fetchVideoState())
  }

  async function refreshPublicLibrary() {
    applyLibrary(await fetchPublicVideos())
  }

  async function refreshAdminLibrary(token: string) {
    applyLibrary(await fetchAdminVideos(token))
  }

  async function save(nextState: Omit<VideoState, 'updated_at'>) {
    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    applyState(await updateVideoState(nextState, token))
  }

  function applyState(state: VideoState) {
    playlistEnabled.value = state.playlist_enabled
    loopEnabled.value = state.loop_enabled
    playbackOrder.value = state.playback_order
    vintageFilterEnabled.value = state.vintage_filter_enabled
    logoOverlayEnabled.value = state.logo_overlay_enabled
    objectFit.value = state.object_fit
    transition.value = state.transition
    activeVideoId.value = state.active_video_id
    updatedAt.value = state.updated_at
  }

  function applyLibrary(nextAssets: VideoAsset[]) {
    assets.value = [...nextAssets].sort((left, right) => left.position - right.position)
  }

  return {
    playlistEnabled,
    loopEnabled,
    playbackOrder,
    vintageFilterEnabled,
    logoOverlayEnabled,
    objectFit,
    transition,
    activeVideoId,
    updatedAt,
    assets,
    refreshState,
    refreshPublicLibrary,
    refreshAdminLibrary,
    save,
    applyState,
    applyLibrary,
  }
})
