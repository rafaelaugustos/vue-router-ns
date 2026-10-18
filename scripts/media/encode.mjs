import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const media = resolve(root, 'docs/public/media')
const assets = resolve(root, '.github/assets')
const previews = new Set([
  'ios-tabs',
  'ios-context-menu',
  'android-sheet',
  'android-drawer',
])
const inputs = process.argv.slice(2)
if (!inputs.length)
  throw new Error('Usage: node scripts/media/encode.mjs /path/to/ios-tabs.mov ...')
mkdirSync(media, { recursive: true })

const ffmpeg = (...args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  })

for (const input of inputs) {
  const name = basename(input, extname(input))
  if (!/^(ios|ipad|android)-[a-z-]+$/.test(name)) {
    throw new Error(`Use a platform-prefixed recording name: ${name}`)
  }
  const video = resolve(media, `${name}.mp4`)
  if (resolve(input) === video) throw new Error('Use the raw recording as input')
  const width = name.startsWith('ipad-') ? 720 : 560
  ffmpeg(
    '-i',
    input,
    '-vf',
    `scale=${width}:-2,fps=30`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '26',
    '-pix_fmt',
    'yuv420p',
    '-an',
    '-movflags',
    '+faststart',
    video,
  )
  ffmpeg(
    '-ss',
    '0.5',
    '-i',
    video,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    resolve(media, `${name}.jpg`),
  )
  if (previews.has(name)) {
    ffmpeg(
      '-i',
      video,
      '-filter_complex',
      'fps=10,scale=220:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop',
      '0',
      resolve(assets, `demo-${name}.gif`),
    )
  }
  console.log(`Encoded ${name}`)
}
