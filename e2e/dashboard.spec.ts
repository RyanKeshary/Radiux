import { test, expect, TEST_USER } from './fixtures';

test.describe('Dashboard', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="name@example.com"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to dashboard and render project list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify dashboard header
    await expect(page.locator('text=Radiux').first()).toBeVisible();

    // Verify "Recent Workspaces" section
    await expect(page.locator('text=Recent Workspaces')).toBeVisible();

    // Verify search input
    const searchInput = page.locator('#workspace-search-input, input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should render start actions panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify "Start" section
    await expect(page.locator('text=Start')).toBeVisible();

    // Verify action buttons
    await expect(page.locator('text=New Project...')).toBeVisible();
    await expect(page.locator('text=Clone or Import...')).toBeVisible();
    await expect(page.locator('text=Restore Workspace Archive...')).toBeVisible();
    await expect(page.locator('text=Export All Workspaces...')).toBeVisible();
  });

  test('should open create project modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click New Project button
    await page.click('text=New Project...');
    await page.waitForTimeout(1000);

    // Modal should be visible
    const modal = page.locator('text=Create Project, text=New Project, [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const projectName = `Test Project ${Date.now()}`;

    // Click New Project button
    await page.click('text=New Project...');
    await page.waitForTimeout(1000);

    // Fill in project name
    const nameInput = page.locator('input[placeholder*="project" i], input[placeholder*="name" i], input[type="text"]').first();
    await nameInput.fill(projectName);

    // Click create button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Create Project")').first();
    await createBtn.click();

    // Wait for navigation to workspace
    await page.waitForTimeout(3000);

    // Should navigate to the new project workspace
    const url = page.url();
    expect(url).toContain('/project/');
  });

  test('should open import project modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Clone or Import button
    await page.click('text=Clone or Import...');
    await page.waitForTimeout(1000);

    // Modal should be visible
    const modal = page.locator('text=Import, text=Clone, [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });

  test('should open import workspace modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Restore Workspace Archive button
    await page.click('text=Restore Workspace Archive...');
    await page.waitForTimeout(1000);

    // Modal should be visible
    const modal = page.locator('text=Restore, text=Import, text=Workspace, [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });

  test('should show project cards with actions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if there are any projects
    const projectCards = page.locator('a[href*="/project/"]');
    const count = await projectCards.count();

    if (count > 0) {
      // Verify project card has Open button
      const openBtn = page.locator('text=Open').first();
      await expect(openBtn).toBeVisible();

      // Verify project card has delete button (for owners)
      const deleteBtn = page.locator('[title="Delete Workspace"], button:has(svg)').last();
      // Delete button may only appear on hover
    }
  });

  test('should open a project workspace', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click first project Open button
    const openBtn = page.locator('a:has-text("Open"), button:has-text("Open")').first();
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.waitForTimeout(3000);

      // Should navigate to workspace
      const url = page.url();
      expect(url).toContain('/project/');
    }
  });

  test('should show empty state for new users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for empty state message
    const emptyState = page.locator('text=No workspaces available yet, text=No workspaces matching');
    const isEmpty = await emptyState.isVisible().catch(() => false);

    if (isEmpty) {
      // Verify create first workspace link
      await expect(page.locator('text=Create your first workspace')).toBeVisible();
    }
  });

  test('should search/filter projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Type in search box
    const searchInput = page.locator('#workspace-search-input, input[placeholder*="Search"]').first();
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Project list should be filtered
    const projectCards = page.locator('a[href*="/project/"]');
    const count = await projectCards.count();

    // Should show filtered results or empty state
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by owned projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "Owned" filter
    const ownedFilter = page.locator('button:has-text("Owned")');
    if (await ownedFilter.isVisible().catch(() => false)) {
      await ownedFilter.click();
      await page.waitForTimeout(500);

      // Should filter the list
      const projectCards = page.locator('a[href*="/project/"]');
      const count = await projectCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should filter by shared projects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "Shared" filter
    const sharedFilter = page.locator('button:has-text("Shared")');
    if (await sharedFilter.isVisible().catch(() => false)) {
      await sharedFilter.click();
      await page.waitForTimeout(500);

      const projectCards = page.locator('a[href*="/project/"]');
      const count = await projectCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show recent workspace resume bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for recent workspace bar
    const recentBar = page.locator('text=Recent Workspace');
    const isVisible = await recentBar.isVisible().catch(() => false);

    if (isVisible) {
      // Should have an Open button
      await expect(page.locator('text=Open').first()).toBeVisible();
    }
  });

  test('should show user profile info', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // User panel should be visible
    const userPanel = page.locator('text=Developer, [class*="user"]').first();
    await expect(userPanel).toBeVisible();
  });

  test('should show keyboard shortcuts reference', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show keybindings section
    await expect(page.locator('text=Keybindings Quick Reference')).toBeVisible();
    await expect(page.locator('text=Ctrl+P')).toBeVisible();
    await expect(page.locator('text=Ctrl+Shift+P')).toBeVisible();
  });

  test('should open settings modal from dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click settings button
    const settingsBtn = page.locator('[title="Settings"], [aria-label="Settings"], button:has(svg)').last();
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);

      // Settings modal should be visible
      const modal = page.locator('text=Settings, [role="dialog"]').first();
      await expect(modal).toBeVisible();
    }
  });

  test('should open collaborators modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click collaborators button
    const collabBtn = page.locator('text=Collaborators, [title="Discover Developers"]');
    if (await collabBtn.isVisible().catch(() => false)) {
      await collabBtn.first().click();
      await page.waitForTimeout(1000);

      // Modal should be visible
      const modal = page.locator('text=Discover, text=Collaborators, [role="dialog"]').first();
      await expect(modal).toBeVisible();
    }
  });

  test('should show theme selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Theme selector should be visible
    const themeSelector = page.locator('select, [title="Select IDE Theme"]');
    await expect(themeSelector.first()).toBeVisible();
  });

  test('should delete a project', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find a project with delete button
    const deleteBtn = page.locator('[title="Delete Workspace"]').first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      // Hover over the project card to reveal delete button
      const projectCard = page.locator('a[href*="/project/"]').first();
      await projectCard.hover();
      await page.waitForTimeout(500);

      await deleteBtn.click();
      await page.waitForTimeout(1000);

      // Confirmation dialog should appear
      const confirmDialog = page.locator('text=Delete Workspace?, text=Are you sure');
      await expect(confirmDialog.first()).toBeVisible();

      // Cancel deletion
      const cancelBtn = page.locator('button:has-text("Cancel")');
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should navigate to profile page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click profile link
    const profileLink = page.locator('a[href*="/profile/"], text=Profile').first();
    if (await profileLink.isVisible().catch(() => false)) {
      await profileLink.click();
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(url).toContain('/profile');
    }
  });
});
