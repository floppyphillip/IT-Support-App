import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 })

await page.evaluateOnNewDocument(() => {
  localStorage.setItem('netsupportai-auth', JSON.stringify({
    state: {
      user: { id: 'dev-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' },
      token: 'dev-mock-token', accessToken: 'dev-mock-token',
    },
    version: 0,
  }))
})

await page.goto('http://localhost:5173/devices', { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise(r => setTimeout(r, 1500))

// Click the first Ping button
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ping')
  if (btn) btn.click()
})

await new Promise(r => setTimeout(r, 600))
await page.screenshot({ path: 'screenshots/ping-modal.png', fullPage: false })
await browser.close()
console.log('✓ screenshots/ping-modal.png')
