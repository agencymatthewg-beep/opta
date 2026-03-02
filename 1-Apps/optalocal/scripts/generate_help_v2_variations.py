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

v2a = """<g transform="translate(105, 105)">
      <!-- Concept 2A: The Multi-Layered Shield -->
      <!-- Outer layered support arcs -->
      <path d="M-40 0 A 40 40 0 0 1 0 -40" fill="none" stroke="#a855f7" stroke-width="2.5" filter="url(#violetGlow)" stroke-linecap="round" opacity="0.9"/>
      <path d="M40 0 A 40 40 0 0 1 0 40" fill="none" stroke="#a855f7" stroke-width="2.5" filter="url(#violetGlow)" stroke-linecap="round" opacity="0.9"/>
      <!-- Inner denser arcs for technical depth -->
      <path d="M-25 -10 A 30 30 0 0 1 10 -25" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.6" filter="url(#violetGlow)" stroke-linecap="round"/>
      <path d="M25 10 A 30 30 0 0 1 -10 25" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.6" filter="url(#violetGlow)" stroke-linecap="round"/>
      
      <!-- Central core crossing nodes -->
      <circle cx="-16" cy="-16" r="2.5" fill="#f5d0fe" filter="url(#violetBloom)"/>
      <circle cx="16" cy="16" r="2.5" fill="#f5d0fe" filter="url(#violetBloom)"/>
      <line x1="-16" y1="-16" x2="16" y2="16" stroke="#c084fc" stroke-width="1.5" stroke-opacity="0.7"/>
      
      <!-- Central bright core -->
      <circle cx="0" cy="0" r="10" fill="none" stroke="#c084fc" stroke-width="2" filter="url(#violetBloom)"/>
      <circle cx="0" cy="0" r="4" fill="#ffffff" opacity="0.9"/>
    </g>"""

v2b = """<g transform="translate(105, 105)">
      <!-- Concept 2B: The Interlocking Support Hands -->
      <!-- Thick overlapping support shapes (like hands holding something) -->
      <path d="M-36 10 C -36 -25, -15 -36, 0 -36" fill="none" stroke="#c084fc" stroke-width="4" filter="url(#violetBloom)" stroke-linecap="round" opacity="0.85"/>
      <path d="M36 -10 C 36 25, 15 36, 0 36" fill="none" stroke="#a855f7" stroke-width="4" filter="url(#violetGlow)" stroke-linecap="round" opacity="0.85"/>
      
      <!-- Connecting internal web / net structure -->
      <polygon points="-15,-20 15,20 -15,5 15,-5" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.5" stroke-dasharray="2 2" />
      
      <!-- Protection anchor points -->
      <circle cx="0" cy="-36" r="3.5" fill="#ffffff" filter="url(#violetBloom)"/>
      <circle cx="0" cy="36" r="3.5" fill="#f5d0fe" filter="url(#violetBloom)"/>
      
      <!-- Central suspended node -->
      <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="#ffffff" filter="url(#violetBloom)" opacity="0.9"/>
    </g>"""

v2c = """<g transform="translate(105, 105)">
      <!-- Concept 2C: The Tech Compass / Lifebuoy Shield -->
      <!-- Clean geometric circle broken into quarters -->
      <circle cx="0" cy="0" r="36" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4 8"/>
      
      <!-- Solid protective corner brackets -->
      <path d="M-20 -30 A 36 36 0 0 1 -30 -20" fill="none" stroke="#c084fc" stroke-width="4" filter="url(#violetGlow)" stroke-linecap="round"/>
      <path d="M20 30 A 36 36 0 0 1 30 20" fill="none" stroke="#c084fc" stroke-width="4" filter="url(#violetGlow)" stroke-linecap="round"/>
      <path d="M20 -30 A 36 36 0 0 0 30 -20" fill="none" stroke="#a855f7" stroke-width="2" filter="url(#ringGlow)" stroke-linecap="round"/>
      <path d="M-20 30 A 36 36 0 0 0 -30 20" fill="none" stroke="#a855f7" stroke-width="2" filter="url(#ringGlow)" stroke-linecap="round"/>
      
      <!-- Central Target/Crosshair indicating focus & assistance -->
      <line x1="-12" y1="0" x2="-4" y2="0" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)" stroke-linecap="round"/>
      <line x1="12" y1="0" x2="4" y2="0" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)" stroke-linecap="round"/>
      <line x1="0" y1="-12" x2="0" y2="-4" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)" stroke-linecap="round"/>
      <line x1="0" y1="12" x2="0" y2="4" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)" stroke-linecap="round"/>
      
      <!-- Core -->
      <circle cx="0" cy="0" r="2.5" fill="#ffffff"/>
    </g>"""

os.makedirs('design/logos/Opta-Help', exist_ok=True)

for i, mark in zip(['2a', '2b', '2c'], [v2a, v2b, v2c]):
    svg_content = base_svg.replace('{INNER_MARK}', mark)
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
    out_path = f'design/logos/Opta-Help/opta-help-v{i}.html'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    subprocess.run(['open', out_path])
    print(f"Opened {out_path}")
