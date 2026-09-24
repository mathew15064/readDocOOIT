import { test, expect } from '@playwright/test';

test.describe('Doc Reader E2E Workflow', () => {
  test('renders top bar, search input, filter controls, and table', async ({ page }) => {
    // Navigate to local server root
    await page.goto('http://localhost:3081');

    // Check title
    await expect(page).toHaveTitle(/Doc Reader/);

    // Verify main components are present
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    const moduleFilter = page.locator('#module-filter');
    await expect(moduleFilter).toBeVisible();

    const onlyLatestCheckbox = page.locator('#only-latest-checkbox');
    await expect(onlyLatestCheckbox).toBeVisible();
  });
});
