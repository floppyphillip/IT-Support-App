import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

const mockPlans = [
  {
    id: 'plan-001',
    name: 'Lagos - Ibadan Backhaul',
    pointA: { lat: '6.5244', lng: '3.3792', height: '30' },
    pointB: { lat: '7.3775', lng: '3.9470', height: '25' },
    frequency: 5800,
    channelWidth: 40,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-14T15:30:00Z',
    results: {
      distKm: 100.5,
      fspl: 127.2,
      rsl: -60.2,
      margin: 24.8,
      f1Mid: 22.1,
      losObstructed: false,
      obstructedCount: 0,
      mod: '256-QAM',
      throughput: 120,
      quality: 'excellent',
      bearing: 42.3,
      elevA: 10, elevB: 15, antA: 40, antB: 40,
    }
  },
  {
    id: 'plan-002',
    name: 'Abuja City Loop',
    pointA: { lat: '9.0579', lng: '7.4951', height: '15' },
    pointB: { lat: '9.1234', lng: '7.5678', height: '15' },
    frequency: 5400,
    channelWidth: 20,
    created_at: '2026-06-10T08:00:00Z',
    updated_at: '2026-06-10T08:00:00Z',
    results: {
      distKm: 11.2,
      fspl: 107.4,
      rsl: -40.4,
      margin: 44.6,
      f1Mid: 12.4,
      losObstructed: false,
      obstructedCount: 0,
      mod: '256-QAM',
      throughput: 120,
      quality: 'good',
      bearing: 72.1,
      elevA: 350, elevB: 365, antA: 365, antB: 380,
    }
  },
  {
    id: 'plan-003',
    name: 'Port Harcourt Link',
    pointA: { lat: '4.8156', lng: '7.0498', height: '10' },
    pointB: { lat: '4.9000', lng: '7.1500', height: '10' },
    frequency: 5200,
    channelWidth: 10,
    created_at: '2026-06-12T12:00:00Z',
    updated_at: '2026-06-12T12:00:00Z',
    results: {
      distKm: 14.3,
      fspl: 109.5,
      rsl: -42.5,
      margin: 46.5,
      f1Mid: 14.2,
      losObstructed: true,
      obstructedCount: 5,
      mod: 'BPSK',
      throughput: 5,
      quality: 'marginal',
      bearing: 38.9,
      elevA: 12, elevB: 18, antA: 22, antB: 28,
    }
  }
]

await page.evaluateOnNewDocument((plans) => {
  const mockState = {
    state: { user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' }, accessToken: 'dev-mock-token' },
    version: 0,
  }
  localStorage.setItem('netsupportai-auth', JSON.stringify(mockState))
  localStorage.setItem('netsupportai-link-plans', JSON.stringify(plans))
}, mockPlans)

await page.goto('http://localhost:5173/link-planning', { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 2000))

await page.screenshot({ path: 'screenshots/link-planning-cards.png', fullPage: false })
await browser.close()
console.log('Screenshot saved')
