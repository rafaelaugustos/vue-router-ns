import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const input = process.argv[2]
if (!input)
  throw new Error('Usage: node scripts/media/encode-airbnb.mjs /path/to/recording.mp4')
const root = fileURLToPath(new URL('../../', import.meta.url))
const media = resolve(root, 'docs/public/media')
const assets = resolve(root, '.github/assets')
mkdirSync(media, { recursive: true })
mkdirSync(assets, { recursive: true })
const output = resolve(media, 'ios-airbnb.mp4')
if (resolve(input) === output) throw new Error('Use the original recording as input')

const ffmpeg = (...args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  })

// Cuts from the 2026-10-23 AirbnbHomeReview recording. Remove SpringBoard,
// placeholder tabs and a repeated pause; retain real-time native transitions.
const cuts = [
  [8.2, 11.4],
  [14.5, 25.8],
  [27, 39],
]
const branches = cuts.map((_, i) => `[part${i}]`).join('')
const trims = cuts.map(
  ([start, end], i) =>
    `[part${i}]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[clip${i}]`,
)
const clips = cuts.map((_, i) => `[clip${i}]`).join('')
ffmpeg(
  '-i',
  input,
  '-filter_complex',
  [
    `[0:v]fps=30,scale=560:-2:flags=lanczos,split=${cuts.length}${branches}`,
    ...trims,
    `${clips}concat=n=${cuts.length}:v=1:a=0[out]`,
  ].join(';'),
  '-map',
  '[out]',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '24',
  '-pix_fmt',
  'yuv420p',
  '-an',
  '-map_metadata',
  '-1',
  '-movflags',
  '+faststart',
  output,
)

ffmpeg(
  '-ss',
  '0.5',
  '-i',
  output,
  '-frames:v',
  '1',
  '-q:v',
  '3',
  resolve(media, 'ios-airbnb.jpg'),
)
ffmpeg(
  '-ss',
  '14.5',
  '-t',
  '7.3',
  '-i',
  input,
  '-filter_complex',
  'fps=12,scale=280:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
  '-an',
  '-loop',
  '0',
  resolve(assets, 'demo-ios-airbnb.gif'),
)
console.log('Encoded Airbnb NS: 26.5s MP4, JPEG poster and 7.3s README GIF.')
