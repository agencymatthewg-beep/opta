import os
import re
import subprocess

template_path = 'design/logos/opta-logo-template.html'
with open(template_path, 'r', encoding='utf-8') as f:
    template = f.read()

# Update text to 'help'
template = re.sub(r'<span class="learn-text">learn</span>', '<span class="learn-text">help</span>', template)

base_svg = """<svg width="210" height="210" viewBox="0 0 210 210" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <filter id="violetBloom" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <filter id="violetGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <radialGradient id="voidFill" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#100e18"/>
        <stop offset="60%"  stop-color="#0c0a14"/>
        <stop offset="100%" stop-color="#09090b"/>
      </radialGradient>
      <linearGradient id="ringHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#c084fc" stop-opacity="0.9"/>
        <stop offset="25%"  stop-color="#a855f7" stop-opacity="0.7"/>
        <stop offset="55%"  stop-color="#7c3aed" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.15"/>
      </linearGradient>
      <radialGradient id="centreBloom" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stop-color="#d8b4fe" stop-opacity="0.8"/>
        <stop offset="40%"  stop-color="#a855f7" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="outerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="70%"  stop-color="#a855f7" stop-opacity="0"/>
        <stop offset="85%"  stop-color="#a855f7" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <circle cx="105" cy="105" r="100" fill="url(#outerGlow)"/>
    <circle cx="105" cy="105" r="88" fill="url(#voidFill)"/>
    <circle cx="105" cy="105" r="96" stroke="#a855f7" stroke-width="6" stroke-opacity="0.06" fill="none"/>
    <circle cx="105" cy="105" r="93" stroke="#a855f7" stroke-width="3" stroke-opacity="0.10" fill="none"/>
    <circle cx="105" cy="105" r="90" stroke="url(#ringHighlight)" stroke-width="1.6" fill="none" filter="url(#ringGlow)"/>
    <circle cx="105" cy="105" r="87" stroke="#a855f7" stroke-width="0.6" stroke-opacity="0.12" fill="none"/>

    {INNER_MARK}

    <circle cx="105" cy="105" r="32" fill="url(#centreBloom)" fill-opacity="0.15"/>
</svg>"""

v1 = """<g transform="translate(105, 105)">
      <!-- Concept 1: The Guiding Beacon -->
      <path d="M-30 -20 A 40 40 0 0 1 30 -20" fill="none" stroke="#a855f7" stroke-width="2" stroke-opacity="0.6" filter="url(#ringGlow)" stroke-linecap="round"/>
      <path d="M-45 -35 A 60 60 0 0 1 45 -35" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4 6" filter="url(#ringGlow)" stroke-linecap="round"/>
      <polygon points="-8,0 8,0 3,-50 -3,-50" fill="#c084fc" opacity="0.15" filter="url(#violetBloom)"/>
      <line x1="0" y1="0" x2="0" y2="-50" stroke="#f5d0fe" stroke-width="1.5" filter="url(#violetGlow)"/>
      <path d="M-15 0 L15 0 L10 10 L-10 10 Z" fill="none" stroke="#a855f7" stroke-width="2" filter="url(#violetGlow)" stroke-linejoin="round"/>
      <circle cx="0" cy="0" r="4" fill="#ffffff" filter="url(#violetBloom)"/>
    </g>"""

v2 = """<g transform="translate(105, 105)">
      <!-- Concept 2: The Support Shield -->
      <path d="M-40 0 A 40 40 0 0 1 0 -40" fill="none" stroke="#a855f7" stroke-width="3" filter="url(#violetGlow)" stroke-linecap="round" opacity="0.8"/>
      <path d="M40 0 A 40 40 0 0 1 0 40" fill="none" stroke="#a855f7" stroke-width="3" filter="url(#violetGlow)" stroke-linecap="round" opacity="0.8"/>
      <line x1="-20" y1="-20" x2="20" y2="20" stroke="#a855f7" stroke-width="1.5" stroke-opacity="0.5" stroke-dasharray="3 3"/>
      <line x1="-20" y1="20" x2="20" y2="-20" stroke="#a855f7" stroke-width="1.5" stroke-opacity="0.5" stroke-dasharray="3 3"/>
      <circle cx="-28" cy="-28" r="3" fill="#c084fc" filter="url(#violetBloom)"/>
      <circle cx="28" cy="28" r="3" fill="#c084fc" filter="url(#violetBloom)"/>
      <circle cx="0" cy="0" r="8" fill="none" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)"/>
      <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.9"/>
    </g>"""

v3 = """<g transform="translate(105, 105)">
      <!-- Concept 3: The Knowledge Node (Abstract Question Mark) -->
      <path d="M-15 10 C-30 10 -35 -15 -15 -25 C5 -35 25 -20 15 0 C10 10 0 15 0 25" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" filter="url(#violetGlow)"/>
      <circle cx="-15" cy="-25" r="2.5" fill="#c084fc" filter="url(#violetBloom)"/>
      <circle cx="15" cy="0" r="2.5" fill="#c084fc" filter="url(#violetBloom)"/>
      <circle cx="0" cy="40" r="4" fill="#ffffff" filter="url(#violetBloom)" opacity="0.9"/>
      <circle cx="0" cy="40" r="10" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.5" filter="url(#ringGlow)"/>
    </g>"""

os.makedirs('design/logos/Opta-Help', exist_ok=True)

for i, mark in enumerate([v1, v2, v3], 1):
    svg_content = base_svg.replace('{INNER_MARK}', mark)
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
    out_path = f'design/logos/Opta-Help/opta-help-v{i}.html'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    subprocess.run(['open', out_path])
    print(f"Opened {out_path}")
