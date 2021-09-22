// Modules
const puppeteer = require('puppeteer')
const fs = require('fs')
const moment = require('moment')
const converter = require('json-2-csv')
const csv = require('csv-parser')

// Global variables
const mainPageLink = 'https://www.bloomingdales.com/'
const mainPageLink_1 = 'https://www.bloomingdales.com'
const results = []
const pidArray = []

const dateFilename = 'clothes_' + moment().format('DD-MM-YYYY') + '_' + moment().format('hh-mm-ss') + '.csv'
const filename = dateFilename.replace(/[:]/g, '-')

// Core function
async function main () {
  fs.createReadStream('pid_08-09-2021_04-18-32.csv')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        (async () => {

          for(let i = 0; i < results.length; i++){
            if(results[i].tread_id === process.argv[2]){
              pidArray.push(results[i].pid)
            }
          }

          console.log(pidArray.length)

          // Start browser and create a new page
          let browser, page
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
            for (const pid of pidArray) {
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
              console.log('Get details availability..')
              try {
                // Get item availability
                let prodId = parseInt(detail.product[0].id)
                avail = await getProductAvailability(page, mainPageLink_1 + detail.product[0].identifier.productUrl, prodId)
              } catch (error) {
                console.log(`Error: ${error.message}`)
              }
              // If details is ok -> push to the details array
              if (avail) {
                console.log('Details received')
                stockDetailsArray.push(avail)
              }
              console.log('='.repeat(30))
            }
            if (page) await page.close()
            if (browser) await browser.close()
          }

          // Getting some fields form json
          const resultsDetails = []
          for (let i = 0; i < detailsArray.length; i++) {
            const object = {
              product_id: detailsArray[i].product[0].id,
              product_name: detailsArray[i].product[0].detail.name,
              vendor_name: detailsArray[i].product[0].detail.brand.name,
              category: detailsArray[i].product[0].detail.typeName,
              material: detailsArray[i].product[0].detail.materialsAndCare !== undefined
              ? detailsArray[i].product[0].detail.materialsAndCare[0]
              : '',
              top_category: detailsArray[i].product[0].identifier.topLevelCategoryName,
              instock_num: detailsArray[i].product[0].detail.maxQuantity,
              in_stock: stockDetailsArray[i] !== undefined
                  ? stockDetailsArray[i].available
                  : '',
              out_of_stock: stockDetailsArray[i] !== undefined
                  ? stockDetailsArray[i].unavailable
                  : '',
              cost_price: detailsArray[i].product[0].pricing !== undefined
                  ? detailsArray[i].product[0].pricing.price.tieredPrice[0].values[0].value
                  : '',
              product_url: mainPageLink_1 + detailsArray[i].product[0].identifier.productUrl,
              website_image_url: detailsArray[i].product[0].urlTemplate.swatchSprite + 'products/' + detailsArray[i].product[0].imagery.images[0].filePath + '?$2014_BROWSE_FASHION$&fmt=webp&op_usm=0.7,1.0,0.5,0&resMode=sharp2&qlt=85,0&wid=312&hei=390'
            }
            await resultsDetails.push(object)
          }

          console.log(resultsDetails.length)

          converter.json2csv(resultsDetails, (err, csv) => {
            if (err) {
              throw err
            }

            fs.appendFile(filename, csv, err => {
              if (err) throw err
              console.log('Data saved')
            })
          })
        })()
      })
}

main()

async function getProductDetails (page, pid) {
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


async function getProductAvailability (page, link, id) {
  await page.goto(link, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })
  console.log(id)
  // Setup some request delay
  await sleep(150)
  // function to get pid for every item id
  const stock = await page.evaluate(async (id) => {
    const labelsUnav = []
    const labelsAv = []
    if(document.querySelectorAll('li.size-chip-item')) {
      const lis = document.querySelectorAll('li.size-chip-item')
      lis.forEach(li => {
        if (li.querySelector('label.size-chip-label.small-size-chip.available')) {
          labelsAv.push(li.querySelector('label.size-chip-label.small-size-chip.available').innerText)
        }
        if (li.querySelector('label.size-chip-label.small-size-chip.unavailable')) {
          labelsUnav.push(li.querySelector('label.size-chip-label.small-size-chip.unavailable').innerText)
        }
        if (li.querySelector('label.size-chip-label.medium-size-chip.available')) {
          labelsUnav.push(li.querySelector('label.size-chip-label.medium-size-chip.available').innerText)
        }
        if (li.querySelector('label.size-chip-label.medium-size-chip.unavailable')) {
          labelsUnav.push(li.querySelector('label.size-chip-label.medium-size-chip.unavailable').innerText)
        }
      })
    }
    if(document.querySelector(`#size-dropdown-${id}`)) {
      let sizeAv, size
      const lengthOfSizes = document.querySelector(`#size-dropdown-${id}`).length
      for (let i = 2; i < lengthOfSizes + 1; i++) {
        sizeAv = document.querySelector(`#size-dropdown-${id} > option:nth-child(${i})`).textContent.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim()

        if (sizeAv.length > 12){
          size = document.querySelector(`#size-dropdown-${id} > option:nth-child(${i})`).dataset.name
          labelsUnav.push(size)
        } else {
          size = document.querySelector(`#size-dropdown-${id} > option:nth-child(${i})`).dataset.name
          labelsAv.push(size)
        }
      }
    }

    const obj = {
      available: labelsAv.length !== 0
          ? labelsAv.join(',')
          : '',
      unavailable: labelsUnav.length !== 0
      ? labelsUnav.join(',')
          : ''

    }
    return obj
  }, id)

  console.log(stock)
  if (stock) {
    return JSON.parse(JSON.stringify(stock))
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
async function sleep (milliseconds = 1) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}