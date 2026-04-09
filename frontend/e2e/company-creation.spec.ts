import { test, expect } from '@playwright/test';

test.describe('Company Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open app and display initial state', async ({ page }) => {
    // Verify app header is displayed
    await expect(page.locator('h1', { hasText: 'imCEO' })).toBeVisible();
    await expect(page.locator('text=AI Company Operating System')).toBeVisible();

    // Verify initial empty state
    await expect(page.locator('text=No company created yet')).toBeVisible();
  });

  test('should create a new company', async ({ page }) => {
    // Click "Create Company" (Plus button next to Company heading)
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');

    // Fill company form
    await page.fill('input[placeholder="Company name"]', 'Test Company');
    await page.fill('input[placeholder="Description (optional)"]', 'A test company for E2E testing');

    // Submit form
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify company is displayed
    await expect(page.locator('text=Test Company')).toBeVisible();
    await expect(page.locator('text=A test company for E2E testing')).toBeVisible();

    // Verify org chart placeholder is shown
    await expect(page.locator('text=Create a company to start designing')).not.toBeVisible();
  });

  test('should validate company name is required', async ({ page }) => {
    // Click create company button
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]:has-text("Create")');
    await submitButton.click();

    // Verify form is still visible (submission prevented)
    await expect(page.locator('input[placeholder="Company name"]')).toBeVisible();
  });

  test('should allow only one company at a time', async ({ page }) => {
    // Create first company
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');
    await page.fill('input[placeholder="Company name"]', 'First Company');
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify create button is no longer visible
    await expect(page.locator('.bg-gray-50:has-text("Company") button:has(.lucide-plus)')).not.toBeVisible();

    // Verify company is displayed
    await expect(page.locator('h3:has-text("First Company")')).toBeVisible();
  });

  test('should cancel company creation', async ({ page }) => {
    // Click create company button
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');

    // Fill some data
    await page.fill('input[placeholder="Company name"]', 'Cancelled Company');

    // Click cancel
    await page.click('button[type="button"]:has(.lucide-x)');

    // Verify form is closed and company not created
    await expect(page.locator('text=No company created yet')).toBeVisible();
    await expect(page.locator('text=Cancelled Company')).not.toBeVisible();
  });
});
