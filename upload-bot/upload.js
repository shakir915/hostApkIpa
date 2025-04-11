#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {

  const homeDir = os.homedir(); 
  const destDir = path.join(homeDir, 'BuildCopy_my-user-data');
  fs.mkdirSync(destDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: destDir,
  });

  let exitCalled = false;
  async function close_browser(status) {
    if (exitCalled) return;
    exitCalled = true;
    try {
      await browser.close();
    } catch (e) {
      console.error("Browser already closed:", e.message);
    }
    process.exit(status);
  }

  const page = await browser.newPage();
  const pageID = process.argv[2];
  const filePath = process.argv[3];
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File does not exist: ${filePath}`);
    const { exec } = require('child_process');
    exec('say "ERROR : File does not exist"');
    process.exit(1);
  }

  await page.goto(`https://install4.web.app/upload.html?g_url_id=${pageID}`);

  const input = await page.$('input[type=file]');

  try {
    const homeDir = os.homedir(); // e.g., /Users/shakir
    const destDir = path.join(homeDir, 'BuildCopy');
    fs.mkdirSync(destDir, { recursive: true });
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '_').split('.')[0]; // YYYY_MM_dd_HH_mm_ss
    const fileName = `${pageID}_${timestamp}${path.extname(filePath)}`;
    const destPath = path.join(destDir, fileName);

    fs.copyFile(filePath, destPath, (err) => {
      if (err) {
        console.error('Error copying file:', err);
      } else {
        console.log('File copied to:', destPath);
      }
    });
  }catch (e) {
    console.error(e);
  }

  await input.uploadFile(filePath);

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes("File format is not recognized")) {
      console.log('\n');
      close_browser(-1);
    } else if (text.includes("%")) {
      printProgress("Uploading... " + text);
    } else if (text.includes("Upload is")) {
      // Skip
    } else if (text.includes("BUILD LINK")) {
      console.log('\n');
      console.log(text);
      console.log('\n');
      close_browser(0);
    } else {
      console.log('', msg.text());
    }
  });

  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#url_id_text');
      return el && el.textContent.trim().startsWith('https://');
    }, { timeout: 5 * 60 * 1000 });

    // Do not call browser.close here — let it happen in the console handler
  } catch (error) {
    console.error("Error waiting for URL:", error.message);
    await close_browser(1); // fail gracefully
  }
})();

function printProgress(progress) {
  process.stderr.clearLine?.();
  process.stderr.cursorTo?.(0);
  process.stderr.write(progress);
}
