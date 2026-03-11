import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'raveberg-admin-unseen-upload-ids'

export const useAdminUploadsBadgeStore = defineStore('adminUploadsBadge', () => {
  const unseenUploadIds = ref<number[]>(readPersistedIds())
  const unseenCount = computed(() => unseenUploadIds.value.length)
  const hasUnseenUploads = computed(() => unseenCount.value > 0)

  function markNewUpload(uploadId: number) {
    if (unseenUploadIds.value.includes(uploadId)) {
      return
    }
    unseenUploadIds.value = [uploadId, ...unseenUploadIds.value]
    persistIds(unseenUploadIds.value)
  }

  function markUploadsViewed() {
    if (!unseenUploadIds.value.length) {
      return
    }
    unseenUploadIds.value = []
    persistIds([])
  }

  function consumeUnseenUploadIds() {
    const ids = [...unseenUploadIds.value]
    markUploadsViewed()
    return ids
  }

  function removeUpload(uploadId: number) {
    if (!unseenUploadIds.value.includes(uploadId)) {
      return
    }
    unseenUploadIds.value = unseenUploadIds.value.filter((id) => id !== uploadId)
    persistIds(unseenUploadIds.value)
  }

  return {
    unseenUploadIds,
    unseenCount,
    hasUnseenUploads,
    markNewUpload,
    markUploadsViewed,
    consumeUnseenUploadIds,
    removeUpload,
  }
})

function readPersistedIds() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    const parsedValue = JSON.parse(rawValue ?? '[]') as unknown
    if (!Array.isArray(parsedValue)) {
      return []
    }
    return parsedValue.filter((value): value is number => Number.isInteger(value) && value > 0)
  } catch {
    return []
  }
}

function persistIds(ids: number[]) {
  if (typeof window === 'undefined') {
    return
  }

  if (ids.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}
