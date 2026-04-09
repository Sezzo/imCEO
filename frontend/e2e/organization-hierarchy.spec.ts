import { test, expect } from '@playwright/test';

test.describe('Organization Hierarchy Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Create a company first
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');
    await page.fill('input[placeholder="Company name"]', 'Hierarchy Test Company');
    await page.click('button[type="submit"]:has-text("Create")');

    // Wait for company to be created
    await expect(page.locator('text=Hierarchy Test Company')).toBeVisible();
  });

  test('should create a division', async ({ page }) => {
    // Click add division button (Plus button next to Organization heading)
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();

    // Fill division form
    await page.fill('input[placeholder="Division name"]', 'Engineering Division');
    await page.fill('input[placeholder="Description (optional)"]', 'Main engineering division');

    // Submit form
    await page.click('button:has-text("Add")');

    // Verify division is displayed
    await expect(page.locator('text=Engineering Division')).toBeVisible();
  });

  test('should create department under division', async ({ page }) => {
    // Create division first
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();
    await page.fill('input[placeholder="Division name"]', 'Product Division');
    await page.click('button:has-text("Add")');

    // Wait for division to be visible
    await expect(page.locator('text=Product Division')).toBeVisible();

    // Click on division to expand it
    await page.locator('div:has-text("Product Division")').first().click();

    // Click "Add Department" button
    await page.click('text=Add Department');

    // Fill department form
    await page.fill('input[placeholder="Department name"]', 'Frontend Department');
    await page.fill('input[placeholder="Description (optional)"]', 'Frontend development team');

    // Submit form
    await page.click('button:has-text("Add")');

    // Verify department is displayed under the division
    await expect(page.locator('text=Frontend Department')).toBeVisible();
  });

  test('should create team under department', async ({ page }) => {
    // Create division
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();
    await page.fill('input[placeholder="Division name"]', 'Tech Division');
    await page.click('button:has-text("Add")');

    // Wait for division
    await expect(page.locator('text=Tech Division')).toBeVisible();

    // Expand division
    await page.locator('div:has-text("Tech Division")').first().click();

    // Add department
    await page.click('text=Add Department');
    await page.fill('input[placeholder="Department name"]', 'Development');
    await page.click('button:has-text("Add")');

    // Wait for department and expand it
    await expect(page.locator('text=Development')).toBeVisible();

    // Click on department to expand
    await page.locator('div:has-text("Development")').first().click();

    // Click "Add Team" button
    await page.click('text=Add Team');

    // Fill team form
    await page.fill('input[placeholder="Team name"]', 'Alpha Team');
    await page.fill('input[placeholder="Description (optional)"]', 'Core development team');
    await page.fill('input[placeholder="Mission (optional)"]', 'Build amazing products');

    // Submit form
    await page.click('form:has(input[placeholder="Team name"]) button:has-text("Add")');

    // Verify team is displayed
    await expect(page.locator('text=Alpha Team')).toBeVisible();
  });

  test('should display complete hierarchy', async ({ page }) => {
    // Create full hierarchy
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();
    await page.fill('input[placeholder="Division name"]', 'Global Division');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Global Division')).toBeVisible();
    await page.locator('div:has-text("Global Division")').first().click();

    await page.click('text=Add Department');
    await page.fill('input[placeholder="Department name"]', 'Sales Department');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Sales Department')).toBeVisible();
    await page.locator('div:has-text("Sales Department")').first().click();

    await page.click('text=Add Team');
    await page.fill('input[placeholder="Team name"]', 'Sales Team A');
    await page.click('form:has(input[placeholder="Team name"]) button:has-text("Add")');

    // Verify complete hierarchy is visible
    await expect(page.locator('text=Global Division')).toBeVisible();
    await expect(page.locator('text=Sales Department')).toBeVisible();
    await expect(page.locator('text=Sales Team A')).toBeVisible();
  });

  test('should delete division', async ({ page }) => {
    // Create division
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();
    await page.fill('input[placeholder="Division name"]', 'Temporary Division');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Temporary Division')).toBeVisible();

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button on division
    await page.locator('div:has-text("Temporary Division") button:has(.lucide-trash-2)').click();

    // Verify division is removed
    await expect(page.locator('text=Temporary Division')).not.toBeVisible();
  });

  test('should toggle division expansion', async ({ page }) => {
    // Create division with department
    await page.locator('.bg-gray-50:has-text("Organization") button:has(.lucide-plus)').click();
    await page.fill('input[placeholder="Division name"]', 'Toggle Division');
    await page.click('button:has-text("Add")');

    await expect(page.locator('text=Toggle Division')).toBeVisible();

    // Initially division should be collapsed (no Add Department button visible)
    await expect(page.locator('text=Add Department').first()).not.toBeVisible();

    // Click to expand
    await page.locator('div:has-text("Toggle Division")').first().click();

    // Now Add Department should be visible
    await expect(page.locator('text=Add Department').first()).toBeVisible();

    // Click to collapse
    await page.locator('div:has-text("Toggle Division")').first().click();
  });
});
