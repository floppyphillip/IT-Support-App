import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

const logs = []
const errors = []
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', err => errors.push(err.message))

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

// Check all buttons
const btns = await page.$$('button')
const btnTexts = []
for (const btn of btns) {
  const txt = await btn.evaluate(el => el.textContent.trim())
  btnTexts.push(txt)
}
console.log('Buttons on page:', JSON.stringify(btnTexts))

// Click the right one
for (const btn of btns) {
  const txt = await btn.evaluate(el => el.textContent.trim())
  if (txt.includes('Link Plan')) {
    console.log('Clicking:', txt)
    await btn.click()
    break
  }
}
await new Promise(r => setTimeout(r, 3000))

if (errors.length) console.log('PAGE ERRORS:', errors.slice(0,3).join('\n'))
const errLogs = logs.filter(l => l.includes('[error]'))
if (errLogs.length) console.log('CONSOLE ERRORS:', errLogs.slice(0,5).join('\n'))

const dom = await page.evaluate(() => ({
  modalCount: document.querySelectorAll('[class*="fixed"]').length,
  modalClasses: [...document.querySelectorAll('[class*="fixed"]')].map(el => el.className.substring(0,60)),
}))
console.log('Fixed divs:', JSON.stringify(dom))

await browser.close()
