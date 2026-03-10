<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    quietZone?: number
  }>(),
  {
    quietZone: 4,
  },
)

const matrix = computed(() => encodeQrVersion4Low(props.text))
const viewBoxSize = computed(() => matrix.value.length + props.quietZone * 2)
const darkCells = computed(() => {
  const cells: Array<{ x: number; y: number }> = []
  for (let row = 0; row < matrix.value.length; row += 1) {
    for (let col = 0; col < matrix.value[row].length; col += 1) {
      if (matrix.value[row][col]) {
        cells.push({ x: col + props.quietZone, y: row + props.quietZone })
      }
    }
  }
  return cells
})

function encodeQrVersion4Low(text: string): boolean[][] {
  const version = 4
  const size = 33
  const dataCodewords = 80
  const eccCodewords = 20
  const bytes = Array.from(new TextEncoder().encode(text))
  if (bytes.length > dataCodewords - 2) {
    throw new Error('QR payload too long for embedded generator')
  }

  const data = createDataCodewords(bytes, dataCodewords)
  const ecc = reedSolomonCompute(data, eccCodewords)
  const codewords = [...data, ...ecc]

  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

  drawFinder(modules, reserved, 0, 0)
  drawFinder(modules, reserved, size - 7, 0)
  drawFinder(modules, reserved, 0, size - 7)
  drawAlignment(modules, reserved, 26, 26)
  drawTimingPatterns(modules, reserved)
  reserveFormatAreas(reserved)
  modules[size - 8][8] = true
  reserved[size - 8][8] = true

  placeDataBits(modules, reserved, codewords)
  applyMask0(modules, reserved)
  drawFormatBits(modules)

  return modules
}

function createDataCodewords(bytes: number[], dataCodewords: number) {
  const bits: number[] = []
  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, 8)
  for (const value of bytes) {
    appendBits(bits, value, 8)
  }

  const maxBits = dataCodewords * 8
  const terminatorLength = Math.min(4, maxBits - bits.length)
  appendBits(bits, 0, terminatorLength)

  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  const result: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | bits[index + offset]
    }
    result.push(value)
  }

  let pad = true
  while (result.length < dataCodewords) {
    result.push(pad ? 0xec : 0x11)
    pad = !pad
  }

  return result
}

function appendBits(target: number[], value: number, length: number) {
  for (let shift = length - 1; shift >= 0; shift -= 1) {
    target.push((value >>> shift) & 1)
  }
}

function drawFinder(modules: boolean[][], reserved: boolean[][], left: number, top: number) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const row = top + y
      const col = left + x
      if (row < 0 || row >= modules.length || col < 0 || col >= modules.length) {
        continue
      }

      const isBorder = x >= 0 && x <= 6 && (y === 0 || y === 6) || y >= 0 && y <= 6 && (x === 0 || x === 6)
      const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4
      modules[row][col] = isBorder || isCenter
      reserved[row][col] = true
    }
  }
}

function drawAlignment(modules: boolean[][], reserved: boolean[][], centerCol: number, centerRow: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const row = centerRow + y
      const col = centerCol + x
      if (reserved[row][col]) {
        continue
      }
      modules[row][col] = Math.max(Math.abs(x), Math.abs(y)) !== 1
      reserved[row][col] = true
    }
  }
}

function drawTimingPatterns(modules: boolean[][], reserved: boolean[][]) {
  for (let index = 8; index < modules.length - 8; index += 1) {
    const dark = index % 2 === 0
    if (!reserved[6][index]) {
      modules[6][index] = dark
      reserved[6][index] = true
    }
    if (!reserved[index][6]) {
      modules[index][6] = dark
      reserved[index][6] = true
    }
  }
}

function reserveFormatAreas(reserved: boolean[][]) {
  const size = reserved.length
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      reserved[8][index] = true
      reserved[index][8] = true
    }
  }
  for (let index = 0; index < 8; index += 1) {
    reserved[size - 1 - index][8] = true
    reserved[8][size - 1 - index] = true
  }
}

function placeDataBits(modules: boolean[][], reserved: boolean[][], codewords: number[]) {
  const bits = codewords.flatMap((value) => {
    const chunk: number[] = []
    for (let shift = 7; shift >= 0; shift -= 1) {
      chunk.push((value >>> shift) & 1)
    }
    return chunk
  })

  let bitIndex = 0
  let upwards = true

  for (let right = modules.length - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1
    }

    for (let offset = 0; offset < modules.length; offset += 1) {
      const row = upwards ? modules.length - 1 - offset : offset
      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const col = right - columnOffset
        if (reserved[row][col]) {
          continue
        }
        modules[row][col] = bitIndex < bits.length ? bits[bitIndex] === 1 : false
        bitIndex += 1
      }
    }

    upwards = !upwards
  }
}

function applyMask0(modules: boolean[][], reserved: boolean[][]) {
  for (let row = 0; row < modules.length; row += 1) {
    for (let col = 0; col < modules.length; col += 1) {
      if (!reserved[row][col] && (row + col) % 2 === 0) {
        modules[row][col] = !modules[row][col]
      }
    }
  }
}

function drawFormatBits(modules: boolean[][]) {
  const size = modules.length
  const format = 0b111011111000100

  for (let bit = 0; bit <= 5; bit += 1) {
    modules[8][bit] = getFormatBit(format, bit)
  }
  modules[8][7] = getFormatBit(format, 6)
  modules[8][8] = getFormatBit(format, 7)
  modules[7][8] = getFormatBit(format, 8)
  for (let bit = 9; bit < 15; bit += 1) {
    modules[14 - bit][8] = getFormatBit(format, bit)
  }

  for (let bit = 0; bit < 8; bit += 1) {
    modules[size - 1 - bit][8] = getFormatBit(format, bit)
  }
  for (let bit = 8; bit < 15; bit += 1) {
    modules[8][size - 15 + bit] = getFormatBit(format, bit)
  }
  modules[size - 8][8] = true
}

function getFormatBit(format: number, bit: number) {
  return ((format >>> bit) & 1) !== 0
}

function reedSolomonCompute(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree)
  const result = Array<number>(degree).fill(0)

  for (const value of data) {
    const factor = value ^ result[0]
    result.shift()
    result.push(0)
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMul(generator[index + 1], factor)
    }
  }

  return result
}

function reedSolomonGenerator(degree: number) {
  let result = [1]
  for (let index = 0; index < degree; index += 1) {
    result = polyMultiply(result, [1, gfPow(2, index)])
  }
  return result
}

function polyMultiply(left: number[], right: number[]) {
  const result = Array(left.length + right.length - 1).fill(0)
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^= gfMul(left[leftIndex], right[rightIndex])
    }
  }
  return result
}

function gfPow(base: number, exponent: number) {
  let result = 1
  for (let index = 0; index < exponent; index += 1) {
    result = gfMul(result, base)
  }
  return result
}

function gfMul(left: number, right: number) {
  let a = left
  let b = right
  let result = 0
  while (b > 0) {
    if (b & 1) {
      result ^= a
    }
    a <<= 1
    if (a & 0x100) {
      a ^= 0x11d
    }
    b >>= 1
  }
  return result
}
</script>

<template>
  <svg
    class="qr-code"
    :viewBox="`0 0 ${viewBoxSize} ${viewBoxSize}`"
    role="img"
    aria-label="QR-Code"
  >
    <rect width="100%" height="100%" fill="#ffffff" rx="3" ry="3" />
    <rect
      v-for="cell in darkCells"
      :key="`${cell.x}-${cell.y}`"
      :x="cell.x"
      :y="cell.y"
      width="1"
      height="1"
      fill="#0b0d10"
    />
  </svg>
</template>

<style scoped>
.qr-code {
  display: block;
  width: 100%;
  height: auto;
}
</style>
