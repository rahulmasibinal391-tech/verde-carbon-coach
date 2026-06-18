/**
 * @fileoverview End-to-End browser tests for Verde Carbon Coach app.
 */

import { test, expect } from '@playwright/test';

test.describe('Verde Carbon Coach App Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local server
    await page.goto('/');

    // Verify splash screen is visible, then click to skip immediately
    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();
    await splash.click();
    await expect(splash).not.toBeVisible();
  });

  test('Log a trip -> emission shown -> total updates', async ({ page }) => {
    // Expand Transport card if collapsed
    const transportCard = page.locator('#card-transport');
    if (!(await transportCard.className()).includes('expanded')) {
      await page.locator('#card-transport .card-header').click();
    }

    // Enter trip details
    await page.selectOption('#trip-mode', 'bus');
    await page.fill('#trip-km', '25'); // 25 * 0.04 = 1.0 kg CO2e
    await page.click('#add-trip-btn');

    // Verify trip tag is appended
    const tripTag = page.locator('.trip-tag');
    await expect(tripTag).toBeVisible();
    await expect(tripTag).toContainText('Bus/Metro · 25 km');
    await expect(tripTag).toContainText('1.00 kg');

    // Verify card header total and gauge total
    await expect(page.locator('#transport-emission')).toContainText('1.0 kg');
    await expect(page.locator('#gauge-number')).toContainText('1.0');
  });

  test('Select diet + run AC -> click Get Insights -> panel renders -> history saved', async ({ page }) => {
    // Expand Diet card if collapsed
    const dietCard = page.locator('#card-diet');
    if (!(await dietCard.className()).includes('expanded')) {
      await page.locator('#card-diet .card-header').click();
    }

    // Select vegetarian diet (2.5 kg)
    await page.click('.diet-btn[data-diet="vegetarian"]');
    await expect(page.locator('#diet-emission')).toContainText('2.5 kg');

    // Expand Energy card if collapsed
    const energyCard = page.locator('#card-energy');
    if (!(await energyCard.className()).includes('expanded')) {
      await page.locator('#card-energy .card-header').click();
    }

    // Click AC stepper twice (increase by 1.0 hr -> 1 * 0.82 = 0.82 kg)
    const acPlus = page.locator('.stepper-btn[data-target="ac-hours"][data-dir="1"]');
    await acPlus.click();
    await acPlus.click();
    await expect(page.locator('#ac-hours')).toHaveValue('1');

    // Total emissions = 2.5 + 0.82 = 3.32 kg
    await expect(page.locator('#gauge-number')).toContainText('3.3');

    // Click Get Insights
    await page.click('#get-insights-btn');

    // Insights panel should be visible
    const insightsPanel = page.locator('#insights-panel');
    await expect(insightsPanel).toBeVisible();
    await expect(insightsPanel).toContainText('Verde');

    // Navigate to History View
    await page.click('#nav-history');
    await expect(page.locator('#view-history')).toBeVisible();

    // Verify entry is listed in history
    const historyList = page.locator('#history-list');
    await expect(historyList).toContainText('3.3 kg');
  });

  test('Reload the page -> history persists from localStorage', async ({ page }) => {
    // Seed localStorage directly prior to reload test
    await page.evaluate(() => {
      const mockHistory = [
        {
          date: new Date().toISOString().slice(0, 10),
          total: 5.8,
          breakdown: { transport: 0.8, diet: 2.5, energy: 2.5, shopping: 0, waste: 0, flight: 0 }
        }
      ];
      localStorage.setItem('verde_history', JSON.stringify(mockHistory));
    });

    // Reload page and skip splash
    await page.reload();
    await page.locator('#splash').click();

    // Verify streak count shows 1 day
    await expect(page.locator('#streak-count')).toContainText('1');

    // Go to history tab
    await page.click('#nav-history');
    
    // Check history table fallback and list contains seeded value
    const historyList = page.locator('#history-list');
    await expect(historyList).toContainText('5.8 kg');
    
    const srTable = page.locator('#history-sr-table');
    await expect(srTable).toBeVisible({ visible: false }); // hidden but present in DOM
    await expect(srTable).toContainText('5.8 kg CO2e');
  });

  test('Chat: send a message -> response renders -> XSS scripting escaped', async ({ page }) => {
    // Go to Chat view
    await page.click('#nav-chat');
    await expect(page.locator('#view-chat')).toBeVisible();

    // Formulate a malicious injection text
    const maliciousText = '<script>window.xssEscaped = true;</script> I am testing security.';
    await page.fill('#chat-input', maliciousText);
    await page.click('#chat-send-btn');

    // Verify user bubble renders text safely
    const userBubble = page.locator('.chat-msg.user .msg-bubble').first();
    await expect(userBubble).toBeVisible();
    await expect(userBubble).toHaveText(maliciousText);

    // Verify that the script did NOT execute
    const isScriptExecuted = await page.evaluate(() => window.xssEscaped === true);
    expect(isScriptExecuted).toBeFalsy();

    // Verify typing indicator and Verde response
    const verdeBubble = page.locator('.chat-msg.verde .msg-bubble').last();
    await expect(verdeBubble).toBeVisible();
  });
});
