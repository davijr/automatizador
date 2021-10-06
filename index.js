const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

init();

async function init() {
    PERIODO_REPETICAO = 5; // minutos
    QTD_MAX_REPETICOES = 1;
    const config = {
        headless: false,
        // devtools: false,
        // args: ['--no-sandbox', '--incognito', '--start-maximized']
    };
    browser = await puppeteer.launch(config);
    pages = [];
    run();
    setInterval(run, PERIODO_REPETICAO * 1000 * 60);
}

async function run() {
    try {
        console.log(`###  Iniciando... ### - Buscar ${QTD_MAX_REPETICOES} elementos.`);
        const steps = [
            {
                type: 'goto',
                pageName: 'randomwordgenerator',
                url: 'https://randomwordgenerator.com/',
                waitUntil: 'load'
            }, {
                type: 'scraping',
                pageName: 'randomwordgenerator',
                contentType: 'textContent',
                selector: 'li.support',
                field: 'query'
            }, {
                type: 'goto',
                pageName: 'thepiratebay',
                url: 'https://thepiratebay.org/search.php?cat=0&q=',
                isSearch: true,
                waitUntil: 'networkidle0'
            }, { // ordenar
                type: 'clickWithSearchByPosition',
                pageName: 'thepiratebay',
                selector: 'span.item-seed',
                position: 0
            }, { // obter qtd de SE
                type: 'scraping',
                pageName: 'thepiratebay',
                contentType: 'textContent',
                selector: 'span.item-seed',
                position: 1,
                field: 'qtdSE'
            }, { // obter qtd de SE
                type: 'scraping',
                pageName: 'thepiratebay',
                contentType: 'textContent',
                selector: 'span.item-icons a',
                position: 0,
                attribute: 'href',
                field: 'link'
            }/*, {
                type: 'clickWithSearchByPosition',
                pageName: 'thepiratebay',
                selector: 'span.item-icons a',
                position: 0
            }*/, {
                type: 'press',
                pageName: 'thepiratebay',
                keys: ['Control', 'KeyV'],
            }, {type: 'close'}
        ];
        // step-by-step
        let query;
        let qtdSE;
        let link;
        let qtdTentativas = 0;
        let qtdRepeticoes = 0;
        while (qtdRepeticoes < QTD_MAX_REPETICOES) {
            qtdTentativas++;
            query = "";
            qtdSE = null;
            link = null;
            for (let i in steps) {
                const step = steps[i];
                console.log(`${getDate()} ### [${i}] ${JSON.stringify(step)}`);
                switch (step.type) {
                    case 'goto':
                        try {
                            if (!pages[step.pageName]) {
                                pages[step.pageName] = await browser.newPage();
                                await pages[step.pageName].setViewport({ width: 1920, height: 1080});
                            }
                            // configConsoleLog(page);
                            const url = step.isSearch ? step.url + query : step.url;
                            await pages[step.pageName].goto(url, {waitUntil: step.waitUntil, timeout: 10 * 1000});
                        } catch(e) {
                            console.log("Ocorreu um erro ao tentar entrar na página.", e)
                        }
                    break;
                    case 'gotoDinamicLink':
                        if (link) {
                            console.log('Trying to download the link:', link);
                            await pages[step.pageName]._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: './'});
                            await pages[step.pageName].goto(link, {waitUntil: step.waitUntil});
                        }
                    break;
                    case 'waitForNavigation':
                        await pages[step.pageName][step.pageName].waitForNavigation();
                    break;
                    case 'waitForSelector':
                        await pages[step.pageName].waitForSelector(step.selector);
                    break;
                    case 'delay':
                        await delay(step.time);
                    break;
                    case 'type':
                        if (link) {
                            await pages[step.pageName].type(step.selector, link);
                        }
                    break;
                    case 'press':
                        if (step.keys) {
                            await pages[step.pageName].keyboard.down(step.keys[0]);
                            await pages[step.pageName].keyboard.press(step.keys[1]);
                            await pages[step.pageName].keyboard.up(step.keys[0]);
                        } else {
                            await pages[step.pageName].keyboard.press(step.key);
                        }
                        // TODO testes
                    break;
                    case 'dialog':
                        pages[step.pageName].on('dialog', async dialog => {
                            console.log(dialog.message());
                            await dialog.accept();
                        });
                    break;
                    case 'click':
                        await pages[step.pageName].click(step.selector);
                    break;
                    case 'clickWithSearch':
                        try {
                            await pages[step.pageName].evaluate((step) => {
                                [...document.querySelectorAll(step.selector)].find(element => element.textContent.indexOf(step.search) > 0).click();
                            }, step);
                        } catch(e) {console.error('Erro ao buscar elemento para efetuar click.', e)}
                    break;
                    case 'clickWithSearchByPosition':
                        try {
                            if (qtdSE >= QTD_MIN_SE) {
                                console.log(`### ENCONTROU TORRENT PARA QUERY: ${query} - Qtd SE: ${qtdSE} - Link: ${link}... ***`);
                                await pages[step.pageName].evaluate((step) => {
                                    setTimeout(() => {
                                        [...document.querySelectorAll(step.selector)][step.position].click();
                                    }, 1000);
                                }, step);
                                // if (step.hasDialog) {
                                //     await delay(15);
                                //     await page.on("dialog", async dialog => {
                                //         try {
                                //             await dialog.dismiss();
                                //         } catch (e) {}
                                //     });
                                // }
                                qtdRepeticoes++;
                            }
                        } catch(e) {console.error('Erro ao buscar elemento para efetuar click.', e)}
                    break;
                    case 'scraping':
                        try {
                            let content = null;
                            if (step.attribute) {
                                content = await pages[step.pageName].evaluate((step) => {
                                    let elements = document.querySelectorAll(step.selector);
                                    return elements[step.position].getAttribute(step.attribute);
                                }, step);
                            } else {
                                if (step.position) {
                                    content = await pages[step.pageName].evaluate((step) => {
                                        let elements = document.querySelectorAll(step.selector);
                                        return elements[step.position].textContent;
                                    }, step);
                                } else {
                                    content = await pages[step.pageName].evaluate((step) => {
                                        let element = document.querySelector(step.selector);
                                        return element.textContent;
                                    }, step);
                                }
                            }
                            if (step.field === 'query') {
                                query = content;
                                console.log(`### TENTATIVA DE Nº ${qtdTentativas} - Query: ${query} ***`);
                            }
                            if (step.field === 'qtdSE') {
                                qtdSE = Number(content);
                            }
                            if (step.field === 'link') {
                                link = content;
                                await pages[step.pageName].evaluate((link) => {
                                    navigator.clipboard.writeText(link);
                                }, link);
                            }
                            // TODO teste
                            await pages[step.pageName].evaluate(() => navigator.clipboard.writeText(link));
                            const teste = await pages[step.pageName].evaluate(() => {
                                return navigator.clipboard.readText();
                            });
                            console.log('teste', teste);
                        } catch(e) {console.error('Erro ao buscar elementos.', e)}
                    break;
                    case 'close':
                        if (qtdRepeticoes >= QTD_MAX_REPETICOES) {
                            // await browser.close();
                        }
                    break;
                }
            }
        }
        console.log('### Concluído ###');
    } catch(e) {
        console.log("Ocorreu um erro.", e)
    }
}

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time * 1000)
    });
}

function configConsoleLog(page) {
    if (page) {
        page.on('console', msg => {
            for (let i = 0; i < msg._args.length; ++i)
                console.log(`${i}: ${msg._args[i]}`);
        });
    }
}

function getDate() {
    const date = new Date();
    return  `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-`+
            `${date.getDate().toString().padStart(2, '0')}-${date.getHours().toString().padStart(2, '0')}-`+
            `${date.getMinutes().toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}-`+
            `${date.getMilliseconds().toString().padStart(3, '0')}`;
}