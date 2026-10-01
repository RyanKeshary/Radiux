import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  getUserColor,
  isMediaFile,
  USER_COLORS,
  LanguageType,
} from '@/lib/types';

describe('detectLanguage', () => {
  it('should detect JavaScript extensions', () => {
    // Arrange & Act & Assert
    expect(detectLanguage('script.js')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
    expect(detectLanguage('common.cjs')).toBe('javascript');
    expect(detectLanguage('component.jsx')).toBe('javascript');
  });

  it('should detect TypeScript extensions', () => {
    expect(detectLanguage('index.ts')).toBe('typescript');
    expect(detectLanguage('component.tsx')).toBe('typescript');
  });

  it('should detect HTML extensions', () => {
    expect(detectLanguage('index.html')).toBe('html');
    expect(detectLanguage('page.htm')).toBe('html');
  });

  it('should detect CSS extensions', () => {
    expect(detectLanguage('styles.css')).toBe('css');
    expect(detectLanguage('main.scss')).toBe('css');
    expect(detectLanguage('theme.less')).toBe('css');
  });

  it('should detect JSON extension', () => {
    expect(detectLanguage('package.json')).toBe('json');
    expect(detectLanguage('tsconfig.json')).toBe('json');
  });

  it('should detect Python extensions', () => {
    expect(detectLanguage('script.py')).toBe('python');
    expect(detectLanguage('app.pyw')).toBe('python');
  });

  it('should return plaintext for unknown extensions', () => {
    expect(detectLanguage('README.md')).toBe('plaintext');
    expect(detectLanguage('file.txt')).toBe('plaintext');
    expect(detectLanguage('data.xml')).toBe('plaintext');
    expect(detectLanguage('noextension')).toBe('plaintext');
  });

  it('should handle case-insensitive extensions', () => {
    expect(detectLanguage('SCRIPT.JS')).toBe('javascript');
    expect(detectLanguage('Index.TS')).toBe('typescript');
    expect(detectLanguage('STYLE.CSS')).toBe('css');
  });

  it('should handle files with multiple dots', () => {
    expect(detectLanguage('app.component.ts')).toBe('typescript');
    expect(detectLanguage('file.test.js')).toBe('javascript');
  });
});

describe('getUserColor', () => {
  it('should return a valid hex color', () => {
    const color = getUserColor('user-123');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should return consistent colors for the same ID', () => {
    const color1 = getUserColor('user-abc');
    const color2 = getUserColor('user-abc');
    expect(color1).toBe(color2);
  });

  it('should return colors from the USER_COLORS palette', () => {
    const color = getUserColor('test-user');
    expect(USER_COLORS).toContain(color);
  });

  it('should return different colors for different IDs (probabilistically)', () => {
    const colors = new Set<string>();
    for (let i = 0; i < 20; i++) {
      colors.add(getUserColor(`user-${i}`));
    }
    expect(colors.size).toBeGreaterThan(1);
  });

  it('should handle empty string', () => {
    const color = getUserColor('');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(USER_COLORS).toContain(color);
  });

  it('should handle special characters in ID', () => {
    const color = getUserColor('user@email.com!#');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('isMediaFile', () => {
  it('should detect image files', () => {
    const result = isMediaFile('photo.png');
    expect(result).toEqual({ isMedia: true, type: 'image' });
  });

  it('should detect various image formats', () => {
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif'];
    for (const ext of imageExts) {
      const result = isMediaFile(`file.${ext}`);
      expect(result.isMedia).toBe(true);
      expect(result.type).toBe('image');
    }
  });

  it('should detect video files', () => {
    const result = isMediaFile('video.mp4');
    expect(result).toEqual({ isMedia: true, type: 'video' });
  });

  it('should detect various video formats', () => {
    const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
    for (const ext of videoExts) {
      const result = isMediaFile(`file.${ext}`);
      expect(result.isMedia).toBe(true);
      expect(result.type).toBe('video');
    }
  });

  it('should detect audio files', () => {
    const result = isMediaFile('song.mp3');
    expect(result).toEqual({ isMedia: true, type: 'audio' });
  });

  it('should detect various audio formats', () => {
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
    for (const ext of audioExts) {
      const result = isMediaFile(`file.${ext}`);
      expect(result.isMedia).toBe(true);
      expect(result.type).toBe('audio');
    }
  });

  it('should return non-media for code files', () => {
    const result = isMediaFile('index.ts');
    expect(result).toEqual({ isMedia: false, type: 'none' });
  });

  it('should return non-media for document files', () => {
    expect(isMediaFile('doc.pdf').isMedia).toBe(false);
    expect(isMediaFile('sheet.xlsx').isMedia).toBe(false);
    expect(isMediaFile('readme.md').isMedia).toBe(false);
  });

  it('should handle case-insensitive extensions', () => {
    const result = isMediaFile('PHOTO.PNG');
    expect(result.isMedia).toBe(true);
    expect(result.type).toBe('image');
  });

  it('should handle files without extension', () => {
    const result = isMediaFile('Makefile');
    expect(result).toEqual({ isMedia: false, type: 'none' });
  });
});
