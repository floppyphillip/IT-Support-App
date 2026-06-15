import puppeteer from 'puppeteer'

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
await page.goto('http://localhost:5173/link-planning', { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise(r => setTimeout(r, 2000))

// Click "Add New Link Plan"
const buttons = await page.$$('button')
for (const btn of buttons) {
  const txt = await btn.evaluate(el => el.textContent)
  if (txt && txt.includes('Link Plan')) {
    await btn.click()
    break
  }
}
await new Promise(r => setTimeout(r, 3000))

// Check DOM state
const info = await page.evaluate(() => {
  const modal = document.querySelector('.fixed.inset-0')
  const leaflet = document.querySelector('.leaflet-container')
  const header = document.querySelector('.fixed.inset-0 header, .fixed.inset-0 [class*="border-b"]')
  return {
    modalFound: !!modal,
    modalBg: modal ? modal.style.background : null,
    leafletFound: !!leaflet,
    leafletBg: leaflet ? getComputedStyle(leaflet).background : null,
    leafletRect: leaflet ? JSON.stringify(leaflet.getBoundingClientRect()) : null,
    bodyBg: getComputedStyle(document.body).background,
  }
})
console.log('DOM info:', JSON.stringify(info, null, 2))

await page.screenshot({ path: 'screenshots/link-modal.png', fullPage: false })
await browser.close()
console.log('Done')
