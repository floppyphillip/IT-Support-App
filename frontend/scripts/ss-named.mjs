import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.evaluateOnNewDocument(() => {
  const plan = {
    id: 'demo-1',
    name: 'Lagos HQ to Island Tower',
    pointA: { name: 'Main Tower', lat: '6.5244', lng: '3.3792', height: '30' },
    pointB: { name: 'Island Site', lat: '6.4550', lng: '3.4217', height: '20' },
    frequency: 5800,
    channelWidth: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    results: {
      distKm: 8.2, fspl: 115.5, rsl: -48.5, margin: 36.5,
      f1Mid: 12.3, losObstructed: false, obstructedCount: 0,
      mod: '256-QAM', throughput: 60, quality: 'excellent',
      elevA: 12, elevB: 8, antA: 42, antB: 28, bearing: 142.3, profile: [],
    },
  }
  localStorage.setItem('netsupportai-link-plans', JSON.stringify([plan]))
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

// Click the plan card (the first .card element that's also cursor-pointer, skip stat cards)
const clicked = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('.card.cursor-pointer'))
  for (const c of cards) {
    if (c.textContent.includes('Lagos')) { c.click(); return true }
  }
  return false
})
console.log('Card clicked:', clicked)

await new Promise(r => setTimeout(r, 9000))
await page.screenshot({ path: 'screenshots/lp-modal-named.png' })

await browser.close()
console.log('done')
