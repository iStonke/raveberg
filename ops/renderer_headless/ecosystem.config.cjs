const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')
const startScript = path.join(repoRoot, 'ops', 'renderer_headless', 'start-renderer.sh')
const envFile = process.env.RAVEBERG_RENDERER_ENV_FILE || path.join(repoRoot, 'ops', 'renderer_headless', 'env.renderer')

module.exports = {
  apps: [
    {
      name: 'raveberg-renderer-headless',
      script: startScript,
      cwd: repoRoot,
      interpreter: '/bin/sh',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      min_uptime: '15s',
      kill_timeout: 10000,
      env: {
        RAVEBERG_RENDERER_ENV_FILE: envFile,
      },
    },
  ],
}
