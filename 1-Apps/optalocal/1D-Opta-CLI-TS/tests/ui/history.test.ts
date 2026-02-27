import { describe, it, expect } from 'vitest';
import { InputHistory } from '../../src/ui/history.js';

describe('InputHistory', () => {
  it('should store entries', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    expect(history.size()).toBe(2);
  });

  it('should navigate up through history', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    history.startNavigation();
    expect(history.previous()).toBe('second');
    expect(history.previous()).toBe('first');
    expect(history.previous()).toBe('first');
  });

  it('should navigate down through history', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    history.startNavigation();
    history.previous();
    history.previous();
    expect(history.next()).toBe('second');
    expect(history.next()).toBe('');
  });

  it('should not duplicate consecutive entries', () => {
    const history = new InputHistory();
    history.push('same');
    history.push('same');
    expect(history.size()).toBe(1);
  });

  it('should limit history size', () => {
    const history = new InputHistory(5);
    for (let i = 0; i < 10; i++) history.push(`entry${i}`);
    expect(history.size()).toBe(5);
  });

  it('should ignore empty entries', () => {
    const history = new InputHistory();
    history.push('');
    history.push('   ');
    expect(history.size()).toBe(0);
  });

  it('should trim entries before storing', () => {
    const history = new InputHistory();
    history.push('  hello  ');
    history.startNavigation();
    expect(history.previous()).toBe('hello');
  });

  it('should return empty string when navigating empty history', () => {
    const history = new InputHistory();
    history.startNavigation();
    expect(history.previous()).toBe('');
    expect(history.next()).toBe('');
  });

  it('should preserve oldest entries when at limit', () => {
    const history = new InputHistory(3);
    history.push('a');
    history.push('b');
    history.push('c');
    history.push('d');
    // Oldest 'a' should be evicted
    history.startNavigation();
    expect(history.previous()).toBe('d');
    expect(history.previous()).toBe('c');
    expect(history.previous()).toBe('b');
    expect(history.previous()).toBe('b'); // stays at oldest
  });
});
