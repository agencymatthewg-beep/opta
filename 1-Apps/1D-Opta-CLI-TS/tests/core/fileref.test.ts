import { describe, it, expect } from 'vitest';
import { parseLineRange, extractFileRefParts, isImagePath } from '../../src/core/fileref.js';

describe('isImagePath', () => {
  it('should detect .png as image', () => {
    expect(isImagePath('screenshot.png')).toBe(true);
  });

  it('should detect .jpg as image', () => {
    expect(isImagePath('photo.jpg')).toBe(true);
  });

  it('should detect .jpeg as image', () => {
    expect(isImagePath('photo.jpeg')).toBe(true);
  });

  it('should detect .gif as image', () => {
    expect(isImagePath('animation.gif')).toBe(true);
  });

  it('should detect .webp as image', () => {
    expect(isImagePath('image.webp')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isImagePath('PHOTO.PNG')).toBe(true);
    expect(isImagePath('Image.JPG')).toBe(true);
  });

  it('should reject non-image files', () => {
    expect(isImagePath('readme.md')).toBe(false);
    expect(isImagePath('agent.ts')).toBe(false);
    expect(isImagePath('config.json')).toBe(false);
  });

  it('should handle paths with directories', () => {
    expect(isImagePath('src/assets/logo.png')).toBe(true);
    expect(isImagePath('../images/photo.jpg')).toBe(true);
  });

  it('should reject files with no extension', () => {
    expect(isImagePath('Makefile')).toBe(false);
  });
});

describe('line range parsing', () => {
  it('should parse file:10-20 syntax', () => {
    const result = parseLineRange('src/agent.ts:10-20');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });

  it('should parse file:10 single line', () => {
    const result = parseLineRange('src/agent.ts:10');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 10 });
  });

  it('should return null for no line range', () => {
    const result = parseLineRange('src/agent.ts');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: null, endLine: null });
  });

  it('should extract @file:range from message', () => {
    const parts = extractFileRefParts('@src/agent.ts:10-20');
    expect(parts).toEqual({ original: '@src/agent.ts:10-20', path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });
});
