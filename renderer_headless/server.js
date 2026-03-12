#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { chromium } from 'playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULTS = {
  host: '0.0.0.0',
  port: 9012,
  displayUrl: 'http://127.0.0.1:8085/display',
  outputWidth: 1920,
  outputHeight: 1080,
  renderWidth: 1920,
  renderHeight: 1080,
  profile: 'balanced',
  fps: 12,
  jpegQuality: 78,
  encoder: 'libx264',
  preset: 'veryfast',
  videoBitrate: '3500k',
  maxrate: '4500k',
  bufsize: '7000k',
  hlsTime: 1,
  hlsListSize: 4,
  keyframeInterval: 12,
  startupGraceMs: 30000,
  hlsInitTimeoutMs: 60000,
  outputStaleMs: 12000,
  watchdogEnabled: true,
  watchdogIntervalMs: 10000,
  watchdogFailureThreshold: 3,
  ffmpegPath: 'ffmpeg',
  browserChannel: '',
  browserExecutablePath: '',
  pageLoadDelayMs: 2000,
  pageTimeoutMs: 15000,
}

const PROFILE_DEFAULTS = {
  performance: {
    outputWidth: 1280,
    outputHeight: 720,
    renderWidth: 960,
    renderHeight: 540,
    fps: 6,
    jpegQuality: 52,
    preset: 'ultrafast',
    videoBitrate: '1600k',
    maxrate: '2200k',
    bufsize: '3200k',
    hlsTime: 1,
    hlsListSize: 3,
    keyframeInterval: 6,
    startupGraceMs: 45000,
    hlsInitTimeoutMs: 90000,
    outputStaleMs: 15000,
  },
  balanced: {
    outputWidth: 1920,
    outputHeight: 1080,
    renderWidth: 1280,
    renderHeight: 720,
    fps: 12,
    jpegQuality: 78,
    preset: 'veryfast',
    videoBitrate: '3500k',
    maxrate: '4500k',
    bufsize: '7000k',
    hlsTime: 1,
    hlsListSize: 4,
    keyframeInterval: 12,
    startupGraceMs: 35000,
    hlsInitTimeoutMs: 70000,
    outputStaleMs: 12000,
  },
  quality: {
    outputWidth: 1920,
    outputHeight: 1080,
    renderWidth: 1920,
    renderHeight: 1080,
    fps: 15,
    jpegQuality: 84,
    preset: 'faster',
    videoBitrate: '5000k',
    maxrate: '6500k',
    bufsize: '9500k',
    hlsTime: 1,
    hlsListSize: 5,
    keyframeInterval: 15,
    startupGraceMs: 40000,
    hlsInitTimeoutMs: 75000,
    outputStaleMs: 15000,
  },
}

function readInt(name, fallback) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readString(name, fallback = '') {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function average(values) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pushBounded(list, value, limit = 120) {
  list.push(value)
  if (list.length > limit) {
    list.splice(0, list.length - limit)
  }
}

const profileName = readString('HEADLESS_RENDERER_PROFILE', DEFAULTS.profile).toLowerCase()
const profile = PROFILE_DEFAULTS[profileName] ?? PROFILE_DEFAULTS[DEFAULTS.profile]

const runtimeDir = path.join(__dirname, 'runtime')
const hlsDir = path.resolve(readString('HEADLESS_RENDERER_HLS_DIRECTORY', path.join(runtimeDir, 'hls')))

const resolvedOutputWidth = Math.max(
  320,
  readInt('HEADLESS_RENDERER_OUTPUT_WIDTH', readInt('HEADLESS_RENDERER_WIDTH', profile.outputWidth ?? DEFAULTS.outputWidth)),
)
const resolvedOutputHeight = Math.max(
  180,
  readInt(
    'HEADLESS_RENDERER_OUTPUT_HEIGHT',
    readInt('HEADLESS_RENDERER_HEIGHT', profile.outputHeight ?? DEFAULTS.outputHeight),
  ),
)
const resolvedRenderWidth = Math.max(
  320,
  readInt('HEADLESS_RENDERER_RENDER_WIDTH', profile.renderWidth ?? resolvedOutputWidth),
)
const resolvedRenderHeight = Math.max(
  180,
  readInt('HEADLESS_RENDERER_RENDER_HEIGHT', profile.renderHeight ?? resolvedOutputHeight),
)

const config = {
  profile: PROFILE_DEFAULTS[profileName] ? profileName : DEFAULTS.profile,
  host: readString('HEADLESS_RENDERER_HOST', DEFAULTS.host),
  port: readInt('HEADLESS_RENDERER_PORT', DEFAULTS.port),
  displayUrl: readString('HEADLESS_RENDERER_DISPLAY_URL', DEFAULTS.displayUrl),
  outputWidth: resolvedOutputWidth,
  outputHeight: resolvedOutputHeight,
  renderWidth: resolvedRenderWidth,
  renderHeight: resolvedRenderHeight,
  fps: Math.max(1, readInt('HEADLESS_RENDERER_FPS', profile.fps)),
  jpegQuality: clamp(readInt('HEADLESS_RENDERER_JPEG_QUALITY', profile.jpegQuality), 1, 100),
  encoder: readString('HEADLESS_RENDERER_ENCODER', DEFAULTS.encoder),
  preset: readString('HEADLESS_RENDERER_PRESET', profile.preset),
  videoBitrate: readString('HEADLESS_RENDERER_VIDEO_BITRATE', profile.videoBitrate),
  maxrate: readString('HEADLESS_RENDERER_MAXRATE', profile.maxrate),
  bufsize: readString('HEADLESS_RENDERER_BUFSIZE', profile.bufsize),
  hlsTime: Math.max(1, readInt('HEADLESS_RENDERER_HLS_TIME', profile.hlsTime)),
  hlsListSize: Math.max(2, readInt('HEADLESS_RENDERER_HLS_LIST_SIZE', profile.hlsListSize)),
  keyframeInterval: Math.max(1, readInt('HEADLESS_RENDERER_KEYFRAME_INTERVAL', profile.keyframeInterval)),
  startupGraceMs: Math.max(1000, readInt('HEADLESS_RENDERER_STARTUP_GRACE_MS', profile.startupGraceMs ?? DEFAULTS.startupGraceMs)),
  hlsInitTimeoutMs: Math.max(
    5000,
    readInt('HEADLESS_RENDERER_HLS_INIT_TIMEOUT_MS', profile.hlsInitTimeoutMs ?? DEFAULTS.hlsInitTimeoutMs),
  ),
  outputStaleMs: Math.max(2000, readInt('HEADLESS_RENDERER_OUTPUT_STALE_MS', profile.outputStaleMs)),
  watchdogEnabled: readString('HEADLESS_RENDERER_WATCHDOG_ENABLED', 'true') !== 'false',
  watchdogIntervalMs: Math.max(1000, readInt('HEADLESS_RENDERER_WATCHDOG_INTERVAL_MS', DEFAULTS.watchdogIntervalMs)),
  watchdogFailureThreshold: Math.max(
    1,
    readInt('HEADLESS_RENDERER_WATCHDOG_FAILURE_THRESHOLD', DEFAULTS.watchdogFailureThreshold),
  ),
  ffmpegPath: readString('HEADLESS_RENDERER_FFMPEG_PATH', DEFAULTS.ffmpegPath),
  browserChannel: readString('HEADLESS_RENDERER_BROWSER_CHANNEL', DEFAULTS.browserChannel),
  browserExecutablePath: readString('HEADLESS_RENDERER_BROWSER_EXECUTABLE_PATH', DEFAULTS.browserExecutablePath),
  pageLoadDelayMs: readInt('HEADLESS_RENDERER_PAGE_LOAD_DELAY_MS', DEFAULTS.pageLoadDelayMs),
  pageTimeoutMs: readInt('HEADLESS_RENDERER_PAGE_TIMEOUT_MS', DEFAULTS.pageTimeoutMs),
  hlsDirectory: hlsDir,
}

const PLAYLIST_FILENAME = 'playlist.m3u8'
const SEGMENT_GLOB = /^segment_\d+\.(ts|m4s)$/i

const state = {
  startedAt: Date.now(),
  startupGraceAnchorAt: Date.now(),
  startupGraceEndsAt: Date.now() + config.startupGraceMs,
  renderLoopRunning: false,
  renderLoopTargetFps: config.fps,
  renderLoopIntervalMs: Math.max(1, Math.round(1000 / config.fps)),
  shutdownRequested: false,
  browserRunning: false,
  browserPid: null,
  displayLoaded: false,
  displayTitle: '',
  displayLastStatus: null,
  displayLastAttemptAt: null,
  displayLastLoadedAt: null,
  renderPipelineActive: false,
  lastFrameAt: null,
  lastSuccessfulRenderAt: null,
  lastHealthyAt: null,
  framesRenderedTotal: 0,
  framesDroppedTotal: 0,
  framesSkippedTotal: 0,
  slowFramesTotal: 0,
  actualFps: 0,
  avgFrameRenderMs: 0,
  avgScreenshotMs: 0,
  avgEncodeWaitMs: 0,
  lastFrameRenderMs: null,
  lastScreenshotMs: null,
  lastEncodeWaitMs: null,
  backpressureWaitsTotal: 0,
  backpressureWaitMsAvg: 0,
  backpressureWaitMsLast: null,
  lastBackpressureAt: null,
  latestFrame: null,
  lastError: '',
  ffmpeg: {
    running: false,
    pid: null,
    startedAt: null,
    command: '',
    lastError: '',
    exitCode: null,
    exitSignal: null,
    lastExitAt: null,
    lastStderrAt: null,
    stderrTail: '',
    outputMode: 'hls',
    encoder: config.encoder,
    hardwareEncoding: config.encoder.endsWith('_videotoolbox'),
  },
}

const healthRuntime = {
  lastStatus: '',
  lastDetail: '',
  consecutiveFailures: 0,
  watchdogExitRequested: false,
  startupGraceLoggedActive: null,
}

function beginStartupGrace(reason, anchorAt = Date.now()) {
  state.startupGraceAnchorAt = anchorAt
  state.startupGraceEndsAt = anchorAt + config.startupGraceMs
  healthRuntime.consecutiveFailures = 0
  console.log(
    `[renderer_headless] startup grace started reason=${reason} anchor=${new Date(anchorAt).toISOString()} ends=${new Date(state.startupGraceEndsAt).toISOString()} duration_ms=${config.startupGraceMs}`,
  )
}

class HeadlessRenderer {
  constructor(rendererConfig) {
    this.config = rendererConfig
    this.browser = null
    this.context = null
    this.page = null
    this.ffmpeg = null
    this.ffmpegStderrTail = []
    this.loopPromise = null
    this.frameDurationsMs = []
    this.screenshotDurationsMs = []
    this.encodeWaitDurationsMs = []
    this.backpressureWaitDurationsMs = []
    this.frameCompletionTimes = []
  }

  async start() {
    await this.prepareDirectories()
    beginStartupGrace('service_start', state.startedAt)
    this.loopPromise = this.captureLoop()
  }

  async stop() {
    state.shutdownRequested = true
    state.renderLoopRunning = false
    state.renderPipelineActive = false

    if (this.ffmpeg?.stdin && !this.ffmpeg.stdin.destroyed) {
      this.ffmpeg.stdin.end()
    }

    if (this.ffmpeg && this.ffmpeg.exitCode === null) {
      this.ffmpeg.kill('SIGTERM')
    }

    if (this.page) {
      await this.page.close().catch(() => undefined)
    }
    if (this.context) {
      await this.context.close().catch(() => undefined)
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined)
    }
  }

  async prepareDirectories() {
    await fsp.mkdir(this.config.hlsDirectory, { recursive: true })
    let removedEntries = 0

    for (const entry of await fsp.readdir(this.config.hlsDirectory, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue
      }
      if (
        entry.name === PLAYLIST_FILENAME ||
        entry.name.endsWith('.m3u8') ||
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.m4s') ||
        entry.name.endsWith('.mp4')
      ) {
        const removed = await fsp
          .unlink(path.join(this.config.hlsDirectory, entry.name))
          .then(() => true)
          .catch(() => false)
        if (removed) {
          removedEntries += 1
        }
      }
    }
    if (removedEntries > 0) {
      console.log(`[renderer_headless] cleaned ${removedEntries} stale HLS file(s) from ${this.config.hlsDirectory}`)
    }
  }

  async ensureBrowser() {
    if (this.browser?.isConnected()) {
      return
    }

    const launchOptions = {
      headless: true,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--force-device-scale-factor=1',
      ],
    }

    if (this.config.browserChannel) {
      launchOptions.channel = this.config.browserChannel
    }
    if (this.config.browserExecutablePath) {
      launchOptions.executablePath = this.config.browserExecutablePath
    }

    console.log('[renderer_headless] starting headless browser')
    this.browser = await chromium.launch(launchOptions)
    this.browser.on('disconnected', () => {
      console.warn('[renderer_headless] browser disconnected')
      state.browserRunning = false
      state.browserPid = null
      state.displayLoaded = false
    })
    state.browserRunning = true
    state.browserPid = null
  }

  async ensurePage() {
    if (this.page && !this.page.isClosed() && state.displayLoaded) {
      return
    }

    state.displayLastAttemptAt = Date.now()

    if (!this.browser?.isConnected()) {
      await this.ensureBrowser()
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: this.config.renderWidth, height: this.config.renderHeight },
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
      })
    }

    if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage()
      this.page.on('pageerror', (error) => {
        state.lastError = `pageerror: ${error.message}`
      })
      this.page.on('crash', () => {
        state.lastError = 'display page crashed'
        state.displayLoaded = false
      })
    }

    try {
      const response = await this.page.goto(this.config.displayUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.pageTimeoutMs,
      })
      await this.page.waitForTimeout(this.config.pageLoadDelayMs)
      state.displayLastStatus = response?.status() ?? null
      state.displayTitle = await this.page.title()
      state.displayLoaded = Boolean(response?.ok() ?? true)
      state.displayLastLoadedAt = Date.now()
      state.lastError = ''
      console.log(
        `[renderer_headless] display loaded status=${state.displayLastStatus ?? 'n/a'} title=${JSON.stringify(state.displayTitle)}`,
      )
    } catch (error) {
      state.displayLoaded = false
      state.lastError = error instanceof Error ? error.message : String(error)
      console.warn(`[renderer_headless] failed to load display: ${state.lastError}`)
      throw error
    }
  }

  async ensureFfmpeg() {
    if (this.ffmpeg && this.ffmpeg.exitCode === null) {
      return
    }

    await this.prepareDirectories()

    const ffmpegArgs = this.buildFfmpegArgs()
    const command = [this.config.ffmpegPath, ...ffmpegArgs].join(' ')

    console.log(`[renderer_headless] starting ffmpeg: ${command}`)
    console.log(`[renderer_headless] output mode: HLS (${this.config.encoder})`)
    console.log(`[renderer_headless] hls directory: ${this.config.hlsDirectory}`)
    console.log(`[renderer_headless] playlist path: ${path.join(this.config.hlsDirectory, PLAYLIST_FILENAME)}`)

    this.ffmpeg = spawn(this.config.ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    state.ffmpeg.running = true
    state.ffmpeg.pid = this.ffmpeg.pid ?? null
    state.ffmpeg.command = command
    state.ffmpeg.lastError = ''
    state.ffmpeg.exitCode = null
    state.ffmpeg.exitSignal = null
    state.ffmpeg.lastExitAt = null
    state.ffmpeg.startedAt = Date.now()
    beginStartupGrace('ffmpeg_start')

    this.ffmpeg.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8')
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      if (lines.length === 0) {
        return
      }
      this.ffmpegStderrTail.push(...lines)
      this.ffmpegStderrTail = this.ffmpegStderrTail.slice(-20)
      state.ffmpeg.stderrTail = this.ffmpegStderrTail.join('\n')
      state.ffmpeg.lastStderrAt = Date.now()
    })

    this.ffmpeg.on('exit', (code, signal) => {
      console.log(`[renderer_headless] ffmpeg exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      state.ffmpeg.running = false
      state.ffmpeg.pid = null
      state.ffmpeg.exitCode = code ?? null
      state.ffmpeg.exitSignal = signal ?? null
      state.ffmpeg.lastExitAt = Date.now()
      state.ffmpeg.startedAt = null
      state.renderPipelineActive = false
      if (!state.shutdownRequested) {
        state.ffmpeg.lastError = `ffmpeg exited (${signal ?? code ?? 'unknown'})`
      }
    })

    this.ffmpeg.stdin.on('error', (error) => {
      console.warn(`[renderer_headless] ffmpeg stdin error: ${error.message}`)
      state.ffmpeg.lastError = error.message
    })
  }

  buildFfmpegArgs() {
    const gop = Math.max(1, this.config.keyframeInterval)
    const playlistPath = path.join(this.config.hlsDirectory, PLAYLIST_FILENAME)
    const segmentPattern = path.join(this.config.hlsDirectory, 'segment_%05d.ts')
    const needsScale =
      this.config.renderWidth !== this.config.outputWidth || this.config.renderHeight !== this.config.outputHeight
    const args = [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-f',
      'image2pipe',
      '-framerate',
      String(this.config.fps),
      '-vcodec',
      'mjpeg',
      '-i',
      'pipe:0',
      '-an',
      '-c:v',
      this.config.encoder,
      '-pix_fmt',
      'yuv420p',
    ]

    if (needsScale) {
      args.push(
        '-vf',
        `scale=${this.config.outputWidth}:${this.config.outputHeight}:flags=fast_bilinear`,
      )
    }

    args.push(
      '-g',
      String(gop),
      '-keyint_min',
      String(gop),
      '-force_key_frames',
      `expr:gte(t,n_forced*${this.config.hlsTime})`,
      '-b:v',
      this.config.videoBitrate,
      '-maxrate',
      this.config.maxrate,
      '-bufsize',
      this.config.bufsize,
    )

    if (this.config.encoder.endsWith('_videotoolbox')) {
      args.push('-realtime', '1')
    } else {
      args.push('-preset', this.config.preset, '-tune', 'zerolatency', '-sc_threshold', '0')
    }

    args.push(
      '-f',
      'hls',
      '-hls_time',
      String(this.config.hlsTime),
      '-hls_list_size',
      String(this.config.hlsListSize),
      '-hls_allow_cache',
      '0',
      '-hls_flags',
      'delete_segments+append_list+omit_endlist+independent_segments+program_date_time+temp_file',
      '-hls_segment_filename',
      segmentPattern,
      playlistPath,
    )

    return args
  }

  async captureLoop() {
    state.renderLoopRunning = true
    const intervalMs = Math.max(1, Math.round(1000 / this.config.fps))
    let nextFrameDueAt = Date.now()

    while (!state.shutdownRequested) {
      const now = Date.now()
      if (now < nextFrameDueAt) {
        await sleep(nextFrameDueAt - now)
      }
      const iterationStartedAt = Date.now()

      try {
        await this.ensureBrowser()
        await this.ensurePage()
        await this.ensureFfmpeg()
        await this.captureAndEncodeFrame()
      } catch (error) {
        state.renderPipelineActive = false
        state.lastError = error instanceof Error ? error.message : String(error)
        state.framesDroppedTotal += 1
        console.warn(`[renderer_headless] render iteration failed: ${state.lastError}`)
        await this.recoverAfterFailure()
        await sleep(1000)
        nextFrameDueAt = Date.now() + intervalMs
        continue
      }

      nextFrameDueAt += intervalMs
      const finishedAt = Date.now()
      const loopDurationMs = finishedAt - iterationStartedAt
      if (loopDurationMs > intervalMs) {
        state.slowFramesTotal += 1
      }
      if (nextFrameDueAt < finishedAt) {
        const skippedFrames = Math.floor((finishedAt - nextFrameDueAt) / intervalMs) + 1
        state.framesSkippedTotal += skippedFrames
        nextFrameDueAt += skippedFrames * intervalMs
      }
    }
  }

  async captureAndEncodeFrame() {
    if (!this.page || this.page.isClosed()) {
      throw new Error('display page is not available')
    }
    if (!this.ffmpeg || this.ffmpeg.exitCode !== null || !this.ffmpeg.stdin.writable) {
      throw new Error('ffmpeg stdin is not writable')
    }

    const renderStartedAt = Date.now()
    const jpeg = await this.page.screenshot({
      type: 'jpeg',
      quality: this.config.jpegQuality,
      caret: 'hide',
      scale: 'css',
    })
    const screenshotCompletedAt = Date.now()
    const screenshotDurationMs = screenshotCompletedAt - renderStartedAt

    state.latestFrame = jpeg

    const writeResult = await writeToStream(this.ffmpeg.stdin, jpeg, () => {
      state.backpressureWaitsTotal += 1
      state.lastBackpressureAt = Date.now()
    })
    const finishedAt = Date.now()
    const encodeWaitMs = finishedAt - screenshotCompletedAt
    const totalRenderMs = finishedAt - renderStartedAt

    this.recordFrameMetrics({
      completedAt: finishedAt,
      totalRenderMs,
      screenshotDurationMs,
      encodeWaitMs,
      backpressureWaitMs: writeResult.backpressureWaitMs,
    })

    state.framesRenderedTotal += 1
    state.lastFrameAt = finishedAt
    state.lastSuccessfulRenderAt = finishedAt
    state.renderPipelineActive = true
  }

  recordFrameMetrics({ completedAt, totalRenderMs, screenshotDurationMs, encodeWaitMs, backpressureWaitMs }) {
    pushBounded(this.frameDurationsMs, totalRenderMs)
    pushBounded(this.screenshotDurationsMs, screenshotDurationMs)
    pushBounded(this.encodeWaitDurationsMs, encodeWaitMs)
    if (backpressureWaitMs > 0) {
      pushBounded(this.backpressureWaitDurationsMs, backpressureWaitMs)
    }
    pushBounded(this.frameCompletionTimes, completedAt)

    const cutoff = completedAt - 10000
    while (this.frameCompletionTimes.length > 0 && this.frameCompletionTimes[0] < cutoff) {
      this.frameCompletionTimes.shift()
    }

    state.lastFrameRenderMs = totalRenderMs
    state.lastScreenshotMs = screenshotDurationMs
    state.lastEncodeWaitMs = encodeWaitMs
    state.backpressureWaitMsLast = backpressureWaitMs
    state.avgFrameRenderMs = Number(average(this.frameDurationsMs).toFixed(1))
    state.avgScreenshotMs = Number(average(this.screenshotDurationsMs).toFixed(1))
    state.avgEncodeWaitMs = Number(average(this.encodeWaitDurationsMs).toFixed(1))
    state.backpressureWaitMsAvg = Number(average(this.backpressureWaitDurationsMs).toFixed(1))

    if (this.frameCompletionTimes.length >= 2) {
      const windowDurationMs = this.frameCompletionTimes[this.frameCompletionTimes.length - 1] - this.frameCompletionTimes[0]
      state.actualFps =
        windowDurationMs > 0
          ? Number((((this.frameCompletionTimes.length - 1) * 1000) / windowDurationMs).toFixed(2))
          : state.renderLoopTargetFps
    } else {
      state.actualFps = this.frameCompletionTimes.length === 1 ? state.renderLoopTargetFps : 0
    }
  }

  async recoverAfterFailure() {
    if (this.page && !this.page.isClosed()) {
      await this.page.close().catch(() => undefined)
    }
    this.page = null

    if (this.context) {
      await this.context.close().catch(() => undefined)
    }
    this.context = null

    if (this.browser) {
      await this.browser.close().catch(() => undefined)
    }
    this.browser = null
    state.browserRunning = false
    state.browserPid = null
    state.displayLoaded = false

    if (this.ffmpeg?.stdin && !this.ffmpeg.stdin.destroyed) {
      this.ffmpeg.stdin.end()
    }
    if (this.ffmpeg && this.ffmpeg.exitCode === null) {
      this.ffmpeg.kill('SIGTERM')
    }
    this.ffmpeg = null
    state.ffmpeg.running = false
    state.ffmpeg.pid = null
    state.ffmpeg.startedAt = null
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function writeToStream(stream, buffer, onBackpressure = null) {
  return new Promise((resolve, reject) => {
    if (stream.destroyed || stream.writableEnded) {
      reject(new Error('ffmpeg stdin is closed'))
      return
    }

    let settled = false
    const onError = (error) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(error)
    }
    let drainHandler = null
    const onDrain = () => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve({ backpressureWaitMs: Date.now() - writeStartedAt })
    }
    const cleanup = () => {
      stream.off('error', onError)
      if (drainHandler) {
        stream.off('drain', drainHandler)
      }
    }

    const writeStartedAt = Date.now()
    stream.once('error', onError)
    const canContinue = stream.write(buffer, (error) => {
      if (settled) {
        return
      }
      if (error) {
        settled = true
        cleanup()
        reject(error)
        return
      }
      if (canContinue) {
        settled = true
        cleanup()
        resolve({ backpressureWaitMs: 0 })
      }
    })
    if (!canContinue) {
      onBackpressure?.()
      drainHandler = onDrain
      stream.once('drain', drainHandler)
    }
  })
}

function collectOutputStatus() {
  const playlistPath = path.join(config.hlsDirectory, PLAYLIST_FILENAME)
  const playlistExists = fs.existsSync(playlistPath)
  const entries = fs.existsSync(config.hlsDirectory) ? fs.readdirSync(config.hlsDirectory) : []
  const segments = entries.filter((entry) => SEGMENT_GLOB.test(entry)).sort()
  const latestSegment = segments.length > 0 ? segments[segments.length - 1] : null
  const latestSegmentPath = latestSegment ? path.join(config.hlsDirectory, latestSegment) : null
  const playlistUpdatedAt = playlistExists ? fs.statSync(playlistPath).mtimeMs : null
  const latestSegmentUpdatedAt = latestSegmentPath ? fs.statSync(latestSegmentPath).mtimeMs : null
  const recentSegmentStats = segments.slice(-4).map((entry) => fs.statSync(path.join(config.hlsDirectory, entry)).mtimeMs)
  const recentActivityDiffs = []
  for (let index = 1; index < recentSegmentStats.length; index += 1) {
    recentActivityDiffs.push(recentSegmentStats[index] - recentSegmentStats[index - 1])
  }
  const lastOutputAt = Math.max(playlistUpdatedAt ?? 0, latestSegmentUpdatedAt ?? 0) || null
  const staleByMs = lastOutputAt == null ? null : Math.max(0, Date.now() - lastOutputAt)
  const stale = lastOutputAt != null && staleByMs > config.outputStaleMs

  return {
    mode: 'hls',
    directory: config.hlsDirectory,
    playlistPath,
    playlistUrl: `/hls/${PLAYLIST_FILENAME}`,
    playlistExists,
    playlistUpdatedAt,
    segmentCount: segments.length,
    sampleSegments: segments.slice(-3),
    latestSegment,
    latestSegmentUpdatedAt,
    ready: playlistExists && segments.length > 0,
    lastOutputAt,
    lastActivityAt: lastOutputAt,
    hlsUpdateIntervalMs: recentActivityDiffs.length > 0 ? Number(average(recentActivityDiffs).toFixed(1)) : null,
    stale,
    staleByMs,
    encoder: config.encoder,
    hardwareEncoding: config.encoder.endsWith('_videotoolbox'),
    fps: config.fps,
    width: config.outputWidth,
    height: config.outputHeight,
    renderWidth: config.renderWidth,
    renderHeight: config.renderHeight,
  }
}

function toSnakeOutputStatus(output) {
  return {
    mode: output.mode,
    directory: output.directory,
    playlist_path: output.playlistPath,
    playlist_url: output.playlistUrl,
    playlist_exists: output.playlistExists,
    playlist_updated_at: output.playlistUpdatedAt,
    segment_count: output.segmentCount,
    sample_segments: output.sampleSegments,
    latest_segment: output.latestSegment,
    latest_segment_updated_at: output.latestSegmentUpdatedAt,
    ready: output.ready,
    last_output_at: output.lastOutputAt,
    last_activity_at: output.lastActivityAt,
    hls_update_interval_ms: output.hlsUpdateIntervalMs,
    stale: output.stale,
    stale_by_ms: output.staleByMs,
    encoder: output.encoder,
    hardware_encoding: output.hardwareEncoding,
    fps: output.fps,
    width: output.width,
    height: output.height,
    render_width: output.renderWidth,
    render_height: output.renderHeight,
  }
}

function buildHealthPayload() {
  const preferredOutput = collectOutputStatus()
  const preferredOutputSnake = toSnakeOutputStatus(preferredOutput)
  const now = Date.now()
  const uptimeMs = now - state.startedAt
  const ffmpegUptimeMs = state.ffmpeg.startedAt ? Math.max(0, now - state.ffmpeg.startedAt) : null
  const startupGraceRemainingMs = Math.max(0, state.startupGraceEndsAt - now)
  const startupGraceActive = startupGraceRemainingMs > 0
  const initTimeoutRemainingMs =
    ffmpegUptimeMs == null ? config.hlsInitTimeoutMs : Math.max(0, config.hlsInitTimeoutMs - ffmpegUptimeMs)
  const renderLoopStopped = !state.renderLoopRunning && !state.shutdownRequested
  const browserFailed = !state.browserRunning && !startupGraceActive
  const displayFailed = !state.displayLoaded && !startupGraceActive
  const ffmpegFailed =
    !state.ffmpeg.running &&
    !startupGraceActive &&
    Boolean(state.ffmpeg.lastError || state.ffmpeg.exitCode !== null || state.lastSuccessfulRenderAt != null)
  const hlsStale = preferredOutput.stale
  const renderLoopFailed = renderLoopStopped && !startupGraceActive
  const renderProgressRecent =
    state.lastFrameAt != null && now - state.lastFrameAt <= Math.max(config.outputStaleMs, state.renderLoopIntervalMs * 10)
  const renderProgressVisible = state.framesRenderedTotal > 0 || renderProgressRecent
  const hlsWarmupActive =
    !preferredOutput.ready &&
    !startupGraceActive &&
    state.browserRunning &&
    state.displayLoaded &&
    state.ffmpeg.running &&
    initTimeoutRemainingMs > 0
  const hlsInitTimedOut =
    !preferredOutput.ready &&
    !startupGraceActive &&
    state.browserRunning &&
    state.displayLoaded &&
    state.ffmpeg.running &&
    initTimeoutRemainingMs === 0
  const runningSlowly =
    state.framesRenderedTotal >= Math.max(2, Math.ceil(config.fps / 2)) &&
    state.actualFps > 0 &&
    state.actualFps < config.fps * 0.75

  let statusDetail = 'hls_not_ready'
  if (preferredOutput.ready) {
    if (hlsStale) {
      statusDetail = 'hls_stale'
    } else if (runningSlowly) {
      statusDetail = 'running_slowly'
    } else {
      statusDetail = 'ready'
    }
  } else if (startupGraceActive) {
    statusDetail = 'starting'
  } else if (hlsWarmupActive) {
    statusDetail = runningSlowly || renderProgressVisible ? 'running_slowly' : 'warming_up'
  } else if (hlsInitTimedOut) {
    statusDetail = 'hls_init_timeout'
  } else if (ffmpegFailed) {
    statusDetail = 'ffmpeg_failed'
  } else if (browserFailed) {
    statusDetail = 'browser_failed'
  } else if (displayFailed) {
    statusDetail = 'display_not_loaded'
  } else if (renderLoopFailed) {
    statusDetail = 'render_loop_stopped'
  }

  let status = 'degraded'
  if (statusDetail === 'starting') {
    status = 'starting'
  } else if (statusDetail === 'ready') {
    status = 'ok'
  } else if (statusDetail === 'running_slowly' || statusDetail === 'warming_up') {
    status = 'degraded'
  } else if (
    ['ffmpeg_failed', 'browser_failed', 'display_not_loaded', 'render_loop_stopped', 'hls_stale', 'hls_not_ready', 'hls_init_timeout'].includes(
      statusDetail,
    )
  ) {
    status = 'failed'
  }

  if (status === 'ok') {
    state.lastHealthyAt = Date.now()
  }

  return {
    status,
    statusDetail,
    uptimeSeconds: Number(((Date.now() - state.startedAt) / 1000).toFixed(1)),
    startup_grace_active: startupGraceActive,
    startup_grace_anchor_at: state.startupGraceAnchorAt,
    startup_grace_ends_at: state.startupGraceEndsAt,
    startup_grace_remaining_ms: startupGraceRemainingMs,
    hls_init_timeout_ms: config.hlsInitTimeoutMs,
    hls_init_timeout_remaining_ms: initTimeoutRemainingMs,
    rendererRunning: state.renderLoopRunning && !state.shutdownRequested,
    browser_running: state.browserRunning,
    display_loaded: state.displayLoaded,
    render_loop_running: state.renderLoopRunning && !state.shutdownRequested,
    last_frame_rendered_at: state.lastFrameAt,
    frames_rendered_total: state.framesRenderedTotal,
    frames_dropped_total: state.framesDroppedTotal,
    frames_skipped_total: state.framesSkippedTotal,
    actual_fps: state.actualFps,
    avg_frame_render_ms: state.avgFrameRenderMs,
    ffmpeg_stdin_backpressure_count: state.backpressureWaitsTotal,
    ffmpeg_running: state.ffmpeg.running,
    ffmpeg_exit_code: state.ffmpeg.exitCode,
    last_healthy_at: state.lastHealthyAt,
    displayUrl: config.displayUrl,
    profile: config.profile,
    settings: {
      profile: config.profile,
      renderWidth: config.renderWidth,
      renderHeight: config.renderHeight,
      outputWidth: config.outputWidth,
      outputHeight: config.outputHeight,
      fps: config.fps,
      jpegQuality: config.jpegQuality,
      preset: config.preset,
      encoder: config.encoder,
      videoBitrate: config.videoBitrate,
      maxrate: config.maxrate,
      bufsize: config.bufsize,
      hlsTime: config.hlsTime,
      hlsListSize: config.hlsListSize,
      keyframeInterval: config.keyframeInterval,
      hlsInitTimeoutMs: config.hlsInitTimeoutMs,
    },
    browser: {
      running: state.browserRunning,
      pid: state.browserPid,
    },
    display: {
      loaded: state.displayLoaded,
      title: state.displayTitle,
      lastStatus: state.displayLastStatus,
      lastAttemptAt: state.displayLastAttemptAt,
      lastLoadedAt: state.displayLastLoadedAt,
    },
    renderPipeline: {
      active: state.renderPipelineActive,
      lastFrameAt: state.lastFrameAt,
      lastSuccessfulRenderAt: state.lastSuccessfulRenderAt,
      framesRenderedTotal: state.framesRenderedTotal,
      framesDroppedTotal: state.framesDroppedTotal,
      framesSkippedTotal: state.framesSkippedTotal,
      slowFramesTotal: state.slowFramesTotal,
      backpressureWaitsTotal: state.backpressureWaitsTotal,
      backpressureWaitMsAvg: state.backpressureWaitMsAvg,
      backpressureWaitMsLast: state.backpressureWaitMsLast,
      lastBackpressureAt: state.lastBackpressureAt,
      targetFps: state.renderLoopTargetFps,
      actualFps: state.actualFps,
      frameIntervalMs: state.renderLoopIntervalMs,
      avgFrameRenderMs: state.avgFrameRenderMs,
      avgScreenshotMs: state.avgScreenshotMs,
      avgEncodeWaitMs: state.avgEncodeWaitMs,
      lastFrameRenderMs: state.lastFrameRenderMs,
      lastScreenshotMs: state.lastScreenshotMs,
      lastEncodeWaitMs: state.lastEncodeWaitMs,
    },
    ffmpeg: {
      ...state.ffmpeg,
      uptimeMs: ffmpegUptimeMs,
    },
    preferredOutput,
    preferred_output: preferredOutputSnake,
    watchdog: {
      enabled: config.watchdogEnabled,
      intervalMs: config.watchdogIntervalMs,
      failureThreshold: config.watchdogFailureThreshold,
      consecutiveFailures: healthRuntime.consecutiveFailures,
    },
    lastError: state.lastError,
  }
}

function logStartupGraceState(payload) {
  if (healthRuntime.startupGraceLoggedActive === payload.startup_grace_active) {
    return
  }
  healthRuntime.startupGraceLoggedActive = payload.startup_grace_active

  if (payload.startup_grace_active) {
    console.log(
      `[renderer_headless] startup grace active remaining_ms=${payload.startup_grace_remaining_ms} detail=${payload.statusDetail}`,
    )
    return
  }

  console.log(
    `[renderer_headless] startup grace ended detail=${payload.statusDetail} playlist_exists=${payload.preferred_output.playlist_exists} segment_count=${payload.preferred_output.segment_count}`,
  )
}

function logHealthTransition(payload) {
  if (payload.status === healthRuntime.lastStatus && payload.statusDetail === healthRuntime.lastDetail) {
    return
  }

  healthRuntime.lastStatus = payload.status
  healthRuntime.lastDetail = payload.statusDetail

  const message =
    `[renderer_headless] health transition status=${payload.status} detail=${payload.statusDetail} ` +
    `display_loaded=${payload.display_loaded} ffmpeg_running=${payload.ffmpeg_running} ` +
    `playlist_exists=${payload.preferred_output.playlist_exists} segment_count=${payload.preferred_output.segment_count} ` +
    `actual_fps=${payload.actual_fps} target_fps=${payload.settings?.fps ?? 'n/a'}`

  if (payload.status === 'ok') {
    console.log(message)
  } else if (payload.status === 'degraded' || payload.status === 'starting') {
    console.warn(message)
  } else {
    console.error(message)
  }
}

function createPreviewHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>RaveBerg Headless Renderer Preview</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        background: #05070c;
        color: #eef4ff;
        font-family: Helvetica, Arial, sans-serif;
        display: grid;
        place-items: center;
      }
      main {
        width: min(92vw, 1280px);
      }
      video {
        width: 100%;
        display: block;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.08);
        background: #020409;
        box-shadow: 0 24px 72px rgba(0,0,0,0.45);
      }
      .panel {
        margin-bottom: 1rem;
        padding: 1rem 1.15rem;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }
      .metric {
        padding: 0.85rem 0.95rem;
        border-radius: 12px;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .metric strong {
        display: block;
        margin-bottom: 0.25rem;
      }
      .waiting {
        color: #ffd7a0;
        border-color: rgba(255, 186, 99, 0.25);
        background: rgba(255, 186, 99, 0.08);
      }
      .ready {
        color: #d7ffd7;
        border-color: rgba(96, 211, 131, 0.25);
        background: rgba(96, 211, 131, 0.08);
      }
      .failed {
        color: #ffd3d3;
        border-color: rgba(255, 107, 107, 0.25);
        background: rgba(255, 107, 107, 0.08);
      }
      code {
        color: #91dcff;
      }
      a {
        color: #91dcff;
      }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  </head>
  <body>
    <main>
      <h1>Headless Full Display Renderer</h1>
      <div id="status" class="panel waiting">Waiting for renderer status.</div>
      <div class="panel">
        <div>Display source: <code>${escapeHtml(config.displayUrl)}</code></div>
        <div>Preferred output: <code>/hls/${PLAYLIST_FILENAME}</code></div>
        <div>Render size: <code>${config.renderWidth}x${config.renderHeight}</code>, output size: <code>${config.outputWidth}x${config.outputHeight}</code></div>
        <div>Profile: <code>${config.profile}</code>, target: <code>${config.fps} FPS</code>, JPEG quality: <code>${config.jpegQuality}</code>, preset: <code>${config.preset}</code></div>
      </div>
      <video id="video" controls autoplay muted playsinline></video>
      <div id="metrics" class="panel metrics">
        <div class="metric"><strong>Status</strong><span>Waiting for data</span></div>
      </div>
      <div class="panel">
        Inspect <a href="/health">/health</a> if the playlist is not ready yet.
      </div>
    </main>
    <script>
      const video = document.getElementById('video');
      const statusBox = document.getElementById('status');
      const metricsBox = document.getElementById('metrics');
      const source = '/hls/${PLAYLIST_FILENAME}';
      let attached = false;
      let player;

      function formatTime(timestamp) {
        if (!timestamp) {
          return 'n/a';
        }
        return new Date(timestamp).toLocaleTimeString();
      }

      function renderMetrics(payload) {
        const output = payload.preferredOutput || {};
        const settings = payload.settings || {};
        metricsBox.innerHTML = [
          ['Status', payload.status + ' / ' + payload.statusDetail],
          ['Actual / target FPS', (payload.actual_fps ?? 'n/a') + ' / ' + ((payload.settings || {}).fps ?? 'n/a')],
          ['Avg frame', payload.avg_frame_render_ms != null ? payload.avg_frame_render_ms + ' ms' : 'n/a'],
          ['Dropped / skipped', (payload.frames_dropped_total ?? 0) + ' / ' + (payload.frames_skipped_total ?? 0)],
          ['Backpressure', payload.ffmpeg_stdin_backpressure_count ?? 0],
          ['HLS', output.stale ? 'stale' : (output.ready ? 'ready' : 'not ready')],
          ['Segments', output.segmentCount ?? 0],
          ['Last HLS activity', formatTime(output.lastActivityAt)],
          ['Render / output', ((settings.renderWidth ?? '${config.renderWidth}') + 'x' + (settings.renderHeight ?? '${config.renderHeight}')) + ' -> ' + ((settings.outputWidth ?? '${config.outputWidth}') + 'x' + (settings.outputHeight ?? '${config.outputHeight}'))],
          ['Profile', settings.profile || '${config.profile}'],
          ['JPEG quality', settings.jpegQuality ?? '${config.jpegQuality}'],
        ].map(([label, value]) => '<div class="metric"><strong>' + label + '</strong><span>' + value + '</span></div>').join('');
      }

      function attachPlayer() {
        if (attached) {
          return;
        }
        attached = true;
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = source;
          return;
        }
        if (window.Hls && window.Hls.isSupported()) {
          player = new Hls({
            lowLatencyMode: true,
            liveSyncDurationCount: 2,
            maxLiveSyncPlaybackRate: 1.2,
          });
          player.loadSource(source);
          player.attachMedia(video);
          return;
        }
        statusBox.className = 'panel waiting';
        statusBox.textContent = 'HLS playback is not supported in this browser.';
      }

      async function refresh() {
        try {
          const response = await fetch('/health', { cache: 'no-store' });
          const payload = await response.json();
          const output = payload.preferredOutput || {};
          renderMetrics(payload);
          if (payload.statusDetail === 'hls_stale') {
            statusBox.className = 'panel failed';
            statusBox.textContent = 'HLS output is stale. A restart is likely pending.';
          } else if (output.ready) {
            statusBox.className = payload.status === 'degraded' ? 'panel waiting' : 'panel ready';
            statusBox.innerHTML = 'Renderer ready via <code>/hls/${PLAYLIST_FILENAME}</code> at <code>' + (payload.actual_fps ?? 'n/a') + ' FPS</code>.';
            attachPlayer();
          } else if (payload.statusDetail === 'ffmpeg_failed') {
            statusBox.className = 'panel failed';
            statusBox.textContent = payload.ffmpeg?.lastError || 'ffmpeg failed before HLS output became ready.';
          } else if (payload.statusDetail === 'browser_failed') {
            statusBox.className = 'panel failed';
            statusBox.textContent = payload.lastError || 'Headless browser failed before rendering started.';
          } else if (payload.statusDetail === 'display_not_loaded') {
            statusBox.className = 'panel waiting';
            statusBox.textContent = 'Display page is not loaded yet.';
          } else if (payload.statusDetail === 'render_loop_stopped') {
            statusBox.className = 'panel failed';
            statusBox.textContent = 'Render loop is no longer active.';
          } else if (payload.status === 'starting' || payload.statusDetail === 'starting') {
            statusBox.className = 'panel waiting';
            statusBox.textContent = 'Renderer is still within startup grace and preparing HLS output.';
          } else if (payload.statusDetail === 'warming_up') {
            statusBox.className = 'panel waiting';
            statusBox.textContent = 'Renderer is rendering first frames, HLS playlist is still warming up.';
          } else if (payload.statusDetail === 'running_slowly') {
            statusBox.className = 'panel waiting';
            statusBox.textContent = 'Renderer is alive but currently below target FPS. HLS may appear with delay.';
          } else if (payload.statusDetail === 'hls_init_timeout') {
            statusBox.className = 'panel failed';
            statusBox.textContent = 'Renderer stayed active, but HLS did not become ready within the init timeout.';
          } else {
            statusBox.className = 'panel waiting';
            statusBox.textContent = 'Renderer is running, but HLS output is not ready yet.';
          }
        } catch (_error) {
          statusBox.className = 'panel failed';
          statusBox.textContent = 'Unable to read /health.';
        }
      }

      refresh();
      window.setInterval(refresh, 2000);
    </script>
  </body>
</html>`
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sendNoCache(response) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.setHeader('Pragma', 'no-cache')
}

async function main() {
  await fsp.mkdir(runtimeDir, { recursive: true })

  console.log('[renderer_headless] starting service')
  console.log(`[renderer_headless] display url: ${config.displayUrl}`)
  console.log(
    `[renderer_headless] render viewport: ${config.renderWidth}x${config.renderHeight} -> output ${config.outputWidth}x${config.outputHeight} @ ${config.fps} FPS`,
  )
  console.log(`[renderer_headless] profile: ${config.profile}`)
  console.log(`[renderer_headless] jpeg quality: ${config.jpegQuality}`)
  console.log(`[renderer_headless] encoder: ${config.encoder}`)
  console.log(`[renderer_headless] bitrate: target=${config.videoBitrate} maxrate=${config.maxrate} bufsize=${config.bufsize}`)
  console.log(`[renderer_headless] hls: time=${config.hlsTime}s list=${config.hlsListSize}`)
  console.log(`[renderer_headless] keyframe interval: ${config.keyframeInterval}`)
  if (!config.encoder.endsWith('_videotoolbox')) {
    console.log(`[renderer_headless] ffmpeg preset: ${config.preset}`)
  }
  console.log(`[renderer_headless] startup grace: ${config.startupGraceMs}ms`)
  console.log(`[renderer_headless] hls init timeout: ${config.hlsInitTimeoutMs}ms`)
  console.log(`[renderer_headless] output stale threshold: ${config.outputStaleMs}ms`)
  console.log(
    `[renderer_headless] watchdog: ${config.watchdogEnabled ? `enabled every ${config.watchdogIntervalMs}ms (threshold ${config.watchdogFailureThreshold})` : 'disabled'}`,
  )
  console.log(`[renderer_headless] runtime directory: ${runtimeDir}`)
  console.log(`[renderer_headless] hls directory: ${config.hlsDirectory}`)

  const renderer = new HeadlessRenderer(config)
  await renderer.start()

  const app = express()

  app.use((_request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (_request.method === 'OPTIONS') {
      response.status(204).end()
      return
    }
    next()
  })

  app.get('/', (_request, response) => {
    response.redirect('/preview')
  })

  app.get('/health', (_request, response) => {
    sendNoCache(response)
    response.json(buildHealthPayload())
  })

  app.get('/preview', (_request, response) => {
    sendNoCache(response)
    response.type('html').send(createPreviewHtml())
  })

  app.get('/snapshot.jpg', (_request, response) => {
    if (!state.latestFrame) {
      response.status(503).type('text/plain').send('No rendered frame available yet.')
      return
    }
    sendNoCache(response)
    response.type('jpeg').send(state.latestFrame)
  })

  app.get('/video', (_request, response) => {
    response.redirect(`/hls/${PLAYLIST_FILENAME}`)
  })

  app.get('/hls/:filename', (request, response) => {
    const requestedPath = path.resolve(config.hlsDirectory, request.params.filename)
    if (!requestedPath.startsWith(config.hlsDirectory + path.sep) && requestedPath !== path.join(config.hlsDirectory, PLAYLIST_FILENAME)) {
      response.status(404).end()
      return
    }
    if (!fs.existsSync(requestedPath)) {
      response.status(404).type('text/plain').send('HLS output not ready.')
      return
    }
    sendNoCache(response)
    response.sendFile(requestedPath)
  })

  const server = app.listen(config.port, config.host, () => {
    console.log(`[renderer_headless] preview: http://${config.host}:${config.port}/preview`)
    console.log(`[renderer_headless] health: http://${config.host}:${config.port}/health`)
    console.log(`[renderer_headless] hls playlist: http://${config.host}:${config.port}/hls/${PLAYLIST_FILENAME}`)
  })

  let watchdogTimer
  if (config.watchdogEnabled) {
    watchdogTimer = setInterval(() => {
      const payload = buildHealthPayload()
      logStartupGraceState(payload)
      logHealthTransition(payload)
      if (payload.startup_grace_active) {
        if (healthRuntime.consecutiveFailures !== 0) {
          console.log('[renderer_headless] watchdog reset failure counter because startup grace is active')
        }
        healthRuntime.consecutiveFailures = 0
        return
      }
      if (payload.status === 'failed') {
        healthRuntime.consecutiveFailures += 1
        console.error(
          `[renderer_headless] watchdog observed failed health detail=${payload.statusDetail} count=${healthRuntime.consecutiveFailures}/${config.watchdogFailureThreshold}`,
        )
        if (
          !healthRuntime.watchdogExitRequested &&
          healthRuntime.consecutiveFailures >= config.watchdogFailureThreshold
        ) {
          healthRuntime.watchdogExitRequested = true
          console.error(
            `[renderer_headless] watchdog forcing restart after ${healthRuntime.consecutiveFailures} failed checks detail=${payload.statusDetail}`,
          )
          setTimeout(async () => {
            server.close()
            await renderer.stop()
            process.exit(1)
          }, 10)
        }
      } else {
        if (healthRuntime.consecutiveFailures !== 0) {
          console.log('[renderer_headless] watchdog reset failure counter because health recovered')
        }
        healthRuntime.consecutiveFailures = 0
      }
    }, config.watchdogIntervalMs)
  }

  async function shutdown(signal) {
    if (state.shutdownRequested) {
      return
    }
    console.log(`[renderer_headless] ${signal} received, shutting down`)
    state.shutdownRequested = true
    if (watchdogTimer) {
      clearInterval(watchdogTimer)
    }
    server.close()
    await renderer.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

main().catch((error) => {
  console.error('[renderer_headless] fatal error', error)
  process.exit(1)
})
