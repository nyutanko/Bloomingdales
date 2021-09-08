// Modules
const puppeteer = require('puppeteer')
const fs = require('fs')
const moment = require('moment')
const converter = require('json-2-csv')

// Global variables
const productNum = [13, 4, 3, 3, 15, 47, 21, 5, 28, 14, 24, 18, 14, 18, 34, 14, 72]
const mainPageLink = 'https://www.bloomingdales.com/'
const mainPageLink_1 = 'https://www.bloomingdales.com'
let categoryArray = []
let pidArray = []

const dateFilename = 'clothes_' + moment().format('DD-MM-YYYY') + '_' + moment().format('hh-mm-ss') + '.csv'
const filename = dateFilename.replace(/[:]/g, '-')

// Core function
async function main() {
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
        console.log('='.repeat(30))
    }

    if (page) await page.close()
    if (browser) await browser.close()

    //Creating links for each category
    for (let i = 0; i < categoryLinks.length; i++) {
        categoryArray = categoryArray.flat()
        await categoryArray.push(`${mainPageLink}${categoryLinks[i].categoryUrl}`)
        await makingLinks(categoryLinks[i].categoryUrl, categoryLinks[i].categoryId, productNum[i])
    }

    categoryArray = categoryArray.flat()

    for (let i = 0; i < categoryArray.length; i++) {
        console.log(categoryArray[i])
        try {
            browser = await startBrowser('', true)
            page = await createPage(browser)
        } catch (error) {
            console.log('Failed to start browser process. ', error.message)
            process.exit()
        }

        //Collecting products id
        let ids
        if (page) {
            console.log('='.repeat(5), 'Collecting Products id', '='.repeat(5))
            try {
                ids = await getIds(page, `${categoryArray[i]}`)
            } catch (error) {
                console.log(`Error: ${error.message}`)
            }

            if (ids) {
                console.log(`Ids received`)
            }

            console.log('='.repeat(30))
        }

        if (page) await page.close()
        if (browser) await browser.close()


        try {
            browser = await startBrowser('', true)
            page = await createPage(browser)
        } catch (error) {
            console.log('Failed to start browser process. ', error.message)
            process.exit()
        }

        // Start collecting details
        const detailsArray = []
        if (page) {
            console.log('='.repeat(5), 'Collecting details', '='.repeat(5))
            let details
            for (const pid of ids) {
                console.log(`[${pid}] Get details..`)
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

        if (page) await page.close()
        if (browser) await browser.close()

        const stockDetailsArray = []

        for (const detail of detailsArray) {
            try {
                browser = await startBrowser('', true)
                page = await createPage(browser)
            } catch (error) {
                console.log('Failed to start browser process. ', error.message)
                process.exit()
            }

            // Start collecting stock details
            if (page) {
                console.log('='.repeat(5), 'Collecting details availability', '='.repeat(5))
                let avail
                console.log(`Get details availability..`)
                try {
                    // Get item availability
                    avail = await getProductAvailability(page, mainPageLink_1 + detail.product[0].identifier.productUrl)
                } catch (error) {
                    console.log(`Error: ${error.message}`)
                }
                // If details is ok -> push to the details array
                if (avail) {
                    console.log(`Details received`)
                    stockDetailsArray.push(avail)
                }
                console.log('='.repeat(30))
            }
            if (page) await page.close()
            if (browser) await browser.close()
        }


        //Getting some fields form json
        const results = []
        for (let i = 0; i < detailsArray.length; i++) {
            const object = {
                pid: detailsArray[i].product[0].id,
                item_name: detailsArray[i].product[0].detail.name,
                vendor_name: detailsArray[i].product[0].detail.brand.name,
                product_line: detailsArray[i].product[0].detail.typeName,
                product_topCategory: detailsArray[i].product[0].identifier.topLevelCategoryName,
                instock_num: detailsArray[i].product[0].detail.maxQuantity,
                in_stock: stockDetailsArray[i] !== undefined ?
                    stockDetailsArray[i].available :
                    'No sizes',
                out_of_stock: stockDetailsArray[i] !== undefined ?
                    stockDetailsArray[i].unavailable :
                    'No sizes',
                cost_price: detailsArray[i].product[0].pricing.price.tieredPrice[0].values[0].value,
                //   ? detailsArray[i].allInfo.price.sales.value
                //   : detailsArray[i].allInfo.price.max.sales.value + '-' + res[i].allInfo.price.min.sales.value,
                item_url: mainPageLink_1 + detailsArray[i].product[0].identifier.productUrl,
                url: detailsArray[i].product[0].urlTemplate.swatchSprite + 'products/' + detailsArray[i].product[0].imagery.images[0].filePath + '?$2014_BROWSE_FASHION$&fmt=webp&op_usm=0.7,1.0,0.5,0&resMode=sharp2&qlt=85,0&wid=312&hei=390'
            }
            await results.push(object)
        }

        converter.json2csv(results, (err, csv) => {
            if (err) {
                throw err
            }

            fs.appendFile(filename, csv, err => {
                if (err) throw err
                console.log('Data saved')
            })
        })
    }
}

main()

async function getProductDetails(page, pid) {
    // Get details
    await page.goto(`https://www.bloomingdales.com/xapi/digital/v1/product/${pid}?clientId=PROS&_regionCode=US&currencyCode=USD&_shoppingMode=SITE&size=small&_customerState=GUEST`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    })
    // Setup some delay
    await sleep(330)
    // Parse details from page
    const details = await page.evaluate(() => document.body.innerText)
    if (details) return JSON.parse(details)
}

async function getCategoryLinks(page) {
    // Get Category links
    await page.goto('https://www.bloomingdales.com/xapi/navigate/v1/header?bypass_redirect=yes&viewType=Responsive&currencyCode=UAH&_regionCode=UA&_navigationType=BROWSE&_shoppingMode=SITE', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    })
    // Setup request delay
    await sleep(200)
    // Parse details from page
    const links = await page.evaluate(() => document.body.innerText)
    if (links) return JSON.parse(links)
}


async function getIds(page, link) {
    const idArray = []

    await page.goto(link, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    })
    // Setup request delay
    await sleep(200)
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

    if (doc) {
        for (let i = 0; i < doc.length; i++) {
            idArray.push(doc[i].pid)
        }
        return idArray
    }
}

async function getProductAvailability(page, link) {

    await page.goto(link, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    })
    // Setup some request delay
    await sleep(150)
    // function to get pid for every item id
    const stock = await page.evaluate(async () => {

        const lis = document.querySelectorAll('li.size-chip-item')
        const labelsUnav = []
        const labelsAv = []
        lis.forEach(li => {
            if (li.querySelector('label.size-chip-label.small-size-chip.available')) {
                labelsAv.push(li.querySelector('label.size-chip-label.small-size-chip.available').innerText)
            } else {
                labelsUnav.push(li.querySelector('label.size-chip-label.small-size-chip.unavailable').innerText)
            }
        })
        const obj = {
            available: labelsAv.join(','),
            unavailable: labelsUnav.join(',')
        }

        return obj
    })

    if (stock) {
        return JSON.parse(JSON.stringify(stock))
    }
}

async function makingLinks(link, id, num) {
    let newLink = []
    const pid = id
    for (let i = 0; i < link.length; i++) {
        if (link[i] !== '?') {
            newLink[i] = link[i]
        } else {
            i = link.length
        }
    }

    const newText = newLink.join('')

    for (let i = 2; i < num + 1; i++) {
        let catLink = mainPageLink + newText + '/Pageindex/' + i + '?id=' + pid
        await categoryArray.push(catLink)
    }
}

// Help functions
async function startBrowser(proxy, headless) {
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

async function createPage(browser) {
    const page = await browser.newPage()
    // Set additional options for browser page
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US'
    })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0')
    await page.setViewport({
        width: 1280,
        height: 900,
        deviceScaleFactor: 1
    })
    await page.setRequestInterception(true)
    page.on('request', (req) => {
        if (req.resourceType() === 'script' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image') {
            req.abort()
        } else {
            req.continue()
        }
    })
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
async function sleep(milliseconds = 1) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, milliseconds)
    })
}
