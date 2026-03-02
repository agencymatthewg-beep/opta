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

v3a = """<g transform="translate(105, 105)">
      <!-- Concept 3A: The Floating Hologram Book -->
      <!-- Left Page -->
      <path d="M0 10 L-25 -5 L-25 -25 L0 -10 Z" fill="none" stroke="#a855f7" stroke-width="2.5" filter="url(#violetGlow)" stroke-linejoin="round"/>
      <!-- Right Page -->
      <path d="M0 10 L25 -5 L25 -25 L0 -10 Z" fill="none" stroke="#c084fc" stroke-width="2.5" filter="url(#violetGlow)" stroke-linejoin="round"/>
      
      <!-- Central Binding/Spine -->
      <line x1="0" y1="-10" x2="0" y2="10" stroke="#f5d0fe" stroke-width="3" stroke-linecap="round" filter="url(#violetBloom)"/>
      
      <!-- Floating data particles escaping the book -->
      <circle cx="-10" cy="-25" r="2" fill="#ffffff" filter="url(#violetBloom)"/>
      <circle cx="5" cy="-35" r="1.5" fill="#f5d0fe" filter="url(#violetBloom)"/>
      <circle cx="15" cy="-20" r="2" fill="#c084fc" filter="url(#violetBloom)"/>
      
      <!-- Base projection ring -->
      <ellipse cx="0" cy="20" rx="20" ry="6" stroke="#a855f7" stroke-width="1" stroke-opacity="0.5" fill="none" filter="url(#ringGlow)"/>
    </g>"""

v3b = """<g transform="translate(105, 105)">
      <!-- Concept 3B: The Technical Manual (Top-Down Minimalist) -->
      <!-- Outer book cover bracket -->
      <path d="M-30 20 L-30 -20 C-30 -25 -25 -30 -20 -30 L20 -30 C25 -30 30 -25 30 -20 L30 20" fill="none" stroke="#a855f7" stroke-width="3" filter="url(#violetGlow)" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      
      <!-- Inner page lines representing text/data -->
      <line x1="-15" y1="-15" x2="15" y2="-15" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
      <line x1="-15" y1="-5" x2="5" y2="-5" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
      <line x1="-15" y1="5" x2="15" y2="5" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
      
      <!-- Bookmark or specific index marker -->
      <path d="M-5 -30 L5 -30 L5 -10 L0 -15 L-5 -10 Z" fill="#f5d0fe" filter="url(#violetBloom)"/>
    </g>"""

v3c = """<g transform="translate(105, 105)">
      <!-- Concept 3C: The Layered Codex / Open Scroll -->
      <!-- Multiple overlapping curves simulating pages turning -->
      <path d="M-35 5 Q -15 -15, 0 0" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)" opacity="0.5"/>
      <path d="M35 5 Q 15 -15, 0 0" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)" opacity="0.5"/>
      
      <path d="M-30 15 Q -15 -5, 0 10" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" filter="url(#violetGlow)" opacity="0.8"/>
      <path d="M30 15 Q 15 -5, 0 10" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" filter="url(#violetGlow)" opacity="0.8"/>
      
      <path d="M-25 25 Q -10 5, 0 20" fill="none" stroke="#f5d0fe" stroke-width="3" stroke-linecap="round" filter="url(#violetBloom)"/>
      <path d="M25 25 Q 10 5, 0 20" fill="none" stroke="#f5d0fe" stroke-width="3" stroke-linecap="round" filter="url(#violetBloom)"/>
      
      <!-- Central glowing knowledge core (the spine's apex) -->
      <circle cx="0" cy="-10" r="6" fill="#ffffff" filter="url(#violetBloom)" opacity="0.9"/>
      <circle cx="0" cy="-10" r="14" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-opacity="0.4" stroke-dasharray="2 4"/>
    </g>"""

os.makedirs('design/logos/Opta-Help', exist_ok=True)

for i, mark in zip(['book-a', 'book-b', 'book-c'], [v3a, v3b, v3c]):
    svg_content = base_svg.replace('{INNER_MARK}', mark)
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
    out_path = f'design/logos/Opta-Help/opta-help-{i}.html'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    subprocess.run(['open', out_path])
    print(f"Opened {out_path}")
