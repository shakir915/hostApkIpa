#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" }); // Set true for headless
  const page = await browser.newPage();
  var browserClosed = false;
  var pageID = process.argv[2];
  var filePath = process.argv[3];
  await page.goto('https://install4.web.app/upload.html?g_url_id=' + pageID); // replace with your site

  const input = await page.$('input[type=file]');
  await input.uploadFile(filePath);

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes("%")) {
      printProgress("Uploading... "+ text);
    } else if (text.includes("Upload is")) {
      // Ignore other "Upload is" messages
    } else if (text.includes("BUILD LINK")) {
        console.log('', "\n");
        console.log( text);
        console.log('', "\n");
        browser.close()
    } else {
      // Use console.error so it doesn't interfere with our progress display
      console.log('', msg.text());
    }
  });

  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#url_id_text');
      return el && el.textContent.trim().startsWith('https://');
    }, { timeout: 5*60*1000 });
    const urlIdText = await page.$eval('#url_id_text', el => el.textContent.trim());

  } catch (error) {
    console.error("Error waiting for URL:", error);
  }


})();

function printProgress(progress) {
  // Use process.stderr.write instead of process.stdout for more reliable line clearing
  process.stderr.clearLine();
  process.stderr.cursorTo(0);
  process.stderr.write(progress);
}