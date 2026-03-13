<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, ref, watch } from 'vue'

const qrImageCache = new Map<string, string>()

const props = withDefaults(
  defineProps<{
    text: string
    quietZone?: number
  }>(),
  {
    quietZone: 4,
  },
)

const normalizedText = computed(() => props.text.trim())
const cacheKey = computed(() => `${props.quietZone}:${normalizedText.value}`)
const qrImageUrl = ref(qrImageCache.get(cacheKey.value) ?? '')
const qrError = ref<Error | null>(null)

watch([normalizedText, cacheKey], async ([nextText, nextKey], _previous, onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })

  if (!nextText) {
    qrError.value = null
    return
  }

  const cachedImage = qrImageCache.get(nextKey)
  if (cachedImage) {
    qrImageUrl.value = cachedImage
    qrError.value = null
    return
  }

  try {
    const dataUrl = await QRCode.toDataURL(nextText, {
      errorCorrectionLevel: 'L',
      margin: props.quietZone,
      width: 1200,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    if (!cancelled) {
      qrImageCache.set(nextKey, dataUrl)
      qrImageUrl.value = dataUrl
      qrError.value = null
    }
  } catch (error) {
    if (!cancelled) {
      qrError.value = error instanceof Error ? error : new Error('QR generation failed')
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="qr-code-matrix" :class="{ 'qr-code-matrix--empty': !qrImageUrl }" :data-error="qrError ? 'true' : 'false'">
    <img v-if="qrImageUrl" class="qr-code-matrix__image" :src="qrImageUrl" alt="" />
  </div>
</template>

<style scoped>
.qr-code-matrix {
  display: block;
  width: 100%;
  line-height: 0;
  isolation: isolate;
  contain: paint;
}

.qr-code-matrix__image {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  object-fit: contain;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: translateZ(0);
  will-change: transform;
}

.qr-code-matrix--empty {
  aspect-ratio: 1;
}
</style>
