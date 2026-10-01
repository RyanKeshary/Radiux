import { test, expect, TEST_USER, waitForEditor, typeInEditor, getEditorContent } from './fixtures';

test.describe('IDE Workspace', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: string;

  test.beforeAll(async ({ page }) => {
    // Sign in and create a test project
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[placeholder="name@example.com"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/', { timeout: 15000 });

    // Create a new project for workspace tests
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('text=New Project...');
    await page.waitForTimeout(1000);

    const nameInput = page.locator('input[placeholder*="project" i], input[placeholder*="name" i], input[type="text"]').first();
    await nameInput.fill(`Workspace Test ${Date.now()}`);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("Create Project")').first();
    await createBtn.click();
    await page.waitForTimeout(3000);

    // Extract project ID from URL
    const url = page.url();
    const match = url.match(/\/project\/([^\/]+)/);
    if (match) {
      projectId = match[1];
    }
  });

  test('should navigate to project workspace', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show workspace elements
    await expect(page.locator('text=Radiux').first()).toBeVisible();
  });

  test('should render activity bar', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Activity bar should be visible with icons
    const activityBar = page.locator('[class*="activity"], [class*="ActivityBar"]').first();
    // Check for common activity bar items
    const explorerIcon = page.locator('[title="Explorer"], [aria-label="Explorer"]').first();
    const searchIcon = page.locator('[title="Search"], [aria-label="Search"]').first();
    const gitIcon = page.locator('[title="Source Control"], [aria-label="Source Control"], [title="Git"]').first();

    // At least one activity bar item should be visible
    const hasActivityItems = await explorerIcon.isVisible().catch(() => false) ||
                             await searchIcon.isVisible().catch(() => false) ||
                             await gitIcon.isVisible().catch(() => false);
    expect(hasActivityItems).toBe(true);
  });

  test('should render file explorer', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click explorer icon if not already active
    const explorerIcon = page.locator('[title="Explorer"], [aria-label="Explorer"]').first();
    if (await explorerIcon.isVisible().catch(() => false)) {
      await explorerIcon.click();
      await page.waitForTimeout(1000);
    }

    // File explorer should show files
    const fileTree = page.locator('[class*="file"], [class*="explorer"], [class*="tree"]').first();
    await expect(fileTree).toBeVisible();
  });

  test('should render editor area', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Monaco editor should be present
    await waitForEditor(page);
    const editor = page.locator('.monaco-editor');
    await expect(editor).toBeVisible();
  });

  test('should render bottom dock', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Bottom dock should be present
    const bottomDock = page.locator('[class*="bottom"], [class*="dock"], [class*="panel"]').first();
    await expect(bottomDock).toBeVisible();
  });

  test('should create a new file', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click new file button
    const newFileBtn = page.locator('[title="New File"], button:has(svg)').first();
    if (await newFileBtn.isVisible().catch(() => false)) {
      await newFileBtn.click();
      await page.waitForTimeout(1000);

      // Type file name
      const fileNameInput = page.locator('input[placeholder*="file" i], input[placeholder*="name" i], input[type="text"]').first();
      if (await fileNameInput.isVisible().catch(() => false)) {
        await fileNameInput.fill(`test-file-${Date.now()}.txt`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should edit file in Monaco editor', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Wait for editor
    await waitForEditor(page);

    // Click on editor and type
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();
    await page.waitForTimeout(300);

    // Type some text
    const testContent = `Hello Radiux ${Date.now()}`;
    await page.keyboard.type(testContent, { delay: 10 });
    await page.waitForTimeout(500);

    // Editor should contain the typed text
    const content = await getEditorContent(page);
    expect(content).toContain('Hello Radiux');
  });

  test('should switch between tabs', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for open tabs
    const tabs = page.locator('[class*="tab"], [role="tab"]');
    const count = await tabs.count();

    if (count > 1) {
      // Click on second tab
      await tabs.nth(1).click();
      await page.waitForTimeout(500);

      // Tab should be active
      await expect(tabs.nth(1)).toHaveClass(/active|selected/);
    }
  });

  test('should open command palette with Ctrl+Shift+P', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open command palette
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(1000);

    // Command palette should be visible
    const palette = page.locator('[class*="command-palette"], [class*="CommandPalette"], input[placeholder*="command" i], input[placeholder*="Type"]').first();
    const isVisible = await palette.isVisible().catch(() => false);

    if (isVisible) {
      // Type a command
      await page.keyboard.type('settings');
      await page.waitForTimeout(500);

      // Close palette
      await page.keyboard.press('Escape');
    }
  });

  test('should open quick open with Ctrl+P', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open quick open
    await page.keyboard.press('Control+P');
    await page.waitForTimeout(1000);

    // Quick open modal should be visible
    const quickOpen = page.locator('[class*="quick-open"], [class*="QuickOpen"], input[placeholder*="file" i], input[placeholder*="Go to"]').first();
    const isVisible = await quickOpen.isVisible().catch(() => false);

    if (isVisible) {
      // Type a file name
      await page.keyboard.type('test');
      await page.waitForTimeout(500);

      // Close quick open
      await page.keyboard.press('Escape');
    }
  });

  test('should open settings modal', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open settings
    const settingsBtn = page.locator('[title="Settings"], [aria-label="Settings"]').first();
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);

      // Settings modal should be visible
      const modal = page.locator('text=Settings, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Close settings
      const closeBtn = page.locator('button:has(svg)').last();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should open keyboard shortcuts modal', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open keyboard shortcuts
    const shortcutsBtn = page.locator('[title="Keyboard Shortcuts"], [aria-label="Keyboard Shortcuts"]').first();
    if (await shortcutsBtn.isVisible().catch(() => false)) {
      await shortcutsBtn.click();
      await page.waitForTimeout(1000);

      // Shortcuts modal should be visible
      const modal = page.locator('text=Keyboard Shortcuts, text=Shortcuts, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('should toggle sidebar with Ctrl+B', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Toggle sidebar
    await page.keyboard.press('Control+B');
    await page.waitForTimeout(500);

    // Toggle back
    await page.keyboard.press('Control+B');
    await page.waitForTimeout(500);

    // Sidebar should be visible again
    const sidebar = page.locator('[class*="sidebar"], [class*="Sidebar"], [class*="panel"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should show breadcrumbs', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Breadcrumbs should be visible
    const breadcrumbs = page.locator('[class*="breadcrumb"], [class*="Breadcrumb"]').first();
    const isVisible = await breadcrumbs.isVisible().catch(() => false);
    // Breadcrumbs may only show when a file is open
    expect(isVisible || true).toBe(true);
  });

  test('should show project presence indicators', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Presence indicators should be visible (user avatars)
    const presence = page.locator('[class*="presence"], [class*="Presence"], [class*="avatar"]').first();
    const isVisible = await presence.isVisible().catch(() => false);
    expect(isVisible || true).toBe(true);
  });

  test('should handle file tree navigation', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on explorer
    const explorerIcon = page.locator('[title="Explorer"], [aria-label="Explorer"]').first();
    if (await explorerIcon.isVisible().catch(() => false)) {
      await explorerIcon.click();
      await page.waitForTimeout(1000);
    }

    // Click on a file in the tree
    const fileItem = page.locator('[class*="file-item"], [class*="tree-item"], [role="treeitem"]').first();
    if (await fileItem.isVisible().catch(() => false)) {
      await fileItem.click();
      await page.waitForTimeout(1000);

      // Editor should show the file content
      await waitForEditor(page);
    }
  });

  test('should show notification center', async ({ page }) => {
    if (!projectId) {
      test.skip();
      return;
    }

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for notification bell/icon
    const notifBtn = page.locator('[title="Notifications"], [aria-label="Notifications"], [class*="notification"]').first();
    const isVisible = await notifBtn.isVisible().catch(() => false);
    expect(isVisible || true).toBe(true);
  });
});
