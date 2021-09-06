// Modules
const puppeteer = require('puppeteer')

// Global variables
const productIds = ['4009996', '1813343']
const mainPageLink = 'https://www.bloomingdales.com/'
let categoryArray = []

// Core function
async function main () {
    // Start browser and create a new page
    let browser, page
    try {
        browser = await startBrowser('', true)
        page = await createPage(browser)
    } catch (error) {
        console.log('Failed to start browser process. ', error.message)
        process.exit()
    }

    const categoryLinks = []
    if (page) {
        console.log('='.repeat(5), 'Collecting Category links', '='.repeat(5))
        let linksData
        try {
            // Get item details
            linksData = await getCategoryLinks(page)
        } catch (error) {
            console.log(`Error: ${error.message}`)
        }
        // If details is ok -> push to the details array
        if (linksData) {
            const categoryGroup = linksData.menu[0].children[0].group[0].children[0].group
            for (let i = 0; i < categoryGroup.length; i++) {
                const obj = {
                    categoryId: categoryGroup[i].id,
                    categoryText: categoryGroup[i].text,
                    categoryUrl: categoryGroup[i].url
                }
                await categoryLinks.push(obj)
            }
            console.log('Data links received')
        }
        //console.log(`${mainPageLink}${categoryLinks[0].categoryUrl}`)
        console.log('='.repeat(30))
    }

    if (page) await page.close()
    if (browser) await browser.close()

    async function makingLinks(link, id){
        let newLink = []
        const pid = id
        for(let i = 0; i<link.length; i++){
            if(link[i] !== '?'){
                newLink[i] = link[i]
            } else {
                i = link.length
            }
        }

        const newText = newLink.join('')

        for(let i = 2; i < 14; i++) {
            let catLink = mainPageLink + newText + '/Pageindex/' + i + '?id=' + pid
            await categoryArray.push(catLink)
        }
    }

    for(let i = 0; i < categoryLinks.length; i++){
        categoryArray = categoryArray.flat()
        await categoryArray.push(`${mainPageLink}${categoryLinks[i].categoryUrl}`)
        await makingLinks(categoryLinks[i].categoryUrl, categoryLinks[i].categoryId)
    }

    categoryArray = categoryArray.flat()

    console.log(categoryArray.length)

    browser = await startBrowser('', true)
    page = await createPage(browser)

    let pidArray = []
    if (page) {
        console.log('='.repeat(5), 'Collecting Product ids', '='.repeat(5))
        let ids
        try {
            ids = await getIds(page, `${mainPageLink}${categoryLinks[0].categoryUrl}`)
        } catch (error) {
            console.log(`Error: ${error.message}`)
        }
        if (ids) {
            //console.log(ids)
            await pidArray.push(ids)
            pidArray = pidArray.flat()
            //console.log(pidArray)
        }
    }

    if (page) await page.close()
    if (browser) await browser.close()
    browser = await startBrowser('', true)
    page = await createPage(browser)

    // Start collecting details
    const detailsArray = []
    if (page) {
        console.log('='.repeat(5), 'Collecting details', '='.repeat(5))
        for (const pid of pidArray) {
            console.log(`[${pid}] Get details..`)
            let details
            try {
                // Get item details
                details = await getProductDetails(page, pid)
            } catch (error) {
                console.log(`[${pid}] Error: ${error.message}`)
            }
            // If details is ok -> push to the details array
            if (details) {
                console.log(`[${pid}] Details received`)
                detailsArray.push(details)
            }
            console.log('='.repeat(30))
        }
    }
    // Show details
    console.log(detailsArray)
    // Close everything and exit
    if (page) await page.close()
    if (browser) await browser.close()
}
main()

async function getProductDetails (page, pid) {
    // Get details
    await page.goto(`https://www.bloomingdales.com/xapi/digital/v1/product/${pid}?clientId=PROS&_regionCode=US&currencyCode=USD&_shoppingMode=SITE&size=small&_customerState=GUEST`, {
        waitUntil: 'networkidle0',
        timeout: 30000
    })
    // Parse details from page
    const details = await page.evaluate(() => document.body.innerText)
    if (details) return JSON.parse(details)
}

async function getCategoryLinks (page) {
    // Get Category links
    await page.goto('https://www.bloomingdales.com/xapi/navigate/v1/header?bypass_redirect=yes&viewType=Responsive&currencyCode=UAH&_regionCode=UA&_navigationType=BROWSE&_shoppingMode=SITE', {
        waitUntil: 'networkidle0',
        timeout: 30000
    })
    // Parse details from page
    const links = await page.evaluate(() => document.body.innerText)
    if (links) return JSON.parse(links)
}

async function getIds(page, link){
    const idArray = []

    await page.goto(link, {
        waitUntil: 'networkidle0',
        timeout: 30000
    })

    // function to get pid for every item id

    const doc = await page.evaluate(() => {
        const page_1 = []

        const lis = document.querySelectorAll('li.small-6.medium-4.large-4.cell')
        lis.forEach(li => {
            const obj = {
                pid: li.querySelector('div.productThumbnail').id
            }
            page_1.push(obj)
        })
        return page_1
    })

    if (doc){
        for(let i = 0;  i < doc.length; i++){
            idArray.push(doc[i].pid)
        }
        return idArray
    }
}

// Help functions
async function startBrowser (proxy, headless) {
    // Prepare browser args
    const browserArgs = {
        headless: headless,
        args: [
            '--no-sandbox',
            '--lang=en-US,en',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1280x900'
        ]
    }
    if (proxy) {
        browserArgs.args.push('--proxy-server=' + proxy)
    }
    // Launch browser
    return await puppeteer.launch(browserArgs)
}

async function createPage (browser) {
    const page = await browser.newPage()
    // Set additional options for browser page
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0')
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
    // Set default timeouts
    page.setDefaultNavigationTimeout(30000)
    page.setDefaultTimeout(30000)
    // Shot logs from browser page
    page.on('console', msg => {
        if (msg.type() === 'log') {
            console.log('Browser console: ', msg.text())
        }
    })
    return page
}

// Freeze the thread for [N] milliseconds
async function sleep (milliseconds = 1) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, milliseconds)
    })
}