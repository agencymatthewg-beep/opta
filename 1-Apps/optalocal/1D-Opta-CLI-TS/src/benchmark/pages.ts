import type { BenchmarkNewsReport } from './news.js';

interface BenchmarkPagesInput {
  generatedAt: Date;
  newsReport: BenchmarkNewsReport;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphize(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function formatSourceLabel(source: string | undefined): string {
  if (!source) return 'source';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function renderBenchmarkHomePage(input: BenchmarkPagesInput): string {
  const generatedAt = input.generatedAt.toLocaleString();
  const fallbackBadge = input.newsReport.provider === 'fallback' ? 'Fallback mode' : `Provider: ${input.newsReport.provider}`;
  const benchmarks = [
    {
      id: 'landing',
      metric: '01 · Brand Surface',
      title: 'Opta Landing Experience',
      description: 'High-end landing narrative with animated visual hierarchy, product framing, and clear conversion pathways built around the Opta aesthetic language.',
      path: './landing/index.html',
      prompt: 'Create an Opta-branded landing page with premium typography, motion-rich section reveals, clear value messaging, and conversion-ready CTA flow.',
    },
    {
      id: 'chess',
      metric: '02 · Interaction Depth',
      title: 'Premium Chess Arena',
      description: 'Chess.com-inspired board experience with modern visual treatment, intelligent move handling, polished controls, and UX tuned for both desktop and mobile.',
      path: './chess/index.html',
      prompt: 'Build a premium chess web app inspired by chess.com with tactile board interactions, polished controls, move history, timer UX, and strong mobile responsiveness.',
    },
    {
      id: 'ai-news',
      metric: '03 · Research Intelligence',
      title: 'Live AI News Briefing',
      description: 'In-depth 500+ word report generated from the Opta research stack, with citation tracking and a structure designed for educational and strategic use.',
      path: './ai-news/index.html',
      prompt: 'Produce a 500+ word strategic summary of the most recent AI news with source citations, clear sectioning, and educational framing for product and engineering teams.',
    },
  ] as const;

  const benchmarkCards = benchmarks.map((benchmark, index) => {
    return `<article
        class="card${index === 0 ? ' active' : ''}"
        data-benchmark-card
        data-id="${benchmark.id}"
        data-path="${benchmark.path}"
        data-title="${escapeHtml(benchmark.title)}"
        data-prompt="${escapeHtml(benchmark.prompt)}"
        title="${escapeHtml(benchmark.prompt)}"
        tabindex="0"
        role="button"
        aria-label="Load ${escapeHtml(benchmark.title)} benchmark"
      >
        <span class="metric">${benchmark.metric}</span>
        <h2>${benchmark.title}</h2>
        <p>${benchmark.description}</p>
        <div class="card-actions">
          <button class="run-one" type="button" data-run-one="${benchmark.id}">Run Benchmark</button>
          <a class="open-link" href="${benchmark.path}" target="_blank" rel="noreferrer">Open standalone</a>
        </div>
      </article>`;
  }).join('\n');

  const benchmarkDataJson = JSON.stringify(benchmarks).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta Benchmark Suite</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #06030f;
      --panel: rgba(16, 10, 37, 0.82);
      --panel-soft: rgba(24, 15, 53, 0.62);
      --ink: #f2ecff;
      --muted: #b6a8da;
      --accent: #8f6bff;
      --accent-2: #15e4ff;
      --good: #29d8a1;
      --border: rgba(162, 133, 255, 0.35);
      --shadow: 0 24px 70px rgba(4, 2, 11, 0.66);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: 'Bricolage Grotesque', sans-serif;
      background:
        radial-gradient(circle at 12% 8%, rgba(143, 107, 255, 0.25), transparent 38%),
        radial-gradient(circle at 85% 15%, rgba(21, 228, 255, 0.13), transparent 38%),
        radial-gradient(circle at 45% 95%, rgba(133, 89, 255, 0.22), transparent 40%),
        linear-gradient(140deg, #070212, #120929 45%, #05040d);
      color: var(--ink);
      min-height: 100vh;
      padding: 40px 18px 56px;
    }

    .shell {
      width: min(1080px, 100%);
      margin: 0 auto;
      border: 1px solid var(--border);
      border-radius: 28px;
      background: linear-gradient(130deg, rgba(21, 12, 51, 0.88), rgba(10, 8, 23, 0.92));
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      overflow: hidden;
    }

    .hero {
      padding: 34px 34px 26px;
      border-bottom: 1px solid rgba(162, 133, 255, 0.28);
      display: grid;
      gap: 18px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      background: rgba(143, 107, 255, 0.17);
      border: 1px solid rgba(160, 132, 255, 0.45);
      color: #f8f4ff;
      border-radius: 999px;
      padding: 7px 13px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-family: 'IBM Plex Mono', monospace;
    }

    h1 {
      margin: 0;
      font-size: clamp(30px, 6vw, 58px);
      line-height: 1;
      letter-spacing: -0.02em;
      max-width: 15ch;
    }

    .hero p {
      margin: 0;
      color: var(--muted);
      max-width: 75ch;
      font-size: 17px;
      line-height: 1.6;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 4px;
    }

    .meta span {
      border-radius: 999px;
      padding: 6px 12px;
      border: 1px solid rgba(121, 208, 255, 0.5);
      color: #d9f7ff;
      background: rgba(18, 68, 98, 0.24);
      font: 500 12px 'IBM Plex Mono', monospace;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      padding: 22px;
    }

    .card {
      border: 1px solid rgba(163, 134, 255, 0.28);
      border-radius: 20px;
      padding: 20px;
      display: grid;
      gap: 14px;
      background: linear-gradient(140deg, var(--panel), var(--panel-soft));
      transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      text-decoration: none;
      color: inherit;
    }

    .card.active {
      border-color: rgba(205, 184, 255, 0.9);
      box-shadow: 0 0 0 1px rgba(182, 157, 255, 0.65), 0 16px 42px rgba(10, 7, 23, 0.58);
    }

    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(183, 161, 255, 0.62);
      box-shadow: 0 14px 35px rgba(9, 6, 21, 0.5);
    }

    .card h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
    }

    .card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
      font-size: 15px;
    }

    .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .run-one,
    .run-suite,
    .open-link {
      appearance: none;
      border: 1px solid rgba(179, 157, 255, 0.55);
      border-radius: 999px;
      padding: 8px 13px;
      font: 500 12px 'IBM Plex Mono', monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--ink);
      background: rgba(40, 24, 88, 0.58);
      cursor: pointer;
      transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
    }

    .run-one:hover,
    .run-suite:hover,
    .open-link:hover {
      border-color: rgba(209, 195, 255, 0.95);
      background: rgba(59, 34, 124, 0.7);
      transform: translateY(-1px);
    }

    .run-suite[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .metric {
      font: 500 12px 'IBM Plex Mono', monospace;
      color: #d7fff5;
      border: 1px solid rgba(41, 216, 161, 0.48);
      background: rgba(14, 60, 43, 0.32);
      width: fit-content;
      border-radius: 999px;
      padding: 6px 12px;
      letter-spacing: 0.03em;
    }

    .prompt-panel,
    .runner {
      margin: 0 22px 14px;
      border: 1px solid rgba(163, 134, 255, 0.32);
      border-radius: 18px;
      background: linear-gradient(140deg, rgba(16, 10, 37, 0.8), rgba(13, 9, 27, 0.86));
      padding: 14px;
      display: grid;
      gap: 10px;
    }

    .prompt-panel h3,
    .runner h3 {
      margin: 0;
      font-size: 16px;
      letter-spacing: -0.01em;
    }

    .prompt-panel p {
      margin: 0;
      color: #ded2ff;
      line-height: 1.58;
      font-size: 14px;
      font-family: 'IBM Plex Mono', monospace;
    }

    .runner-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .runner-meta {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .runner-state {
      font: 500 12px 'IBM Plex Mono', monospace;
      color: #d6f7ff;
      border: 1px solid rgba(21, 228, 255, 0.42);
      background: rgba(20, 72, 95, 0.28);
      border-radius: 999px;
      padding: 6px 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .frame-shell {
      border: 1px solid rgba(173, 147, 255, 0.48);
      border-radius: 12px;
      overflow: hidden;
      min-height: 420px;
      background: #090613;
    }

    .frame-shell iframe {
      border: 0;
      width: 100%;
      min-height: 420px;
      display: block;
      background: #0b0717;
    }

    .benchmarking-banner {
      position: sticky;
      top: 8px;
      z-index: 100;
      width: min(1080px, 100%);
      margin: 0 auto 8px;
      border: 1px solid rgba(55, 231, 179, 0.45);
      background: linear-gradient(120deg, rgba(13, 69, 52, 0.86), rgba(11, 64, 83, 0.8));
      border-radius: 14px;
      padding: 10px 14px;
      color: #e9fff9;
      font: 600 12px 'IBM Plex Mono', monospace;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      display: none;
    }

    .benchmarking-banner.active {
      display: block;
    }

    .footer {
      padding: 0 22px 22px;
      color: #9b8bbb;
      font: 500 12px 'IBM Plex Mono', monospace;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }

    @media (max-width: 760px) {
      .frame-shell,
      .frame-shell iframe {
        min-height: 320px;
      }
    }
  </style>
</head>
<body>
  <div id="benchmarking-banner" class="benchmarking-banner" aria-live="polite">Benchmarking</div>
  <main class="shell">
    <section class="hero">
      <span class="eyebrow">Opta Benchmarking System</span>
      <h1>Interactive capability benchmark for Opta CLI</h1>
      <p>This suite demonstrates product storytelling, premium interaction design, and research synthesis in one repeatable flow. Each app is generated by <strong>opta benchmark</strong> to exercise creation, polish, and insight-generation capabilities.</p>
      <div class="meta">
        <span>Generated: ${escapeHtml(generatedAt)}</span>
        <span>AI News Words: ${input.newsReport.wordCount}</span>
        <span>${escapeHtml(fallbackBadge)}</span>
      </div>
    </section>

    <section class="grid">
      ${benchmarkCards}
    </section>

    <section class="prompt-panel" aria-live="polite">
      <h3>Prompt Preview (hover a benchmark card)</h3>
      <p id="prompt-preview">${escapeHtml(benchmarks[0].prompt)}</p>
    </section>

    <section class="runner">
      <div class="runner-head">
        <h3>Benchmark Runner</h3>
        <div class="runner-meta">
          <button id="run-suite" class="run-suite" type="button">Run Suite</button>
          <span id="runner-state" class="runner-state">Viewing: ${escapeHtml(benchmarks[0].title)}</span>
        </div>
      </div>
      <div class="frame-shell">
        <iframe id="benchmark-frame" src="${benchmarks[0].path}" title="Benchmark viewer"></iframe>
      </div>
    </section>

    <footer class="footer">
      <span>Use <strong>opta benchmark --serve</strong> to launch locally.</span>
      <span>Built for capability demonstration, learning, and repeatable evaluation.</span>
    </footer>
  </main>

  <script>
    (function () {
      const benchmarkData = ${benchmarkDataJson};
      const benchmarkMap = new Map(benchmarkData.map((item) => [item.id, item]));
      const benchmarkOrder = benchmarkData.map((item) => item.id);
      const cards = Array.from(document.querySelectorAll('[data-benchmark-card]'));
      const runButtons = Array.from(document.querySelectorAll('[data-run-one]'));
      const frame = document.getElementById('benchmark-frame');
      const promptPreview = document.getElementById('prompt-preview');
      const runSuiteButton = document.getElementById('run-suite');
      const runnerState = document.getElementById('runner-state');
      const banner = document.getElementById('benchmarking-banner');

      let suiteRunning = false;

      function waitForFrameLoad() {
        return new Promise((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          const timeout = window.setTimeout(done, 1700);
          frame.addEventListener('load', () => {
            window.clearTimeout(timeout);
            done();
          }, { once: true });
        });
      }

      function pause(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
      }

      function setPrompt(id) {
        const target = benchmarkMap.get(id);
        if (!target) return;
        promptPreview.textContent = target.prompt;
      }

      function setActiveCard(id) {
        for (const card of cards) {
          card.classList.toggle('active', card.dataset.id === id);
        }
      }

      function loadBenchmark(id) {
        const target = benchmarkMap.get(id);
        if (!target) return;
        setActiveCard(id);
        setPrompt(id);
        runnerState.textContent = 'Viewing: ' + target.title;
        frame.src = target.path;
      }

      async function runSingleBenchmark(id) {
        if (suiteRunning) return;
        const target = benchmarkMap.get(id);
        if (!target) return;
        banner.classList.add('active');
        runnerState.textContent = 'Benchmarking: ' + target.title;
        frame.src = target.path;
        setActiveCard(id);
        setPrompt(id);
        await waitForFrameLoad();
        runnerState.textContent = 'Viewing: ' + target.title;
        banner.classList.remove('active');
      }

      async function runSuite() {
        if (suiteRunning) return;
        suiteRunning = true;
        runSuiteButton.disabled = true;
        banner.classList.add('active');

        try {
          for (let index = 0; index < benchmarkOrder.length; index += 1) {
            const id = benchmarkOrder[index];
            const target = benchmarkMap.get(id);
            if (!target) continue;
            runnerState.textContent = 'Benchmarking ' + (index + 1) + '/' + benchmarkOrder.length + ': ' + target.title;
            frame.src = target.path;
            setActiveCard(id);
            setPrompt(id);
            await waitForFrameLoad();
            await pause(1400);
          }
          runnerState.textContent = 'Suite complete';
        } finally {
          banner.classList.remove('active');
          runSuiteButton.disabled = false;
          suiteRunning = false;
        }
      }

      for (const card of cards) {
        const id = card.dataset.id;
        if (!id) continue;

        card.addEventListener('mouseenter', () => setPrompt(id));
        card.addEventListener('focus', () => setPrompt(id));
        card.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target && target.closest('.run-one, .open-link')) return;
          loadBenchmark(id);
        });
        card.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          loadBenchmark(id);
        });
      }

      for (const button of runButtons) {
        const id = button.dataset.runOne;
        if (!id) continue;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          void runSingleBenchmark(id);
        });
      }

      runSuiteButton.addEventListener('click', () => {
        void runSuite();
      });
    })();
  </script>
</body>
</html>`;
}

export function renderLandingPage(input: BenchmarkPagesInput): string {
  const generatedAt = input.generatedAt.toLocaleString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta Landing Benchmark</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700&family=Chivo+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #03020a;
      --ink: #f9f7ff;
      --muted: #b7acd6;
      --edge: rgba(162, 140, 255, 0.46);
      --accent: #8f6bff;
      --accent-hot: #ff6bd6;
      --accent-cold: #2dd6ff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: 'Unbounded', sans-serif;
      background:
        radial-gradient(circle at 82% 14%, rgba(45, 214, 255, 0.19), transparent 34%),
        radial-gradient(circle at 20% 22%, rgba(255, 107, 214, 0.12), transparent 38%),
        radial-gradient(circle at 30% 90%, rgba(143, 107, 255, 0.26), transparent 44%),
        linear-gradient(155deg, #05020c, #0b0721 38%, #11062e);
      overflow-x: hidden;
    }

    .wrap {
      width: min(1140px, 100%);
      margin: 0 auto;
      padding: 28px 18px 78px;
      display: grid;
      gap: 22px;
    }

    nav {
      border: 1px solid var(--edge);
      border-radius: 999px;
      padding: 10px 18px;
      background: rgba(13, 8, 31, 0.82);
      backdrop-filter: blur(6px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Chivo Mono', monospace;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      position: sticky;
      top: 10px;
      z-index: 20;
    }

    nav a {
      color: #dfd3ff;
      text-decoration: none;
      padding: 6px 10px;
      border-radius: 999px;
      transition: background 150ms ease;
    }

    nav a:hover { background: rgba(143, 107, 255, 0.22); }

    .hero {
      border: 1px solid var(--edge);
      border-radius: 30px;
      padding: clamp(22px, 5vw, 58px);
      background:
        linear-gradient(145deg, rgba(17, 10, 39, 0.9), rgba(8, 6, 20, 0.92)),
        radial-gradient(circle at 15% 18%, rgba(255, 107, 214, 0.17), transparent 40%);
      position: relative;
      overflow: hidden;
    }

    .hero::after {
      content: '';
      position: absolute;
      inset: 18% -18% auto;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(143, 107, 255, 0.8), rgba(45, 214, 255, 0.8), transparent);
      transform: rotate(-9deg);
      opacity: 0.9;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(34px, 8vw, 90px);
      line-height: 0.92;
      letter-spacing: -0.04em;
      max-width: 11ch;
    }

    .hero p {
      margin: 24px 0 0;
      max-width: 63ch;
      color: var(--muted);
      line-height: 1.7;
      font-family: 'Chivo Mono', monospace;
      font-size: 14px;
    }

    .stats {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(152px, 1fr));
      gap: 11px;
    }

    .stat {
      border: 1px solid rgba(126, 104, 255, 0.48);
      background: rgba(21, 14, 49, 0.75);
      border-radius: 14px;
      padding: 12px 14px;
    }

    .stat strong {
      display: block;
      font-size: 20px;
      margin-bottom: 4px;
    }

    .stat span {
      color: #9f90c4;
      font-family: 'Chivo Mono', monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }

    .feature {
      border: 1px solid rgba(140, 114, 255, 0.42);
      border-radius: 20px;
      background: rgba(14, 10, 31, 0.82);
      padding: 20px;
      display: grid;
      gap: 10px;
      transform: translateY(14px);
      opacity: 0;
      animation: rise 620ms forwards;
    }

    .feature:nth-child(2) { animation-delay: 80ms; }
    .feature:nth-child(3) { animation-delay: 160ms; }
    .feature:nth-child(4) { animation-delay: 240ms; }

    .feature h2 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }

    .feature p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
      font-family: 'Chivo Mono', monospace;
    }

    .cta {
      border: 1px solid rgba(173, 151, 255, 0.55);
      border-radius: 24px;
      padding: 24px;
      background: linear-gradient(130deg, rgba(23, 14, 55, 0.9), rgba(17, 8, 36, 0.94));
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
    }

    .cta p {
      margin: 0;
      color: #c8b8ef;
      font-family: 'Chivo Mono', monospace;
      font-size: 14px;
      max-width: 55ch;
      line-height: 1.6;
    }

    .cta a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: #090512;
      background: linear-gradient(120deg, var(--accent-cold), var(--accent-hot));
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 13px;
      font-family: 'Chivo Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }

    .meta {
      color: #8b7ab2;
      font-family: 'Chivo Mono', monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @keyframes rise {
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @media (max-width: 620px) {
      nav { border-radius: 18px; }
      .hero { border-radius: 22px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <span>Opta • Benchmark Landing</span>
      <div>
        <a href="../index.html">Suite</a>
        <a href="../chess/index.html">Chess</a>
        <a href="../ai-news/index.html">AI News</a>
      </div>
    </nav>

    <section class="hero">
      <h1>Build faster with local-first agentic execution.</h1>
      <p>Opta CLI turns advanced model capability into practical engineering momentum. This landing benchmark demonstrates intentional visual direction, storytelling clarity, and conversion-ready interaction design while preserving technical depth.</p>

      <div class="stats">
        <div class="stat"><strong>3</strong><span>Showcase Apps</span></div>
        <div class="stat"><strong>500+</strong><span>Research Words</span></div>
        <div class="stat"><strong>Realtime</strong><span>Interaction Layer</span></div>
        <div class="stat"><strong>${escapeHtml(generatedAt)}</strong><span>Generated</span></div>
      </div>
    </section>

    <section class="grid" aria-label="Feature blocks">
      <article class="feature">
        <h2>Intent-Led Interfaces</h2>
        <p>Every benchmark surface is designed to make capability legible: users can see what Opta does, how it behaves, and where quality matters under real usage pressure.</p>
      </article>
      <article class="feature">
        <h2>Premium Interaction Standard</h2>
        <p>From micro-layout decisions to motion and typography, this landing page intentionally avoids generic patterns to reflect a product-grade UX bar.</p>
      </article>
      <article class="feature">
        <h2>Research as a First-Class Output</h2>
        <p>The suite connects design polish with evidence synthesis by generating a citation-aware AI news report, proving that style and substance can ship together.</p>
      </article>
      <article class="feature">
        <h2>Repeatable Demonstration Flow</h2>
        <p>Run once for local demos or run continuously as a benchmark artifact that tracks quality improvements across tooling, model, and workflow upgrades.</p>
      </article>
    </section>

    <section class="cta">
      <p>Next step: open the chess app to evaluate interaction quality under dense UI state changes, then inspect the AI news page for long-form synthesis quality and source handling.</p>
      <a href="../chess/index.html">Open Chess Arena</a>
    </section>

    <p class="meta">Benchmark Landing • Generated via opta benchmark</p>
  </div>
</body>
</html>`;
}

export function renderChessPage(input: BenchmarkPagesInput): string {
  const generatedAt = input.generatedAt.toLocaleString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta Chess Benchmark</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #090712;
      --ink: #f6f0ff;
      --muted: #bdb0d7;
      --edge: rgba(165, 139, 255, 0.4);
      --panel: rgba(20, 13, 42, 0.84);
      --panel-soft: rgba(17, 11, 34, 0.72);
      --accent: #9570ff;
      --danger: #ff6588;
      --good: #34d399;
      --board-light: #efe4d2;
      --board-dark: #8f6b58;
      --board-select: rgba(125, 255, 209, 0.52);
      --board-move: rgba(149, 112, 255, 0.4);
      --board-check: rgba(255, 101, 136, 0.55);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Outfit', sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 8% 4%, rgba(149, 112, 255, 0.23), transparent 40%),
        radial-gradient(circle at 86% 8%, rgba(89, 210, 255, 0.12), transparent 45%),
        linear-gradient(160deg, #090612, #120a26 40%, #0b0718);
      padding: 20px;
    }

    .layout {
      width: min(1240px, 100%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 330px;
      gap: 16px;
    }

    .main {
      border: 1px solid var(--edge);
      border-radius: 24px;
      background: linear-gradient(140deg, var(--panel), var(--panel-soft));
      padding: 18px;
      display: grid;
      gap: 14px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .topbar h1 {
      margin: 0;
      font-size: clamp(22px, 4vw, 34px);
      letter-spacing: -0.02em;
    }

    .topbar small {
      color: var(--muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      gap: 14px;
      align-items: start;
    }

    .board-shell {
      border: 1px solid rgba(197, 182, 255, 0.42);
      border-radius: 20px;
      padding: 14px;
      background: rgba(11, 8, 24, 0.7);
      box-shadow: inset 0 0 0 1px rgba(128, 97, 240, 0.18);
    }

    .board {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 1;
      border: 1px solid rgba(35, 20, 75, 0.75);
    }

    .square {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      user-select: none;
      font-size: clamp(28px, 5.2vw, 56px);
      cursor: pointer;
      transition: filter 120ms ease;
      line-height: 1;
    }

    .square:hover { filter: brightness(1.07); }
    .square.light { background: var(--board-light); color: #3b2b22; }
    .square.dark { background: var(--board-dark); color: #f8f0e8; }

    .square.selected::after,
    .square.target::after,
    .square.check::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .square.selected::after { background: var(--board-select); }
    .square.target::after { background: var(--board-move); }
    .square.check::after { background: var(--board-check); }

    .coord {
      position: absolute;
      font: 500 10px 'JetBrains Mono', monospace;
      opacity: 0.75;
    }

    .coord.file { bottom: 4px; right: 5px; }
    .coord.rank { top: 4px; left: 4px; }

    .panel {
      border: 1px solid rgba(186, 161, 255, 0.42);
      border-radius: 16px;
      padding: 12px;
      background: rgba(18, 11, 36, 0.8);
      display: grid;
      gap: 10px;
    }

    .clock {
      display: grid;
      gap: 4px;
      border: 1px solid rgba(152, 122, 255, 0.36);
      border-radius: 12px;
      padding: 10px;
      background: rgba(14, 10, 30, 0.65);
    }

    .clock strong {
      font-size: 24px;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.03em;
    }

    .clock span {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-family: 'JetBrains Mono', monospace;
    }

    .controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    button, select {
      width: 100%;
      border: 1px solid rgba(173, 149, 255, 0.56);
      background: rgba(35, 20, 74, 0.72);
      color: var(--ink);
      border-radius: 11px;
      padding: 10px 11px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      letter-spacing: 0.03em;
      cursor: pointer;
    }

    button:hover, select:hover { border-color: rgba(196, 179, 255, 0.8); }

    .status {
      border: 1px solid rgba(139, 227, 193, 0.45);
      background: rgba(11, 61, 42, 0.3);
      color: #d8fff1;
      border-radius: 12px;
      padding: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      min-height: 44px;
      line-height: 1.5;
    }

    .right {
      border: 1px solid var(--edge);
      border-radius: 24px;
      background: linear-gradient(140deg, var(--panel), var(--panel-soft));
      padding: 16px;
      display: grid;
      gap: 12px;
      align-content: start;
      min-height: 0;
    }

    .list {
      border: 1px solid rgba(170, 146, 255, 0.42);
      border-radius: 14px;
      background: rgba(14, 10, 29, 0.72);
      padding: 10px;
      min-height: 180px;
      max-height: 42vh;
      overflow: auto;
      font: 500 12px 'JetBrains Mono', monospace;
      color: #d6cbef;
      white-space: pre-wrap;
      line-height: 1.45;
    }

    .captured {
      display: grid;
      gap: 7px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--muted);
    }

    .captured-row {
      border: 1px solid rgba(176, 156, 255, 0.35);
      border-radius: 11px;
      padding: 8px;
      min-height: 40px;
      background: rgba(16, 10, 33, 0.72);
      font-size: 22px;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #f5ecff;
    }

    .footer {
      color: #9b8bbf;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    @media (max-width: 1080px) {
      .layout { grid-template-columns: 1fr; }
      .stage { grid-template-columns: 1fr; }
      .right { min-height: unset; }
      .list { max-height: 280px; }
    }
  </style>
</head>
<body>
  <main class="layout">
    <section class="main">
      <header class="topbar">
        <div>
          <h1>Opta Premium Chess Arena</h1>
          <small>Chess benchmark • generated ${escapeHtml(generatedAt)}</small>
        </div>
        <small><a href="../index.html" style="color:#d4c8ff;text-decoration:none;">Back to suite</a></small>
      </header>

      <div class="stage">
        <div class="board-shell">
          <div id="board" class="board" aria-label="Chess board"></div>
        </div>

        <aside class="panel">
          <div class="clock">
            <span>Black</span>
            <strong id="black-clock">10:00</strong>
          </div>
          <div class="clock">
            <span>White</span>
            <strong id="white-clock">10:00</strong>
          </div>

          <label style="font:500 11px 'JetBrains Mono', monospace; color: var(--muted); text-transform: uppercase; letter-spacing:0.06em;">AI Style
            <select id="ai-style">
              <option value="greedy">Club (greedy)</option>
              <option value="random">Story (random)</option>
              <option value="thinky">Pro (lookahead)</option>
            </select>
          </label>

          <div class="controls">
            <button id="new-game">New Game</button>
            <button id="undo">Undo</button>
            <button id="flip">Flip Board</button>
            <button id="toggle-ai">AI: On</button>
          </div>

          <div id="status" class="status">Loading board...</div>
        </aside>
      </div>
    </section>

    <aside class="right">
      <h2 style="margin:0;font-size:22px;">Game Log</h2>
      <div id="moves" class="list"></div>

      <div class="captured">
        <span>Captured by White</span>
        <div id="captured-by-white" class="captured-row"></div>
        <span>Captured by Black</span>
        <div id="captured-by-black" class="captured-row"></div>
      </div>

      <p class="footer">Board powered by chess.js • UX benchmark surface</p>
    </aside>
  </main>

  <script type="module">
    import { Chess } from 'https://esm.sh/chess.js@1.0.0';

    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('status');
    const movesEl = document.getElementById('moves');
    const whiteClockEl = document.getElementById('white-clock');
    const blackClockEl = document.getElementById('black-clock');
    const capturedWhiteEl = document.getElementById('captured-by-white');
    const capturedBlackEl = document.getElementById('captured-by-black');

    const pieceGlyph = {
      wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
      bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚'
    };

    const fileList = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const pieceValue = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

    let chess = new Chess();
    let selectedSquare = null;
    let legalTargets = [];
    let flipped = false;
    let aiEnabled = true;
    let aiStyle = 'greedy';
    let timers = { w: 600, b: 600 };
    let activeTimer = 'w';
    let timerHandle = null;
    let timeExpired = false;

    const controls = {
      newGame: document.getElementById('new-game'),
      undo: document.getElementById('undo'),
      flip: document.getElementById('flip'),
      toggleAi: document.getElementById('toggle-ai'),
      aiStyle: document.getElementById('ai-style')
    };

    function boardSquares() {
      const squares = [];
      const rankOrder = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
      const fileOrder = flipped ? [...fileList].reverse() : fileList;
      for (const rank of rankOrder) {
        for (const file of fileOrder) {
          squares.push(file + rank);
        }
      }
      return squares;
    }

    function squareColor(square) {
      const fileCode = square.charCodeAt(0) - 96;
      const rank = Number(square[1]);
      return (fileCode + rank) % 2 === 0 ? 'dark' : 'light';
    }

    function formatTime(value) {
      const safe = Math.max(0, value);
      const mins = String(Math.floor(safe / 60)).padStart(2, '0');
      const secs = String(safe % 60).padStart(2, '0');
      return mins + ':' + secs;
    }

    function renderClocks() {
      whiteClockEl.textContent = formatTime(timers.w);
      blackClockEl.textContent = formatTime(timers.b);
      whiteClockEl.style.color = activeTimer === 'w' ? '#f6f0ff' : '#a697c8';
      blackClockEl.style.color = activeTimer === 'b' ? '#f6f0ff' : '#a697c8';
    }

    function collectCapturedPieces() {
      const start = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
      const current = {
        w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
        b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
      };
      const board = chess.board();
      for (const row of board) {
        for (const piece of row) {
          if (!piece) continue;
          current[piece.color][piece.type] += 1;
        }
      }

      const capturedByWhite = [];
      const capturedByBlack = [];

      for (const type of Object.keys(start)) {
        const lostBlack = start[type] - current.b[type];
        const lostWhite = start[type] - current.w[type];
        for (let i = 0; i < lostBlack; i += 1) capturedByWhite.push(pieceGlyph['b' + type]);
        for (let i = 0; i < lostWhite; i += 1) capturedByBlack.push(pieceGlyph['w' + type]);
      }

      capturedWhiteEl.textContent = capturedByWhite.join(' ');
      capturedBlackEl.textContent = capturedByBlack.join(' ');
    }

    function renderMoves() {
      const history = chess.history();
      if (history.length === 0) {
        movesEl.textContent = 'No moves yet.';
        return;
      }

      const lines = [];
      for (let i = 0; i < history.length; i += 2) {
        const moveNo = Math.floor(i / 2) + 1;
        const white = history[i] || '';
        const black = history[i + 1] || '';
        lines.push(String(moveNo).padStart(2, ' ') + '. ' + white.padEnd(8, ' ') + black);
      }

      movesEl.textContent = lines.join('\\n');
      movesEl.scrollTop = movesEl.scrollHeight;
    }

    function setStatus(message, tone) {
      statusEl.textContent = message;
      if (tone === 'danger') {
        statusEl.style.borderColor = 'rgba(255,101,136,0.55)';
        statusEl.style.background = 'rgba(77, 23, 42, 0.45)';
        statusEl.style.color = '#ffdbe5';
      } else if (tone === 'ok') {
        statusEl.style.borderColor = 'rgba(139,227,193,0.45)';
        statusEl.style.background = 'rgba(11,61,42,0.3)';
        statusEl.style.color = '#d8fff1';
      } else {
        statusEl.style.borderColor = 'rgba(172,152,255,0.52)';
        statusEl.style.background = 'rgba(31, 19, 64, 0.36)';
        statusEl.style.color = '#ede6ff';
      }
    }

    function currentTurnLabel() {
      return chess.turn() === 'w' ? 'White to move' : 'Black to move';
    }

    function isPromotionMove(from, to) {
      const piece = chess.get(from);
      if (!piece || piece.type !== 'p') return false;
      return to[1] === '8' || to[1] === '1';
    }

    function updateStatusFromGame() {
      if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
          const winner = chess.turn() === 'w' ? 'Black' : 'White';
          setStatus('Checkmate. ' + winner + ' wins.', 'danger');
        } else if (chess.isDraw()) {
          setStatus('Draw detected (' + chess.pgn({ maxWidth: 50 }).split('\\n').pop() + ').', 'neutral');
        } else {
          setStatus('Game over.', 'neutral');
        }
        return;
      }

      if (chess.isCheck()) {
        const side = chess.turn() === 'w' ? 'White' : 'Black';
        setStatus(side + ' is in check. ' + currentTurnLabel() + '.', 'danger');
      } else {
        setStatus(currentTurnLabel(), 'ok');
      }
    }

    function squareHasFriendlyPiece(square) {
      const piece = chess.get(square);
      return Boolean(piece && piece.color === chess.turn());
    }

    function renderBoard() {
      boardEl.innerHTML = '';
      const squares = boardSquares();
      const checkSquare = (() => {
        if (!chess.isCheck()) return null;
        const kingColor = chess.turn();
        const board = chess.board();
        for (let r = 0; r < board.length; r += 1) {
          for (let c = 0; c < board[r].length; c += 1) {
            const piece = board[r][c];
            if (piece && piece.type === 'k' && piece.color === kingColor) {
              return fileList[c] + (8 - r);
            }
          }
        }
        return null;
      })();

      for (const square of squares) {
        const piece = chess.get(square);
        const tile = document.createElement('button');
        tile.className = 'square ' + squareColor(square);
        tile.type = 'button';
        tile.dataset.square = square;

        if (selectedSquare === square) tile.classList.add('selected');
        if (legalTargets.includes(square)) tile.classList.add('target');
        if (checkSquare === square) tile.classList.add('check');

        if (piece) {
          tile.textContent = pieceGlyph[piece.color + piece.type] || '';
        }

        if (square[1] === (flipped ? '8' : '1')) {
          const fileTag = document.createElement('span');
          fileTag.className = 'coord file';
          fileTag.textContent = square[0];
          tile.appendChild(fileTag);
        }

        if (square[0] === (flipped ? 'h' : 'a')) {
          const rankTag = document.createElement('span');
          rankTag.className = 'coord rank';
          rankTag.textContent = square[1];
          tile.appendChild(rankTag);
        }

        tile.addEventListener('click', () => onSquareClick(square));
        boardEl.appendChild(tile);
      }

      renderMoves();
      collectCapturedPieces();
      renderClocks();
      updateStatusFromGame();
    }

    function resetSelection() {
      selectedSquare = null;
      legalTargets = [];
    }

    function onSquareClick(square) {
      if (chess.isGameOver()) return;
      if (timeExpired) return;
      if (aiEnabled && chess.turn() === 'b') return;

      if (!selectedSquare) {
        if (!squareHasFriendlyPiece(square)) return;
        selectedSquare = square;
        legalTargets = chess.moves({ square, verbose: true }).map((move) => move.to);
        renderBoard();
        return;
      }

      if (selectedSquare === square) {
        resetSelection();
        renderBoard();
        return;
      }

      if (squareHasFriendlyPiece(square)) {
        selectedSquare = square;
        legalTargets = chess.moves({ square, verbose: true }).map((move) => move.to);
        renderBoard();
        return;
      }

      const move = chess.move({
        from: selectedSquare,
        to: square,
        promotion: isPromotionMove(selectedSquare, square) ? 'q' : undefined
      });

      if (!move) {
        setStatus('Illegal move. Try another square.', 'danger');
        return;
      }

      activeTimer = chess.turn();
      resetSelection();
      renderBoard();

      if (aiEnabled && !chess.isGameOver() && chess.turn() === 'b') {
        window.setTimeout(playAiMove, 260);
      }
    }

    function evaluateBoardPosition(tempChess) {
      const board = tempChess.board();
      let score = 0;
      for (const row of board) {
        for (const piece of row) {
          if (!piece) continue;
          const value = pieceValue[piece.type] || 0;
          score += piece.color === 'w' ? value : -value;
        }
      }
      return score;
    }

    function evaluateMove(move, style) {
      const temp = new Chess(chess.fen());
      temp.move(move);
      let score = evaluateBoardPosition(temp);

      if (style === 'random') {
        return Math.random() * 100;
      }

      if (temp.isCheck()) score += 35;
      if (move.captured) score += pieceValue[move.captured] || 0;
      if (move.promotion) score += 400;

      if (style === 'thinky') {
        const replies = temp.moves({ verbose: true });
        let bestReply = Infinity;
        for (const reply of replies) {
          const deeper = new Chess(temp.fen());
          deeper.move(reply);
          const replyScore = evaluateBoardPosition(deeper);
          if (replyScore < bestReply) bestReply = replyScore;
        }
        if (Number.isFinite(bestReply)) score = score * 0.7 + bestReply * 0.3;
      }

      return -score;
    }

    function playAiMove() {
      if (timeExpired) return;
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return;

      let best = moves[0];
      let bestScore = -Infinity;

      for (const move of moves) {
        const score = evaluateMove(move, aiStyle);
        if (score > bestScore) {
          bestScore = score;
          best = move;
        }
      }

      chess.move(best);
      activeTimer = chess.turn();
      renderBoard();
    }

    function startClock() {
      if (timerHandle) window.clearInterval(timerHandle);
      timerHandle = window.setInterval(() => {
        if (chess.isGameOver()) return;
        timers[activeTimer] -= 1;
        if (timers[activeTimer] <= 0) {
          timers[activeTimer] = 0;
          timeExpired = true;
          setStatus((activeTimer === 'w' ? 'White' : 'Black') + ' flagged on time.', 'danger');
          if (timerHandle) window.clearInterval(timerHandle);
        }
        renderClocks();
      }, 1000);
    }

    function resetGame() {
      chess = new Chess();
      timers = { w: 600, b: 600 };
      activeTimer = 'w';
      timeExpired = false;
      resetSelection();
      renderBoard();
      startClock();
    }

    controls.newGame.addEventListener('click', resetGame);

    controls.undo.addEventListener('click', () => {
      if (chess.history().length === 0) return;
      chess.undo();
      if (aiEnabled && chess.turn() === 'w' && chess.history().length > 0) {
        chess.undo();
      }
      resetSelection();
      activeTimer = chess.turn();
      renderBoard();
    });

    controls.flip.addEventListener('click', () => {
      flipped = !flipped;
      renderBoard();
    });

    controls.toggleAi.addEventListener('click', () => {
      aiEnabled = !aiEnabled;
      controls.toggleAi.textContent = 'AI: ' + (aiEnabled ? 'On' : 'Off');
      setStatus(aiEnabled ? 'AI opponent enabled.' : 'AI opponent disabled.', 'neutral');
      if (aiEnabled && !chess.isGameOver() && chess.turn() === 'b') {
        window.setTimeout(playAiMove, 220);
      }
    });

    controls.aiStyle.addEventListener('change', () => {
      aiStyle = controls.aiStyle.value;
      setStatus('AI style switched to ' + aiStyle + '.', 'neutral');
    });

    renderBoard();
    startClock();
  </script>
</body>
</html>`;
}

export function renderAiNewsPage(input: BenchmarkPagesInput): string {
  const generatedAt = new Date(input.newsReport.generatedAtIso).toLocaleString();
  const paragraphs = paragraphize(input.newsReport.summary)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n');

  const citations = input.newsReport.citations.length > 0
    ? input.newsReport.citations
      .map((citation) => {
        const title = escapeHtml(citation.title);
        const snippet = escapeHtml(citation.snippet);
        const source = escapeHtml(formatSourceLabel(citation.source));
        const published = citation.publishedAt ? `<span>${escapeHtml(citation.publishedAt)}</span>` : '';
        const url = escapeHtml(citation.url);

        return `<article class="citation">
          <h3><a href="${url}" target="_blank" rel="noreferrer">${title}</a></h3>
          <p>${snippet}</p>
          <div class="meta"><span>${source}</span>${published}</div>
        </article>`;
      })
      .join('\n')
    : '<p class="empty">No citations were returned for this run. Re-run with enabled research providers for sourced output.</p>';

  const providerLine = input.newsReport.provider === 'fallback'
    ? `Fallback mode: ${escapeHtml(input.newsReport.providerFailure ?? 'provider request failed')}`
    : `Provider: ${escapeHtml(input.newsReport.provider)}`;

  const attemptedProviders = input.newsReport.attemptedProviders.length > 0
    ? input.newsReport.attemptedProviders.join(', ')
    : 'none';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opta AI News Benchmark</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f7f5ff;
      --ink: #161127;
      --muted: #60567a;
      --edge: #d9d1f3;
      --panel: #ffffff;
      --accent: #6e4dff;
      --accent-soft: #ede8ff;
      --warning: #b24a6f;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at 14% 16%, rgba(110, 77, 255, 0.08), transparent 32%),
        radial-gradient(circle at 84% 4%, rgba(51, 181, 255, 0.08), transparent 34%),
        var(--bg);
      color: var(--ink);
      font-family: 'IBM Plex Sans', sans-serif;
      padding: 24px 16px 60px;
    }

    .layout {
      width: min(1120px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(0, 1fr) 320px;
    }

    .article {
      background: var(--panel);
      border: 1px solid var(--edge);
      border-radius: 20px;
      padding: clamp(20px, 4vw, 34px);
      box-shadow: 0 12px 34px rgba(45, 30, 98, 0.08);
    }

    .eyebrow {
      display: inline-flex;
      border-radius: 999px;
      padding: 6px 12px;
      background: var(--accent-soft);
      border: 1px solid #d4c8ff;
      color: #4b379f;
      font: 500 12px 'IBM Plex Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }

    h1 {
      margin: 0;
      font-family: 'Fraunces', serif;
      font-size: clamp(31px, 6vw, 52px);
      line-height: 1.04;
      letter-spacing: -0.02em;
      max-width: 16ch;
    }

    .lede {
      margin: 16px 0 0;
      color: var(--muted);
      line-height: 1.7;
      font-size: 16px;
      max-width: 74ch;
    }

    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin: 20px 0 8px;
    }

    .meta div {
      border: 1px solid #e4ddf8;
      border-radius: 12px;
      padding: 10px;
      background: #fbfaff;
      font: 500 12px 'IBM Plex Mono', monospace;
      color: #5e5574;
      line-height: 1.5;
    }

    .content {
      margin-top: 14px;
      display: grid;
      gap: 16px;
    }

    .content p {
      margin: 0;
      font-size: 17px;
      line-height: 1.72;
      color: #261d3d;
    }

    .sources {
      border: 1px solid var(--edge);
      border-radius: 20px;
      background: #ffffff;
      padding: 18px;
      height: fit-content;
      display: grid;
      gap: 12px;
      box-shadow: 0 10px 28px rgba(35, 24, 77, 0.07);
    }

    .sources h2 {
      margin: 0;
      font-family: 'Fraunces', serif;
      font-size: 30px;
      line-height: 1.1;
    }

    .citation {
      border: 1px solid #e8e2f9;
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 8px;
      background: #fcfbff;
    }

    .citation h3 {
      margin: 0;
      font-size: 16px;
      line-height: 1.3;
      font-weight: 600;
    }

    .citation a {
      color: #3c2da0;
      text-decoration: none;
    }

    .citation a:hover { text-decoration: underline; }

    .citation p {
      margin: 0;
      color: #564d70;
      font-size: 14px;
      line-height: 1.55;
    }

    .citation .meta {
      display: flex;
      gap: 8px;
      margin: 0;
      font: 500 11px 'IBM Plex Mono', monospace;
      color: #6a5f88;
    }

    .empty {
      margin: 0;
      border: 1px dashed #d5c8f7;
      border-radius: 12px;
      padding: 12px;
      color: var(--warning);
      background: #fff6fb;
      font-size: 14px;
      line-height: 1.6;
    }

    .toolbar {
      width: min(1120px, 100%);
      margin: 0 auto 12px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font: 500 12px 'IBM Plex Mono', monospace;
      color: #5d5177;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .toolbar a {
      color: #3f2ca8;
      text-decoration: none;
      border: 1px solid #d6c9f7;
      background: #f7f3ff;
      border-radius: 999px;
      padding: 6px 11px;
    }

    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span>Opta AI News Benchmark</span>
    <span><a href="../index.html">Back to Suite</a></span>
  </div>

  <main class="layout">
    <article class="article">
      <span class="eyebrow">Research App • 500+ Words</span>
      <h1>Most Recent AI News: strategic summary for builders</h1>
      <p class="lede">This report is generated via Opta's research routing stack and transformed into an educational briefing designed for engineering, product, and strategy teams.</p>

      <section class="meta" aria-label="Research metadata">
        <div><strong>Generated</strong><br />${escapeHtml(generatedAt)}</div>
        <div><strong>Word Count</strong><br />${input.newsReport.wordCount}</div>
        <div><strong>Mode</strong><br />${escapeHtml(providerLine)}</div>
        <div><strong>Attempted</strong><br />${escapeHtml(attemptedProviders)}</div>
      </section>

      <section class="content">
        ${paragraphs}
      </section>
    </article>

    <aside class="sources">
      <h2>Sources</h2>
      ${citations}
    </aside>
  </main>
</body>
</html>`;
}
