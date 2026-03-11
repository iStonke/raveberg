import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { StandbyState } from '../services/api'
import { fetchStandbyState, updateStandbyState } from '../services/api'

export const useStandbyStore = defineStore('standby', () => {
  const headline = ref('Unterm Berg beginnt die Nacht')
  const subheadline = ref('Willkommen im Auberg-Keller')
  const hueShiftDegrees = ref(0)
  const updatedAt = ref<string | null>(null)

  async function refresh() {
    applyState(await fetchStandbyState())
  }

  async function save(nextState: Omit<StandbyState, 'updated_at'>) {
    const token = localStorage.getItem('raveberg-admin-token')
    if (!token) {
      throw new Error('Admin session required')
    }

    applyState(await updateStandbyState(nextState, token))
  }

  function applyState(state: StandbyState) {
    headline.value = state.headline
    subheadline.value = state.subheadline
    hueShiftDegrees.value = state.hue_shift_degrees
    updatedAt.value = state.updated_at
  }

  return {
    headline,
    subheadline,
    hueShiftDegrees,
    updatedAt,
    refresh,
    save,
    applyState,
  }
})
