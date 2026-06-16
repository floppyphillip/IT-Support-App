import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.evaluateOnNewDocument(() => {
  const mockState = {
    state: { user: { id: 'dev-user-1', full_name: 'Adewale Okafor', email: 'admin@netsupportai.com', role: 'superadmin' }, accessToken: 'dev-mock-token' },
    version: 0,
  }
  localStorage.setItem('netsupportai-auth', JSON.stringify(mockState))
})

await page.goto('http://localhost:5173/link-planning', { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 1500))

// Click "Add New Link Plan" button
const buttons = await page.$$('button')
for (const btn of buttons) {
  const text = await btn.evaluate(el => el.textContent.trim())
  if (text.includes('Add New Link Plan')) {
    await btn.click()
    break
  }
}
await new Promise(r => setTimeout(r, 2500))

await page.screenshot({ path: 'screenshots/link-planning-modal.png', fullPage: false })
await browser.close()
console.log('Screenshot saved: screenshots/link-planning-modal.png')
