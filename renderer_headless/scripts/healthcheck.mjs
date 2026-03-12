#!/usr/bin/env node
const healthUrl = process.env.HEADLESS_RENDERER_HEALTHCHECK_URL || 'http://127.0.0.1:9012/health'

try {
  const response = await fetch(healthUrl, { cache: 'no-store' })
  if (!response.ok) {
    console.error(`[renderer_headless] healthcheck failed with HTTP ${response.status}`)
    process.exit(1)
  }

  const payload = await response.json()
  const detail = payload.statusDetail || 'unknown'
  console.log(`[renderer_headless] health=${payload.status} detail=${detail}`)
  process.exit(payload.status === 'failed' ? 1 : 0)
} catch (error) {
  console.error(`[renderer_headless] healthcheck request failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
