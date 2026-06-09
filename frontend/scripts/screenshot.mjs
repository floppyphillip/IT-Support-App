import puppeteer from 'puppeteer'

const PAGE   = process.argv[2] || 'http://localhost:5173/dashboard'
const OUTPUT = process.argv[3] || 'screenshots/latest.png'
const WIDTH  = parseInt(process.argv[4] || '1400')
const HEIGHT = parseInt(process.argv[5] || '900')

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: WIDTH, height: HEIGHT })

await page.evaluateOnNewDocument(() => {
  const mockState = {
    state: {
      user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' },
      accessToken: 'dev-mock-token-for-screenshot',
    },
    version: 0,
  }
  localStorage.setItem('netsupportai-auth', JSON.stringify(mockState))

  // Inject mock alerts so we can see if the component renders them
  const mockAlerts = [
    {
      id: 'ca-test-001',
      severity_level: 'Critical',
      device_name: 'CoreRouter-01',
      alert_name: 'High Latency',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      is_resolved: false,
      is_acknowledged: false,
    },
    {
      id: 'ca-test-002',
      severity_level: 'Warning',
      device_name: 'Switch-B2',
      alert_name: 'Ping Timeout',
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      is_resolved: false,
      is_acknowledged: true,
    },
    {
      id: 'ca-test-003',
      severity_level: 'Emergency',
      device_name: 'Firewall-Edge',
      alert_name: 'Down',
      created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      is_resolved: false,
      is_acknowledged: false,
    },
  ]
  localStorage.setItem('netsupportai-custom-alerts', JSON.stringify(mockAlerts))
})

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 2000))
await page.evaluate(() => {
  document.querySelectorAll('[class*="toast"]').forEach(el => el.remove())
})

await page.screenshot({ path: OUTPUT, fullPage: false })
await browser.close()
console.log(`Screenshot saved: ${OUTPUT}`)
