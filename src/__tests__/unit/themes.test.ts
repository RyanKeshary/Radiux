import { describe, it, expect } from 'vitest';
import { THEMES, ThemeId, ThemeDefinition, registerMonacoThemes, applyThemeVariables } from '@/lib/themes';

describe('THEMES', () => {
  it('should define all 8 themes', () => {
    const expectedThemes: ThemeId[] = [
      'dark',
      'light',
      'midnight',
      'dracula',
      'monokai',
      'nord',
      'solarized',
      'high-contrast',
    ];
    for (const themeId of expectedThemes) {
      expect(THEMES[themeId]).toBeDefined();
    }
    expect(Object.keys(THEMES)).toHaveLength(8);
  });

  it('should have valid structure for each theme', () => {
    for (const [id, theme] of Object.entries(THEMES)) {
      expect(theme.id).toBe(id);
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.type).toMatch(/^(dark|light)$/);
      expect(theme.monacoTheme).toBeTruthy();
      expect(theme.colors).toBeDefined();
    }
  });

  it('should have all required color properties', () => {
    const requiredColors = [
      'bg',
      'sidebar',
      'activity',
      'dock',
      'dockHeader',
      'tabActive',
      'tabInactive',
      'border',
      'text',
      'textMuted',
      'accent',
      'accentHover',
      'statusBar',
      'statusBarText',
      'inputBg',
      'cardBg',
    ];

    for (const theme of Object.values(THEMES)) {
      for (const colorKey of requiredColors) {
        expect(theme.colors[colorKey as keyof typeof theme.colors]).toBeDefined();
        expect(theme.colors[colorKey as keyof typeof theme.colors]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('should have correct theme types', () => {
    const darkThemes: ThemeId[] = ['dark', 'midnight', 'dracula', 'monokai', 'nord', 'solarized', 'high-contrast'];
    const lightThemes: ThemeId[] = ['light'];

    for (const id of darkThemes) {
      expect(THEMES[id].type).toBe('dark');
    }
    for (const id of lightThemes) {
      expect(THEMES[id].type).toBe('light');
    }
  });

  it('should have unique monaco theme names', () => {
    const monacoThemes = Object.values(THEMES).map((t) => t.monacoTheme);
    const unique = new Set(monacoThemes);
    expect(unique.size).toBe(monacoThemes.length);
  });

  it('should have unique theme IDs', () => {
    const ids = Object.values(THEMES).map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('registerMonacoThemes', () => {
  it('should register all monaco themes without throwing', () => {
    // Arrange
    const definedThemes: string[] = [];
    const mockMonaco = {
      editor: {
        defineTheme: (name: string, _theme: any) => {
          definedThemes.push(name);
        },
      },
    };

    // Act
    registerMonacoThemes(mockMonaco as any);

    // Assert
    expect(definedThemes).toContain('cc-dark');
    expect(definedThemes).toContain('cc-light');
    expect(definedThemes).toContain('cc-midnight');
    expect(definedThemes).toContain('cc-dracula');
    expect(definedThemes).toContain('cc-monokai');
    expect(definedThemes).toContain('cc-nord');
    expect(definedThemes).toContain('cc-solarized');
    expect(definedThemes).toHaveLength(7);
  });

  it('should define themes with valid structure', () => {
    const themes: any[] = [];
    const mockMonaco = {
      editor: {
        defineTheme: (name: string, theme: any) => {
          themes.push({ name, theme });
        },
      },
    };

    registerMonacoThemes(mockMonaco as any);

    for (const { name, theme } of themes) {
      expect(theme.base).toBeDefined();
      expect(theme.inherit).toBe(true);
      expect(Array.isArray(theme.rules)).toBe(true);
      expect(theme.rules.length).toBeGreaterThan(0);
      expect(theme.colors).toBeDefined();
    }
  });
});

describe('applyThemeVariables', () => {
  it('should set CSS variables on document root', () => {
    // Arrange
    const originalSetProperty = document.documentElement.style.setProperty;
    const setProperties: Record<string, string> = {};
    document.documentElement.style.setProperty = (key: string, value: string) => {
      setProperties[key] = value;
    };

    // Act
    applyThemeVariables('dark');

    // Assert
    expect(setProperties['--ide-bg']).toBe('#1e1e1e');
    expect(setProperties['--ide-sidebar']).toBe('#252526');
    expect(setProperties['--ide-accent']).toBe('#007acc');

    // Cleanup
    document.documentElement.style.setProperty = originalSetProperty;
  });

  it('should set data-theme attribute', () => {
    applyThemeVariables('dracula');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula');
  });

  it('should fallback to dark theme for invalid theme ID', () => {
    const originalSetProperty = document.documentElement.style.setProperty;
    const setProperties: Record<string, string> = {};
    document.documentElement.style.setProperty = (key: string, value: string) => {
      setProperties[key] = value;
    };

    applyThemeVariables('nonexistent' as ThemeId);

    expect(setProperties['--ide-bg']).toBe('#1e1e1e');

    document.documentElement.style.setProperty = originalSetProperty;
  });
});
