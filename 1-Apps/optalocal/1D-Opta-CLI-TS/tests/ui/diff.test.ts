import { describe, it, expect } from 'vitest';
import { formatUnifiedDiff, formatInlineDiff } from '../../src/ui/diff.js';

describe('diff rendering', () => {
  it('should format unified diff with colors', () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;`;
    const output = formatUnifiedDiff(diff);
    expect(output).toContain('file.ts');
  });

  it('should format inline diff between old and new text', () => {
    const output = formatInlineDiff('const x = 1;', 'const x = 2;');
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  it('should handle multi-line diffs', () => {
    const old = 'line1\nline2\nline3';
    const new_ = 'line1\nmodified\nline3';
    const output = formatInlineDiff(old, new_);
    expect(output).toContain('modified');
  });

  it('should handle additions', () => {
    const old = 'line1\nline2';
    const new_ = 'line1\nnew line\nline2';
    const output = formatInlineDiff(old, new_);
    expect(output).toContain('new line');
  });
});
