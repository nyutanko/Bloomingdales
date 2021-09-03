const puppeteer = require('puppeteer')
const fs = require('fs')


const link = 'https://www.bloomingdales.com/shop/womens-apparel?id=2910&cm_sp=NAVIGATION_INTL-_-TOP_NAV-_-WOMEN-n-n';

(async () => {
    let counter = 0

    try {
        const browser = await puppeteer.launch({ headless: false })
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36')
        await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' })


        await page.goto('https://www.bloomingdales.com/shop/womens-apparel/activewear-workout-clothes?id=11817&edge=hybrid&cm_sp=LEFTNAV_INT-_-women-_-Header-Active_%26_Workout')
        console.log('Going to ACTIVEWEAR & WORKOUT')

        console.log('Page: ' + (counter + 1))


        const res = []

        const ids = await page.evaluate(async () => {
            const page_1 = []

            try {
                const lis = document.querySelectorAll('li.small-6.medium-4.large-4.cell')
                lis.forEach(li => {
                    const obj = {
                        pid: li.querySelector('div.productThumbnail').id
                    }
                    page_1.push(obj)
                })
            } catch (e) {
                console.log(e)
            }
            return page_1
        })

        console.log(ids)

        // get request for every item

        const doc = await page.evaluate(() => {
            const data_1 = $.get({
                url: 'https://www.bloomingdales.com/xapi/digital/v1/product/4064835?clientId=PROS&_regionCode=UA&currencyCode=UAH&_shoppingMode=SITE&size=small&_customerState=GUEST',
                contentType: 'application/json',
                success: function (succeed, SuccessTextStatus, jqXHR) {
                    console.log({succeed, SuccessTextStatus, jqXHR})
                },
                error: function (jqXHR, status) {
                    console.log({jqXHR, status})
                }
            })
            return data_1
        })

        console.log(doc)

    } catch (e) {
        console.log(e)
    }
})()