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

await page.goto('http://localhost:3000/alert-rules', { waitUntil: 'networkidle2', timeout: 15000 })
await new Promise(r => setTimeout(r, 1500))

const btns = await page.$$('button')
for (const btn of btns) {
  const text = await btn.evaluate(el => el.textContent)
  if (text.includes('From Template')) { await btn.click(); break }
}
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: 'screenshots/alert-rules-tpl-dropdown.png' })

const allBtns2 = await page.$$('button')
for (const btn of allBtns2) {
  const text = await btn.evaluate(el => el.textContent)
  if (text.includes('Interface Down') && !text.includes('Admin')) { await btn.click(); break }
}
await new Promise(r => setTimeout(r, 600))
await page.screenshot({ path: 'screenshots/alert-rules-tpl-modal.png', fullPage: false })

await browser.close()
console.log('done')
