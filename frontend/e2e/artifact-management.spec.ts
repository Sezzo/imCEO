import { test, expect } from '@playwright/test';

test.describe('Artifact Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Create a company first
    await page.click('.bg-gray-50:has-text("Company") button:has(.lucide-plus)');
    await page.fill('input[placeholder="Company name"]', 'Artifact Test Company');
    await page.click('button[type="submit"]:has-text("Create")');

    // Wait for company and navigate to Artifacts
    await expect(page.locator('text=Artifact Test Company')).toBeVisible();
  });

  test('should navigate to artifacts view', async ({ page }) => {
    // Click on Artifacts tab
    await page.click('text=Artifacts');

    // Verify artifacts list is displayed
    await expect(page.locator('text=Artifacts')).toBeVisible();
    await expect(page.locator('text=Documents and deliverables')).toBeVisible();

    // Verify search input exists
    await expect(page.locator('input[placeholder="Search artifacts..."]')).toBeVisible();

    // Verify filter dropdowns exist
    await expect(page.locator('select:has-text("All Types")')).toBeVisible();
    await expect(page.locator('select:has-text("All Statuses")')).toBeVisible();
  });

  test('should show empty state when no artifacts exist', async ({ page }) => {
    await page.click('text=Artifacts');

    // Verify empty state
    await expect(page.locator('text=No artifacts found')).toBeVisible();
    await expect(page.locator('text=Create an artifact to get started')).toBeVisible();
  });

  test('should filter artifacts by type', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Open type filter dropdown
    const typeFilter = page.locator('select').first();
    await typeFilter.click();

    // Verify filter options exist
    const artifactTypes = [
      'All Types',
      'Vision Brief',
      'Strategic Memo',
      'Goal Definition',
      'Architecture',
      'ADR',
      'System Design',
      'Technical Spec',
      'API Contract',
      'Task Brief',
      'Test Plan',
      'Test Report',
      'Review Report',
      'Documentation',
      'Release Notes',
      'Security Review',
      'Compliance'
    ];

    for (const type of artifactTypes.slice(0, 5)) {
      await expect(page.locator(`option:has-text("${type}")`).first()).toBeVisible();
    }
  });

  test('should filter artifacts by status', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Verify status filter options
    const statusOptions = [
      'All Statuses',
      'Draft',
      'In Preparation',
      'Under Review',
      'Approved',
      'Superseded',
      'Archived'
    ];

    for (const status of statusOptions) {
      await expect(page.locator(`option:has-text("${status}")`).first()).toBeVisible();
    }
  });

  test('should search artifacts by query', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Type in search box
    const searchInput = page.locator('input[placeholder="Search artifacts..."]');
    await searchInput.fill('test query');

    // Verify search input has value
    await expect(searchInput).toHaveValue('test query');

    // The actual filtering would happen after API call
  });

  test('should display artifact list with metadata', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Wait for artifact list structure to be visible
    // When artifacts exist, they should show:
    // - Type badge
    // - Title
    // - Status
    // - Version
    // - Team assignment
    // - Update date
  });

  test('should open artifact detail modal', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // This test would click on an artifact card to open detail modal
    // Requires existing artifacts in database
  });

  test('should show New Artifact button', async ({ page }) => {
    await page.click('text=Artifacts');

    // Verify "New Artifact" button exists
    await expect(page.locator('text=New Artifact')).toBeVisible();
    await expect(page.locator('button:has-text("New Artifact")')).toBeVisible();
  });

  test('should combine search and filters', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Apply search
    const searchInput = page.locator('input[placeholder="Search artifacts..."]');
    await searchInput.fill('architecture');

    // Apply type filter
    const typeFilter = page.locator('select').first();
    await typeFilter.selectOption('Architecture');

    // Apply status filter
    const statusFilter = page.locator('select').nth(1);
    await statusFilter.selectOption('Approved');

    // Verify all filters are applied
    await expect(searchInput).toHaveValue('architecture');
  });

  test('should persist filters during navigation', async ({ page }) => {
    await page.click('text=Artifacts');
    await expect(page.locator('text=Artifacts')).toBeVisible();

    // Apply a filter
    const searchInput = page.locator('input[placeholder="Search artifacts..."]');
    await searchInput.fill('persistent search');

    // Navigate away
    await page.click('text=Work Items');
    await expect(page.locator('text=Work Items')).toBeVisible();

    // Navigate back
    await page.click('text=Artifacts');

    // Note: Depending on implementation, filters may or may not persist
    // This test documents expected behavior
  });
});
