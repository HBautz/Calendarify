import { test, expect } from '@playwright/test';

test('selects a slot and queues email', async ({ page }) => {
  await page.goto('http://localhost:3000/booking');
  const firstSlot = page.locator('button.slot').first();
  await firstSlot.click();
  await expect(page.locator('#queued')).toHaveText(/queued/i);
});
