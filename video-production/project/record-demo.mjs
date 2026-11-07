import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'

const projectDir = resolve(process.argv[2] ?? '.')
const configPath = join(projectDir, 'demo.config.json')
const planPath = join(projectDir, 'recording-plan.json')

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

const resolveEnvValue = (value) => {
  if (typeof value !== 'string') return value
  return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name) => {
    const resolved = process.env[name]
    if (!resolved) throw new Error(`Required environment variable ${name} is not set`)
    return resolved
  })
}

const projectPath = (value) => {
  const resolvedValue = resolveEnvValue(value)
  return isAbsolute(resolvedValue) ? resolvedValue : join(projectDir, resolvedValue)
}

const requireSelector = (action, index) => {
  if (!action.selector || action.selector.startsWith('REPLACE_')) {
    throw new Error(`Action ${index + 1} requires a verified selector`)
  }
  return action.selector
}

const performAction = async ({ page, action, index, startedAt, markers }) => {
  const timeout = action.timeout_ms ?? 30000
  switch (action.type) {
    case 'goto':
      await page.goto(resolveEnvValue(action.url), { waitUntil: action.wait_until ?? 'domcontentloaded', timeout })
      return markers
    case 'click':
      await page.locator(requireSelector(action, index)).first().click({ timeout })
      return markers
    case 'fill':
      await page.locator(requireSelector(action, index)).first().fill(resolveEnvValue(action.text), { timeout })
      return markers
    case 'type':
      await page.locator(requireSelector(action, index)).first().pressSequentially(resolveEnvValue(action.text), {
        delay: action.delay_ms ?? 35,
        timeout
      })
      return markers
    case 'press':
      if (action.selector) {
        await page.locator(requireSelector(action, index)).first().press(action.key, { timeout })
      } else {
        await page.keyboard.press(action.key)
      }
      return markers
    case 'wait_for':
      await page.locator(requireSelector(action, index)).first().waitFor({ state: action.state ?? 'visible', timeout })
      return markers
    case 'wait':
      await page.waitForTimeout(action.milliseconds ?? 500)
      return markers
    case 'scroll':
      await page.mouse.wheel(action.x ?? 0, action.y ?? 0)
      return markers
    case 'marker': {
      if (!action.name) throw new Error(`Action ${index + 1} marker requires a name`)
      const nextMarker = { name: action.name, seconds: (Date.now() - startedAt) / 1000 }
      return [...markers, nextMarker]
    }
    case 'screenshot': {
      const output = projectPath(action.path ?? `diagnostics/action-${index + 1}.png`)
      await mkdir(dirname(output), { recursive: true })
      await page.screenshot({ path: output, fullPage: Boolean(action.full_page) })
      return markers
    }
    default:
      throw new Error(`Action ${index + 1} has unsupported type: ${action.type}`)
  }
}

const main = async () => {
  const [config, plan] = await Promise.all([readJson(configPath), readJson(planPath)])
  const startUrl = resolveEnvValue(config.start_url ?? 'http://localhost:3000')
  try {
    const origin = new URL(startUrl).origin
    await fetch(`${origin}/api/demo/reset`, { method: 'POST' })
    console.log('✅ Demo state reset before recording')
  } catch (e) {
    console.warn('⚠️ Could not reset demo state:', e.message)
  }
  const width = config.video?.width ?? 1920
  const height = config.video?.height ?? 1080
  const rawVideoDir = join(projectDir, 'recordings', '.raw')
  const outputVideo = projectPath(config.recording?.output_video ?? 'recordings/raw-session.webm')
  const markerFile = projectPath(config.recording?.marker_file ?? 'recording-markers.json')
  const storageStateEnv = config.recording?.storage_state_env
  const storageStateValue = storageStateEnv ? process.env[storageStateEnv] : undefined
  const storageState = storageStateValue ? projectPath(storageStateValue) : undefined

  await mkdir(rawVideoDir, { recursive: true })
  await mkdir(dirname(outputVideo), { recursive: true })
  const browser = await chromium.launch({ headless: config.recording?.headless ?? false })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawVideoDir, size: { width, height } },
    ...(storageState ? { storageState } : {})
  })
  const page = await context.newPage()
  const video = page.video()
  const startedAt = Date.now()
  let markers = []

  try {
    for (const [index, action] of plan.actions.entries()) {
      markers = await performAction({ page, action, index, startedAt, markers })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Recording plan failed: ${message}`)
  } finally {
    await context.close()
    await browser.close()
  }

  if (!video) throw new Error('Playwright did not create a video artifact')
  const rawVideo = await video.path()
  await rm(outputVideo, { force: true })
  await rename(rawVideo, outputVideo)
  const markerDocument = {
    version: 1,
    video: config.recording?.output_video ?? 'recordings/raw-session.webm',
    markers
  }
  await writeFile(markerFile, `${JSON.stringify(markerDocument, null, 2)}\n`, 'utf8')
  process.stdout.write(`Recorded ${outputVideo}\nMarkers ${markerFile}\n`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
