import puppeteer from 'puppeteer'

const PAGE   = process.argv[2] || 'http://localhost:5173/link-planning'
const OUTPUT = process.argv[3] || 'screenshots/link-planning.png'

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
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise(r => setTimeout(r, 2500))
await page.screenshot({ path: OUTPUT, fullPage: false })
await browser.close()
console.log('Screenshot saved:', OUTPUT)
