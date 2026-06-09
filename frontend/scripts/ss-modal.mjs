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

await page.goto('http://localhost:5174/alert-rules', { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 1500))

// Click Create Alert Rule
const btns = await page.$$('button')
for (const btn of btns) {
  const txt = await btn.evaluate(el => el.textContent.trim())
  if (txt.includes('Create Alert Rule') && !txt.includes('No')) { await btn.click(); break }
}
await new Promise(r => setTimeout(r, 700))
await page.screenshot({ path: 'screenshots/ar-modal-open.png', fullPage: false })

// Scroll modal to bottom of Parameters section to show Interface row
const modal = await page.$('.overflow-y-auto')
if (modal) await page.evaluate(el => { el.scrollTop = 350 }, modal)
await new Promise(r => setTimeout(r, 300))
await page.screenshot({ path: 'screenshots/ar-modal-iface.png', fullPage: false })

await browser.close()
console.log('done')
