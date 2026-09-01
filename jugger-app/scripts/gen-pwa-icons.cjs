// One-time script: generates PWA icons from the tournament logo.
// Run: node scripts/gen-pwa-icons.cjs
const Jimp = require('jimp')
const path = require('path')

const SRC  = path.join(__dirname, '../public/Juggerknocker Invitational logo.png')
const OUT  = path.join(__dirname, '../public')
const BG   = 0x1a3a2fff  // masters-dark

async function makeIcon(size) {
  const logo    = await Jimp.read(SRC)
  const padding = Math.round(size * 0.15)
  const fit     = size - padding * 2
  logo.scaleToFit(fit, fit)

  const bg = new Jimp(size, size, BG)
  const x  = Math.round((size - logo.bitmap.width)  / 2)
  const y  = Math.round((size - logo.bitmap.height) / 2)
  bg.composite(logo, x, y)

  const outPath = path.join(OUT, `icon-${size}.png`)
  await bg.writeAsync(outPath)
  console.log(`✓ icon-${size}.png`)
}

;(async () => {
  for (const size of [512, 192, 180]) await makeIcon(size)
  console.log('Done.')
})()
