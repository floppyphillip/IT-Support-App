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
const url = process.argv[2]
const out = process.argv[3]
await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 2000))
await page.evaluate(() => { document.querySelectorAll('[class*="toast"]').forEach(el => el.remove()) })
await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log('saved ' + out)
