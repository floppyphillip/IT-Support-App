import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.evaluateOnNewDocument(() => {
  // Pre-seed a saved plan with results so we can see a filled plan card
  const plan = {
    id: 'demo-plan-1',
    name: 'Lagos HQ to Island Tower',
    pointA: { lat: '6.5244', lng: '3.3792', height: '30' },
    pointB: { lat: '6.4550', lng: '3.4217', height: '20' },
    frequency: 5800,
    channelWidth: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    results: {
      distKm: 8.2, fspl: 115.5, rsl: -48.5, margin: 36.5,
      f1Mid: 12.3, losObstructed: false, obstructedCount: 0,
      mod: '256-QAM', throughput: 60, quality: 'excellent',
      elevA: 12, elevB: 8, antA: 42, antB: 28, bearing: 142.3,
      profile: Array.from({length:60},(_, i)=>{
        const t = i/59; const d = t*8.2;
        const los = 42 + (28-42)*t;
        const f1 = d>0&&d<8.2 ? 17.3*Math.sqrt((d*(8.2-d))/(5.8*8.2)) : 0;
        const elev = 12 + 4*Math.sin(t*Math.PI*2) - 4*t;
        return { dist: parseFloat(d.toFixed(3)), terrain: Math.round(elev), obstructedTerrain: null,
          los: parseFloat(los.toFixed(1)), fresnelUpper: parseFloat((los+f1).toFixed(1)),
          fresnelLower: parseFloat((los-f1).toFixed(1)), obstructed: false }
      })
    }
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
await page.screenshot({ path: 'screenshots/link-planning-cards.png', fullPage: false })

// Now open the saved plan
const cards = await page.$$('[class*="cursor-pointer"]')
let opened = false
for (const card of cards) {
  const txt = await card.evaluate(el => el.textContent)
  if (txt.includes('Lagos')) { await card.click(); opened = true; break }
}
if (!opened) {
  // Try clicking by plan name
  const allDivs = await page.$$('div')
  for (const d of allDivs) {
    const txt = await d.evaluate(el => el.textContent.trim())
    if (txt === 'Lagos HQ to Island Tower') { await d.click(); break }
  }
}
await new Promise(r => setTimeout(r, 5000))
await page.screenshot({ path: 'screenshots/link-modal-filled.png', fullPage: false })

await browser.close()
console.log('Screenshots done')
