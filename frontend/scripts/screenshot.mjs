import puppeteer from 'puppeteer'

const PAGE   = process.argv[2] || 'http://localhost:5173/dashboard'
const OUTPUT = process.argv[3] || 'screenshots/latest.png'
const WIDTH  = parseInt(process.argv[4] || '1400')
const HEIGHT = parseInt(process.argv[5] || '900')

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: WIDTH, height: HEIGHT })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('netsupportai-auth', JSON.stringify({ state: { user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' }, token: 'dev-mock-token' }, version: 0 }))
})
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 1500))
await page.evaluate(() => { document.querySelectorAll('[class*="toast"]').forEach(el => el.remove()) })
await page.screenshot({ path: OUTPUT, fullPage: false })
await browser.close()
console.log('Screenshot saved: ' + OUTPUT)
