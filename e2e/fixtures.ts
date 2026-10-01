import { test as base, Page, BrowserContext } from '@playwright/test';

/**
 * Test fixtures providing authenticated pages and common helpers.
 * Tests can use these to avoid duplicating auth boilerplate.
 */

export interface AuthCredentials {
  email: string;
  password: string;
}

export const TEST_USER: AuthCredentials = {
  email: process.env.TEST_USER_EMAIL || 'test@radiux.dev',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
};

export const ADMIN_USER: AuthCredentials = {
  email: process.env.ADMIN_USER_EMAIL || 'ryankeshary@gmail.com',
  password: process.env.ADMIN_USER_PASSWORD || 'AdminPassword123!',
};

/**
 * Signs in a user via the login page and waits for redirect to dashboard.
 */
export async function signIn(page: Page, creds: AuthCredentials = TEST_USER) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill in login form
  await page.fill('input[placeholder="name@example.com"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('**/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Signs out the current user.
 */
export async function signOut(page: Page) {
  // Open user menu
  const userMenu = page.locator('[title="User Menu"], [aria-label="User Menu"]').first();
  if (await userMenu.isVisible().catch(() => false)) {
    await userMenu.click();
    await page.waitForTimeout(500);
  }

  // Click sign out
  const signOutBtn = page.locator('text=Sign Out, text=Log Out, text=Logout').first();
  if (await signOutBtn.isVisible().catch(() => false)) {
    await signOutBtn.click();
    await page.waitForURL('**/login', { timeout: 10000 });
  }
}

/**
 * Navigates to a project workspace page.
 */
export async function openWorkspace(page: Page, projectId: string) {
  await page.goto(`/project/${projectId}`);
  await page.waitForLoadState('networkidle');
  // Wait for workspace to initialize
  await page.waitForTimeout(2000);
}

/**
 * Opens the command palette.
 */
export async function openCommandPalette(page: Page) {
  await page.keyboard.press('Control+Shift+P');
  await page.waitForTimeout(500);
}

/**
 * Opens quick open (file search).
 */
export async function openQuickOpen(page: Page) {
  await page.keyboard.press('Control+P');
  await page.waitForTimeout(500);
}

/**
 * Opens the terminal panel.
 */
export async function openTerminal(page: Page) {
  // Try keyboard shortcut first
  await page.keyboard.press('Control+`');
  await page.waitForTimeout(1000);

  // If terminal didn't open, try clicking the terminal icon
  const terminalIcon = page.locator('[title="Terminal"], [aria-label="Terminal"]').first();
  if (await terminalIcon.isVisible().catch(() => false)) {
    await terminalIcon.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Opens the Git panel.
 */
export async function openGitPanel(page: Page) {
  const gitIcon = page.locator('[title="Source Control"], [aria-label="Source Control"], [title="Git"]').first();
  if (await gitIcon.isVisible().catch(() => false)) {
    await gitIcon.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Opens the AI agent panel.
 */
export async function openAIPanel(page: Page) {
  const aiIcon = page.locator('[title="AI Agent"], [aria-label="AI Agent"], [title="Zodiac AI"]').first();
  if (await aiIcon.isVisible().catch(() => false)) {
    await aiIcon.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Opens the chat panel.
 */
export async function openChatPanel(page: Page) {
  const chatIcon = page.locator('[title="Chat"], [aria-label="Chat"]').first();
  if (await chatIcon.isVisible().catch(() => false)) {
    await chatIcon.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Opens the settings modal.
 */
export async function openSettings(page: Page) {
  const settingsBtn = page.locator('[title="Settings"], [aria-label="Settings"]').first();
  if (await settingsBtn.isVisible().catch(() => false)) {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Opens the keyboard shortcuts modal.
 */
export async function openKeyboardShortcuts(page: Page) {
  const shortcutsBtn = page.locator('[title="Keyboard Shortcuts"], [aria-label="Keyboard Shortcuts"]').first();
  if (await shortcutsBtn.isVisible().catch(() => false)) {
    await shortcutsBtn.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Creates a new project from the dashboard.
 */
export async function createProject(page: Page, name: string, description?: string) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Click New Project button
  await page.click('text=New Project...');
  await page.waitForTimeout(1000);

  // Fill in project name
  const nameInput = page.locator('input[placeholder*="project" i], input[placeholder*="name" i]').first();
  await nameInput.fill(name);

  if (description) {
    const descInput = page.locator('textarea[placeholder*="description" i], input[placeholder*="description" i]').first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill(description);
    }
  }

  // Click create/confirm button
  const createBtn = page.locator('button:has-text("Create"), button:has-text("Create Project")').first();
  await createBtn.click();
  await page.waitForTimeout(2000);
}

/**
 * Waits for the Monaco editor to be ready.
 */
export async function waitForEditor(page: Page) {
  await page.waitForSelector('.monaco-editor', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

/**
 * Types text into the Monaco editor.
 */
export async function typeInEditor(page: Page, text: string) {
  const editor = page.locator('.monaco-editor .view-lines').first();
  await editor.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 10 });
}

/**
 * Gets the text content of the Monaco editor.
 */
export async function getEditorContent(page: Page): Promise<string> {
  const lines = page.locator('.monaco-editor .view-line');
  const count = await lines.count();
  let content = '';
  for (let i = 0; i < count; i++) {
    const text = await lines.nth(i).textContent();
    content += (text || '') + '\n';
  }
  return content.trim();
}

/**
 * Waits for a toast/notification to appear.
 */
export async function waitForToast(page: Page, timeout: number = 5000) {
  const toast = page.locator('[role="alert"], .toast, .notification, [class*="toast"], [class*="notification"]').first();
  await toast.waitFor({ state: 'visible', timeout });
  return toast;
}

/**
 * Checks if an element is visible with a timeout.
 */
export async function isVisibleWithTimeout(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely clicks an element if it exists.
 */
export async function safeClick(page: Page, selector: string, timeout: number = 3000): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    await el.click();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely fills an input if it exists.
 */
export async function safeFill(page: Page, selector: string, value: string, timeout: number = 3000): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout });
    await el.fill(value);
    return true;
  } catch {
    return false;
  }
}

export { base as test };
export { expect } from '@playwright/test';
