import type { Guide } from './index';

export const browserAutomationGuide: Guide = {
  slug: 'browser-automation',
  title: 'Browser Automation Deep Dive',
  app: 'general',
  category: 'feature',
  summary: 'Understand how the Opta agent navigates the web, executes JavaScript, and interacts with UI elements using Playwright-based browser automation.',
  tags: ['browser', 'playwright', 'automation', 'mcp', 'agent'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'What is Browser Automation?',
      body: 'Browser automation provides your local AI agent the ability to operate a real Chromium browser programmatically. This is not a simulated environment—it is a full browser instance that executes JavaScript, renders CSS, and interacts with the DOM. The agent sees the page through accessibility tree snapshots and screenshots, allowing it to perform complex tasks like reading docs, testing web apps, or data scraping.'
    },
    {
      heading: 'Playwright & MCP Foundation',
      body: 'The automation system leverages <code>@playwright/mcp</code>, exposing over 30 browser control tools through the Model Context Protocol. This provides cross-browser support, reliable DOM element selection, network interception, and multi-tab management directly to the local intelligence engine.'
    },
    {
      heading: 'AI-Driven Navigation Workflow',
      body: 'Unlike traditional scripted automation, Opta's approach is dynamically driven by the model. The typical flow begins with the model calling <code>navigate</code> to load a URL, followed by <code>snapshot</code> to interpret the accessibility tree. It then decides whether to <code>click</code>, <code>type</code>, or evaluate the state, repeating this loop until the assigned goal is achieved.'
    },
    {
      heading: 'Policy & Permission Controls',
      body: 'To ensure safety, the <code>BrowserMcpInterceptor</code> routes all tool calls through the Opta policy engine. Safe actions like navigating to allowed domains or taking screenshots are auto-approved. Destructive actions, such as evaluating arbitrary JavaScript or uploading local files, trigger a strict permission prompt before execution.',
      note: 'In autonomous <strong>Do Mode</strong>, safe browser actions are auto-approved for fluent browsing, but data-exfiltration risks or destructive DOM manipulations will always require your explicit confirmation.'
    }
  ],
};
