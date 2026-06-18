import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('netsupportai-auth', JSON.stringify({
    state: {
      user: { id: 'dev-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' },
      accessToken: 'dev-mock-token',
    },
    version: 0,
  }))
})
await page.goto('http://localhost:5173/link-planning', { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise(r => setTimeout(r, 2000))

// Click "Add New Link Plan"
const buttons = await page.$$('button')
for (const btn of buttons) {
  const txt = await btn.evaluate(el => el.textContent)
  if (txt && txt.includes('Link Plan')) {
    await btn.click()
    break
  }
}
await new Promise(r => setTimeout(r, 3000))

// Type Point A coordinates
const inputs = await page.$$('input[type="number"]')
console.log('Number inputs found:', inputs.length)
if (inputs.length >= 2) {
  await inputs[0].triple_click?.() // clear
  await inputs[0].click({ clickCount: 3 })
  await inputs[0].type('6.4541')
  await new Promise(r => setTimeout(r, 300))
  await inputs[1].click({ clickCount: 3 })
  await inputs[1].type('3.3947')
  await new Promise(r => setTimeout(r, 1500)) // wait for debounce
}

// Check DOM state after typing
const info = await page.evaluate(() => {
  const leaflet = document.querySelector('.leaflet-container')
  const markers = document.querySelectorAll('.leaflet-marker-icon')
  return {
    markerCount: markers.length,
    leafletTransform: leaflet?.querySelector('.leaflet-map-pane')?.style.transform,
    numberInputValues: Array.from(document.querySelectorAll('input[type="number"]')).map(i => i.value),
    // Try to call setView directly on the leaflet map instance
    leafletMapId: leaflet ? leaflet._leaflet_id : null,
  }
})
console.log('After typing:', JSON.stringify(info, null, 2))

// Now try calling Leaflet setView directly to verify Leaflet itself responds
await page.evaluate(() => {
  const container = document.querySelector('.leaflet-container')
  if (container && container._leaflet_id) {
    // Access the map via the global L object
    const map = window.L?.map ? null : null // L might not be global
    // Try via the leaflet internal maps registry
    const mapId = container._leaflet_id
    // react-leaflet stores map on _leaflet_events or we can try window
    console.log('leaflet container id:', mapId)
  }
})
const directCallResult = await page.evaluate(() => {
  // Try to trigger a pan by dispatching to any exposed leaflet reference
  const container = document.querySelector('.leaflet-container')
  if (!container) return 'no container'
  // Leaflet attaches the map object reference to the DOM element via internal key
  const keys = Object.keys(container).filter(k => k.startsWith('_leaflet'))
  return { keys, leafletId: container._leaflet_id }
})
console.log('Leaflet DOM keys:', JSON.stringify(directCallResult))

await page.screenshot({ path: 'screenshots/link-modal-typed.png', fullPage: false })
await browser.close()
console.log('Done')
