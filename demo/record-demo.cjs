'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const VIDEO_DIR = path.join(__dirname);
const OUTPUT_NAME = 'demo-jev-sentinel.webm';
const REHEARSAL = process.argv.includes('--rehearse');

// Helper Functions per ui-demo skill
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#3B82F6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
    cursor.style.cssText = `
      position: fixed; z-index: 999999; pointer-events: none;
      width: 28px; height: 28px;
      transition: left 0.08s ease-out, top 0.08s ease-out;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
    `;
    cursor.style.left = '100px';
    cursor.style.top = '100px';
    document.body.appendChild(cursor);
    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
  });
}

async function injectSubtitleBar(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-subtitle')) return;
    const bar = document.createElement('div');
    bar.id = 'demo-subtitle';
    bar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 999998; text-align: center; padding: 10px 28px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(59, 130, 246, 0.4);
      border-radius: 9999px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      color: #F8FAFC; font-family: -apple-system, 'Segoe UI', sans-serif;
      font-size: 15px; font-weight: 600; letter-spacing: 0.3px;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none; opacity: 0;
    `;
    bar.textContent = '';
    document.body.appendChild(bar);
  });
}

async function showSubtitle(page, text) {
  await page.evaluate((t) => {
    const bar = document.getElementById('demo-subtitle');
    if (!bar) return;
    if (t) {
      bar.textContent = t;
      bar.style.opacity = '1';
    } else {
      bar.style.opacity = '0';
    }
  }, text);
  if (text) await page.waitForTimeout(600);
}

async function ensureVisible(page, locator, label) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
  const visible = await el.isVisible().catch(() => false);
  if (!visible) {
    console.error(`REHEARSAL FAIL: "${label}" not found`);
    return false;
  }
  console.log(`REHEARSAL OK: "${label}"`);
  return true;
}

async function moveAndClick(page, locator, label, opts = {}) {
  const { postClickDelay = 1000, ...clickOpts } = opts;
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
  const visible = await el.isVisible().catch(() => false);
  if (!visible) {
    console.error(`WARNING: moveAndClick skipped - "${label}" not visible`);
    return false;
  }
  try {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = await el.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(350);
    }
    await el.click(clickOpts);
  } catch (e) {
    console.error(`WARNING: moveAndClick failed on "${label}": ${e.message}`);
    return false;
  }
  await page.waitForTimeout(postClickDelay);
  return true;
}

async function typeSlowly(page, locator, text, label, charDelay = 25) {
  const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
  const visible = await el.isVisible().catch(() => false);
  if (!visible) {
    console.error(`WARNING: typeSlowly skipped - "${label}" not visible`);
    return false;
  }
  await moveAndClick(page, el, label, { postClickDelay: 200 });
  await el.fill('');
  await el.pressSequentially(text, { delay: charDelay });
  await page.waitForTimeout(400);
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  if (REHEARSAL) {
    console.log('--- RUNNING REHEARSAL ---');
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(BASE_URL);

    const steps = [
      { label: 'Header Title', selector: 'h1' },
      { label: 'Latency stat', selector: '#stat-latency' },
      { label: 'Scenario 1 button', selector: '#btn-scenario-1' },
      { label: 'Scenario 2 button', selector: '#btn-scenario-2' },
      { label: 'Scenario 3 button', selector: '#btn-scenario-3' },
      { label: 'Scenario 4 button', selector: '#btn-scenario-4' },
      { label: 'Input textarea', selector: '#input-payload' },
      { label: 'Evaluate button', selector: '#btn-evaluate' },
      { label: 'Risk score badge', selector: '#res-risk' },
      { label: 'Action banner', selector: '#action-banner' },
      { label: 'Dispatch stream', selector: '#dispatch-stream' }
    ];

    let allOk = true;
    for (const step of steps) {
      if (!(await ensureVisible(page, step.selector, step.label))) {
        allOk = false;
      }
    }
    await browser.close();
    if (!allOk) {
      console.error('REHEARSAL FAILED');
      process.exit(1);
    }
    console.log('REHEARSAL PASSED - Ready to record!');
    return;
  }

  console.log('--- RECORDING PRO DEMO VIDEO ---');
  const context = await browser.newContext({
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL);
    await injectCursor(page);
    await injectSubtitleBar(page);

    // Step 1: Introduction
    await showSubtitle(page, '⚡️ Jev Sentinel: 220ms 超低遅延 AI ガードレール & 自動ディスパッチャー');
    await page.waitForTimeout(2500);

    // Step 2: Scenario 1 - SQL Attack & Security PR
    await showSubtitle(page, 'Step 1 - 破壊的コード・SQL攻撃差分のリアルタイム検知');
    await moveAndClick(page, '#btn-scenario-1', 'Scenario 1 (SQL Attack)', { postClickDelay: 1200 });
    await page.mouse.move(780, 260, { steps: 10 }); // Move cursor to risk score
    await page.waitForTimeout(1000);
    await page.mouse.move(820, 420, { steps: 8 }); // Move cursor to action banner
    await page.waitForTimeout(1800);

    // Step 3: Scenario 2 - Angry Customer Refund
    await showSubtitle(page, 'Step 2 - 激怒クレーマーの意図分類 ＆ Stripe 即時返金自動トリアージ');
    await moveAndClick(page, '#btn-scenario-2', 'Scenario 2 (Refund)', { postClickDelay: 1200 });
    await page.mouse.move(960, 320, { steps: 8 }); // Move cursor to urgency & refund
    await page.waitForTimeout(1000);
    await page.mouse.move(780, 520, { steps: 8 }); // Move cursor to live dispatch logs
    await page.waitForTimeout(1800);

    // Step 4: Scenario 3 - Autonomous Agent Tool Dispatch
    await showSubtitle(page, 'Step 3 - 自律エージェントのツール選定 (208ms で API 即時発火)');
    await moveAndClick(page, '#btn-scenario-3', 'Scenario 3 (Tool)', { postClickDelay: 1200 });
    await page.mouse.move(780, 260, { steps: 8 });
    await page.waitForTimeout(1500);

    // Step 5: Interactive Custom Input
    await showSubtitle(page, 'Step 4 - 自由入力: カスタム脆弱性コードをタイピングして審査');
    const customCode = `// 緊急ホットフィックス\nconst token = "sk-live-98f8b89c01a2";\ndb.execute("DELETE FROM orders WHERE user_id > 0;");`;
    await typeSlowly(page, '#input-payload', customCode, 'Custom input code', 20);
    await showSubtitle(page, '⚡️ 6 軸同時審査を一瞬 (214ms) で実行');
    await moveAndClick(page, '#btn-evaluate', 'Evaluate Button', { postClickDelay: 1500 });

    // Step 6: Final Result Pan & Closing
    await showSubtitle(page, '✅ 判定完了: 高危険度 2.99 / シークレット 0.98 を検知し PR を即時自動遮断！');
    await page.mouse.move(800, 420, { steps: 10 });
    await page.waitForTimeout(2200);

    await showSubtitle(page, '🎉 TypeSafe Jev: 生成型 LLM 比 10倍高速 & 90% コスト削減の System 1 基盤');
    await page.waitForTimeout(3000);
    await showSubtitle(page, '');

  } catch (err) {
    console.error('DEMO ERROR:', err);
  } finally {
    await context.close();
    const video = page.video();
    if (video) {
      const src = await video.path();
      const dest = path.join(VIDEO_DIR, OUTPUT_NAME);
      try {
        fs.copyFileSync(src, dest);
        console.log('Video saved successfully to:', dest);
      } catch (e) {
        console.error('ERROR: Failed to copy video:', e.message);
      }
    }
    await browser.close();
  }
})();
