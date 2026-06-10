import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1050 })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('netsupportai-auth', JSON.stringify({
    state: {
      user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' },
      accessToken: 'dev-mock-token-for-screenshot',
    },
    version: 0,
  }))
})
await page.goto('http://localhost:5173/alert-rules', { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 1200))
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const btn = btns.find(b => b.textContent.trim().includes('Create Alert Rule'))
  if (btn) btn.click()
})
await new Promise(r => setTimeout(r, 1000))
// Scroll modal body to bottom to show Interface Speed / Duplex row
await page.evaluate(() => {
  const scrollable = document.querySelector('.overflow-y-auto')
  if (scrollable) scrollable.scrollTop = scrollable.scrollHeight
  document.querySelectorAll('[class*="toast"]').forEach(el => el.remove())
})
await new Promise(r => setTimeout(r, 300))
await page.screenshot({ path: 'screenshots/ar-speed-row.png', fullPage: false })
await browser.close()
console.log('saved screenshots/ar-speed-row.png')
