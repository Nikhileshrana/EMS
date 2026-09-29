/**
 * Generate Android + iOS launcher icons and splash images from ../public/logo.jpeg
 *
 * Usage (from repo root): bun run mobile/scripts/generate-icons.mjs
 * Or: bun run --cwd mobile icons
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mobileRoot = resolve(__dirname, '..')
const src = resolve(mobileRoot, '../public/logo.jpeg')
const androidRes = resolve(mobileRoot, 'android/app/src/main/res')
const iosIcon = resolve(
  mobileRoot,
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
)
const iosSplashDir = resolve(mobileRoot, 'ios/App/App/Assets.xcassets/Splash.imageset')

const ANDROID_ICONS = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

// Adaptive foreground = 108dp * density (safe zone ~66% centered)
const ANDROID_FOREGROUND = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

const ANDROID_SPLASH = {
  drawable: { w: 480, h: 480 },
  'drawable-port-mdpi': { w: 320, h: 480 },
  'drawable-port-hdpi': { w: 480, h: 800 },
  'drawable-port-xhdpi': { w: 720, h: 1280 },
  'drawable-port-xxhdpi': { w: 1080, h: 1920 },
  'drawable-port-xxxhdpi': { w: 1440, h: 2560 },
  'drawable-land-mdpi': { w: 480, h: 320 },
  'drawable-land-hdpi': { w: 800, h: 480 },
  'drawable-land-xhdpi': { w: 1280, h: 720 },
  'drawable-land-xxhdpi': { w: 1920, h: 1080 },
  'drawable-land-xxxhdpi': { w: 2560, h: 1440 },
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

async function writePng(path, buffer) {
  await ensureDir(path)
  await writeFile(path, buffer)
  console.log('  wrote', path.replace(mobileRoot + '/', ''))
}

/** Square logo cover-fit */
async function squarePng(size) {
  return sharp(src).resize(size, size, { fit: 'cover' }).png().toBuffer()
}

/**
 * Adaptive foreground: logo inset so safe zone (~66%) keeps content visible
 * when masked to circle / squircle.
 */
async function foregroundPng(canvas) {
  const inset = Math.round(canvas * 0.72)
  const logo = await sharp(src)
    .resize(inset, inset, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Splash: solid white full-bleed canvas, logo centered (~62% short side) */
async function splashPng(w, h) {
  const short = Math.min(w, h)
  const logoSize = Math.round(short * 0.62)
  const logo = await sharp(src)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

console.log('Generating Capacitor icons/splash from public/logo.jpeg …')

for (const [folder, size] of Object.entries(ANDROID_ICONS)) {
  const buf = await squarePng(size)
  await writePng(resolve(androidRes, folder, 'ic_launcher.png'), buf)
  await writePng(resolve(androidRes, folder, 'ic_launcher_round.png'), buf)
}

for (const [folder, size] of Object.entries(ANDROID_FOREGROUND)) {
  const buf = await foregroundPng(size)
  await writePng(resolve(androidRes, folder, 'ic_launcher_foreground.png'), buf)
}

for (const [folder, { w, h }] of Object.entries(ANDROID_SPLASH)) {
  const buf = await splashPng(w, h)
  await writePng(resolve(androidRes, folder, 'splash.png'), buf)
}

await writePng(iosIcon, await squarePng(1024))

const splash2732 = await splashPng(2732, 2732)
await writePng(resolve(iosSplashDir, 'splash-2732x2732.png'), splash2732)
await writePng(resolve(iosSplashDir, 'splash-2732x2732-1.png'), splash2732)
await writePng(resolve(iosSplashDir, 'splash-2732x2732-2.png'), splash2732)

// Keep source masters under mobile/assets for future regenerations
const assetsDir = resolve(mobileRoot, 'assets')
await mkdir(assetsDir, { recursive: true })
await writePng(resolve(assetsDir, 'icon.png'), await squarePng(1024))
await writePng(resolve(assetsDir, 'splash.png'), splash2732)

// Shell pages (www) reference logo.jpeg for offline / bootstrap UI
const { copyFile } = await import('node:fs/promises')
await copyFile(src, resolve(mobileRoot, 'www/logo.jpeg'))
console.log('  wrote www/logo.jpeg')

console.log('Done.')
