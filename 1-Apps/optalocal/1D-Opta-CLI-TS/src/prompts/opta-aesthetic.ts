export const OPTA_AESTHETIC_PROMPT = `
You must strictly follow the "Opta Local" design aesthetic for all GenUI HTML artifacts.
Do NOT use TailwindCSS or external component libraries. Use pure vanilla HTML/CSS.

<aesthetic_rules>
1. Typography:
   - Primary UI font: 'Sora', sans-serif. Use weights 300, 400, 500, 600, 700.
   - Code/Stats font: 'JetBrains Mono', monospace.
   - Import Sora: <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

2. Color Palette (Dark Mode Only):
   - Backgrounds: Use OLED void black --void: #09090b; as the main body background. Never use #000.
   - Surfaces: --surface: #18181b;, --elevated: #27272a;
   - Borders: --border: #3f3f46;
   - Primary Accent: Electric Violet --primary: #8b5cf6;, Glow: --primary-glow: #a855f7;
   - Text: --text-primary: #fafafa;, --text-secondary: #a1a1aa;, --text-muted: #52525b;
   - Status Neon: --neon-blue: #3b82f6;, --neon-green: #22c55e;, --neon-amber: #f59e0b;, --neon-red: #ef4444;, --neon-cyan: #06b6d4;

3. Glassmorphism:
   - Always use these utility classes for containers:
     - .glass: background: rgba(24,24,27,.72); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06);
     - .glass-sub: background: rgba(18,18,20,.55); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.05); border-radius: 12px;
     - .glass-hi: background: rgba(39,39,42,.85); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.5);
     - Add a subtle violet top-border gradient to main .glass panels: .glass::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background: linear-gradient(90deg, transparent, rgba(139,92,246,.5), transparent); }

4. Gradients & FX:
   - Use the "moonlight" gradient for primary headers: .moonlight { background: linear-gradient(135deg, #ffffff 0%, #c4b5fd 40%, #818cf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
   - Use a subtle particle canvas or radial gradient dot grid in the background to provide texture: .bg-dots { background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0); background-size: 32px 32px; }

5. Animations:
   - Use Framer Motion style spring physics or smooth CSS ease-out for hover states and intros. Never use linear.
   - Example fade-up: @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

6. Icons:
   - Prefer Lucide icons via CDN (e.g. https://unpkg.com/lucide@latest). Do not output massive inline SVGs unless absolutely necessary for custom logos.
</aesthetic_rules>

Your response must include a single valid HTML code block containing the complete UI artifact. Do not truncate the HTML.
`;
