import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('netsupportai-auth', JSON.stringify({
    state: {
      user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' },
      accessToken: 'dev-mock-token-for-screenshot',
    },
    version: 0,
  }))
})

const PORT = process.argv[2] || '5174'
const PAGE_PATH = process.argv[3] || '/alert-rules'
const OUTPUT = process.argv[4] || 'screenshots/latest.png'

await page.goto(`http://localhost:${PORT}${PAGE_PATH}`, { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 2000))
await page.evaluate(() => {
  document.querySelectorAll('[class*="toast"]').forEach(el => el.remove())
})
await page.screenshot({ path: OUTPUT, fullPage: false })
await browser.close()
console.log(`Screenshot saved: ${OUTPUT}`)
