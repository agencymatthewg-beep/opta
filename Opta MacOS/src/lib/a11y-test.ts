/**
 * Accessibility Testing Utility (Development Only)
 *
 * Provides runtime accessibility checks in development mode.
 * Warns about common accessibility issues in the console.
 *
 * @see WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
 *
 * Usage:
 * ```tsx
 * // In main.tsx or App.tsx (development only)
 * import { initA11yTests } from '@/lib/a11y-test';
 *
 * if (import.meta.env.DEV) {
 *   initA11yTests();
 * }
 * ```
 */

type A11yIssue = {
  type: 'error' | 'warning' | 'info';
  element: Element;
  message: string;
  wcag?: string;
};

/**
 * Collect accessibility issues from the DOM
 */
function collectA11yIssues(): A11yIssue[] {
  const issues: A11yIssue[] = [];

  // Check for images without alt text
  const images = document.querySelectorAll('img:not([alt])');
  images.forEach((img) => {
    issues.push({
      type: 'error',
      element: img,
      message: 'Image is missing alt attribute',
      wcag: '1.1.1 Non-text Content',
    });
  });

  // Check for buttons without accessible names
  const buttons = document.querySelectorAll('button');
  buttons.forEach((btn) => {
    const hasText = btn.textContent?.trim();
    const hasAriaLabel = btn.getAttribute('aria-label');
    const hasAriaLabelledBy = btn.getAttribute('aria-labelledby');
    const hasTitle = btn.getAttribute('title');

    if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
      issues.push({
        type: 'error',
        element: btn,
        message: 'Button has no accessible name (add text content, aria-label, or title)',
        wcag: '4.1.2 Name, Role, Value',
      });
    }
  });

  // Check for links without accessible names
  const links = document.querySelectorAll('a[href]');
  links.forEach((link) => {
    const hasText = link.textContent?.trim();
    const hasAriaLabel = link.getAttribute('aria-label');
    const hasAriaLabelledBy = link.getAttribute('aria-labelledby');
    const hasTitle = link.getAttribute('title');
    const hasImg = link.querySelector('img[alt]');

    if (!hasText && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasImg) {
      issues.push({
        type: 'error',
        element: link,
        message: 'Link has no accessible name',
        wcag: '4.1.2 Name, Role, Value',
      });
    }
  });

  // Check for form inputs without labels
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
  inputs.forEach((input) => {
    const id = input.getAttribute('id');
    const hasAriaLabel = input.getAttribute('aria-label');
    const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
    const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
    const hasPlaceholder = input.getAttribute('placeholder');

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabel) {
      issues.push({
        type: hasPlaceholder ? 'warning' : 'error',
        element: input,
        message: hasPlaceholder
          ? 'Input uses placeholder as label - add a proper label for better accessibility'
          : 'Form input has no associated label',
        wcag: '1.3.1 Info and Relationships',
      });
    }
  });

  // Check for missing language attribute
  const html = document.documentElement;
  if (!html.getAttribute('lang')) {
    issues.push({
      type: 'warning',
      element: html,
      message: 'HTML element is missing lang attribute',
      wcag: '3.1.1 Language of Page',
    });
  }

  // Check for missing main landmark
  const main = document.querySelector('main, [role="main"]');
  if (!main) {
    issues.push({
      type: 'warning',
      element: document.body,
      message: 'Page has no <main> landmark',
      wcag: '1.3.1 Info and Relationships',
    });
  }

  // Check for missing heading structure
  const h1 = document.querySelector('h1');
  if (!h1) {
    issues.push({
      type: 'warning',
      element: document.body,
      message: 'Page has no <h1> heading',
      wcag: '1.3.1 Info and Relationships',
    });
  }

  // Check heading hierarchy (no skipping levels)
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let lastLevel = 0;
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1], 10);
    if (level > lastLevel + 1 && lastLevel !== 0) {
      issues.push({
        type: 'warning',
        element: heading,
        message: `Heading level skipped from h${lastLevel} to h${level}`,
        wcag: '1.3.1 Info and Relationships',
      });
    }
    lastLevel = level;
  });

  // Check for positive tabindex (generally bad practice)
  const positiveTabindex = document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])');
  positiveTabindex.forEach((el) => {
    const tabindex = parseInt(el.getAttribute('tabindex') || '0', 10);
    if (tabindex > 0) {
      issues.push({
        type: 'warning',
        element: el,
        message: `Positive tabindex (${tabindex}) can disrupt keyboard navigation order`,
        wcag: '2.4.3 Focus Order',
      });
    }
  });

  // Check for autoplay media
  const autoplayMedia = document.querySelectorAll('video[autoplay], audio[autoplay]');
  autoplayMedia.forEach((media) => {
    const muted = media.hasAttribute('muted');
    if (!muted) {
      issues.push({
        type: 'warning',
        element: media,
        message: 'Media has autoplay without muted attribute',
        wcag: '1.4.2 Audio Control',
      });
    }
  });

  // Check for clickable divs/spans without proper roles
  const clickableElements = document.querySelectorAll('[onclick]:not(button):not(a):not(input)');
  clickableElements.forEach((el) => {
    const hasRole = el.getAttribute('role');
    const hasTabindex = el.hasAttribute('tabindex');

    if (!hasRole || !hasTabindex) {
      issues.push({
        type: 'warning',
        element: el,
        message: 'Clickable element should use button/a tag or have role="button" and tabindex',
        wcag: '4.1.2 Name, Role, Value',
      });
    }
  });

  return issues;
}

/**
 * Log accessibility issues to console with styling
 */
function logA11yIssues(issues: A11yIssue[]): void {
  if (issues.length === 0) {
    console.log(
      '%c[A11y] No accessibility issues found',
      'color: #22c55e; font-weight: bold;'
    );
    return;
  }

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');
  const infos = issues.filter((i) => i.type === 'info');

  console.group(
    `%c[A11y] Found ${issues.length} accessibility issue(s)`,
    'color: #f59e0b; font-weight: bold;'
  );

  if (errors.length > 0) {
    console.group(`%cErrors (${errors.length})`, 'color: #ef4444; font-weight: bold;');
    errors.forEach((issue) => {
      console.log(
        `%c${issue.wcag || 'A11y'}%c ${issue.message}`,
        'background: #ef4444; color: white; padding: 2px 6px; border-radius: 3px;',
        'color: inherit;',
        issue.element
      );
    });
    console.groupEnd();
  }

  if (warnings.length > 0) {
    console.group(`%cWarnings (${warnings.length})`, 'color: #f59e0b; font-weight: bold;');
    warnings.forEach((issue) => {
      console.log(
        `%c${issue.wcag || 'A11y'}%c ${issue.message}`,
        'background: #f59e0b; color: black; padding: 2px 6px; border-radius: 3px;',
        'color: inherit;',
        issue.element
      );
    });
    console.groupEnd();
  }

  if (infos.length > 0) {
    console.group(`%cInfo (${infos.length})`, 'color: #3b82f6; font-weight: bold;');
    infos.forEach((issue) => {
      console.log(
        `%c${issue.wcag || 'A11y'}%c ${issue.message}`,
        'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 3px;',
        'color: inherit;',
        issue.element
      );
    });
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Run accessibility checks on the current DOM
 */
export function runA11yChecks(): A11yIssue[] {
  const issues = collectA11yIssues();
  logA11yIssues(issues);
  return issues;
}

/**
 * Initialize accessibility testing in development mode.
 *
 * Runs checks:
 * - After initial DOM load
 * - On DOM mutations (debounced)
 *
 * @param options Configuration options
 * @param options.interval Run periodic checks at this interval (ms). Set to 0 to disable.
 * @param options.watchDom Watch for DOM mutations and re-run checks
 */
export function initA11yTests(options: {
  interval?: number;
  watchDom?: boolean;
} = {}): () => void {
  // Only run in development
  if (!import.meta.env.DEV) {
    return () => {};
  }

  const { interval = 0, watchDom = true } = options;
  const cleanupFns: (() => void)[] = [];

  console.log(
    '%c[A11y] Accessibility testing initialized (development mode)',
    'color: #a855f7; font-weight: bold;'
  );

  // Run initial check after DOM is ready
  const runInitial = () => {
    setTimeout(() => {
      runA11yChecks();
    }, 1000);
  };

  if (document.readyState === 'complete') {
    runInitial();
  } else {
    window.addEventListener('load', runInitial);
    cleanupFns.push(() => window.removeEventListener('load', runInitial));
  }

  // Set up interval checking if enabled
  if (interval > 0) {
    const intervalId = setInterval(runA11yChecks, interval);
    cleanupFns.push(() => clearInterval(intervalId));
  }

  // Set up mutation observer if enabled
  if (watchDom) {
    let debounceTimer: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('%c[A11y] DOM changed, re-running checks...', 'color: #8b5cf6;');
        runA11yChecks();
      }, 2000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    cleanupFns.push(() => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    });
  }

  // Return cleanup function
  return () => {
    cleanupFns.forEach((fn) => fn());
    console.log('%c[A11y] Accessibility testing disabled', 'color: #6b7280;');
  };
}

export default { initA11yTests, runA11yChecks };
