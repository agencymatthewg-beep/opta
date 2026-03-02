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
  <!-- Variation A1: Layered Hologram Book -->
  <!-- Base projection ring -->
  <ellipse cx="0" cy="25" rx="24" ry="7" stroke="#a855f7" stroke-width="1.5" stroke-opacity="0.3" fill="none" filter="url(#ringGlow)"/>
  
  <!-- Back Pages -->
  <path d="M0 5 L-30 -10 L-30 -25 L0 -10 Z" fill="none" stroke="#a855f7" stroke-width="1.5" opacity="0.4" stroke-linejoin="round"/>
  <path d="M0 5 L30 -10 L30 -25 L0 -10 Z" fill="none" stroke="#c084fc" stroke-width="1.5" opacity="0.4" stroke-linejoin="round"/>

  <!-- Mid Pages -->
  <path d="M0 10 L-25 -5 L-25 -25 L0 -10 Z" fill="none" stroke="#a855f7" stroke-width="2" filter="url(#violetGlow)" stroke-linejoin="round" opacity="0.7"/>
  <path d="M0 10 L25 -5 L25 -25 L0 -10 Z" fill="none" stroke="#c084fc" stroke-width="2" filter="url(#violetGlow)" stroke-linejoin="round" opacity="0.7"/>

  <!-- Front Pages -->
  <path d="M0 15 L-20 0 L-20 -20 L0 -5 Z" fill="none" stroke="#f5d0fe" stroke-width="2.5" filter="url(#violetBloom)" stroke-linejoin="round"/>
  <path d="M0 15 L20 0 L20 -20 L0 -5 Z" fill="none" stroke="#f5d0fe" stroke-width="2.5" filter="url(#violetBloom)" stroke-linejoin="round"/>
  
  <!-- Spine -->
  <line x1="0" y1="-10" x2="0" y2="15" stroke="#ffffff" stroke-width="3" stroke-linecap="round" filter="url(#violetBloom)"/>
  <circle cx="0" cy="-10" r="3" fill="#ffffff" filter="url(#violetBloom)"/>
</g>"""

v2 = """<g transform="translate(105, 105)">
  <!-- Variation A2: Data-Stream Hologram Book -->
  <!-- Base projection beam -->
  <polygon points="-15,25 15,25 25,-15 -25,-15" fill="#a855f7" opacity="0.1" filter="url(#violetBloom)"/>
  <ellipse cx="0" cy="25" rx="15" ry="4" stroke="#a855f7" stroke-width="2" stroke-opacity="0.6" fill="none" filter="url(#ringGlow)"/>
  
  <!-- Left Page Data Lines -->
  <line x1="0" y1="-5" x2="-25" y2="-20" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
  <line x1="0" y1="0" x2="-25" y2="-15" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)" stroke-dasharray="4 4"/>
  <line x1="0" y1="5" x2="-25" y2="-10" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
  <line x1="0" y1="10" x2="-25" y2="-5" stroke="#a855f7" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>

  <!-- Right Page Data Lines -->
  <line x1="0" y1="-5" x2="25" y2="-20" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
  <line x1="0" y1="0" x2="25" y2="-15" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>
  <line x1="0" y1="5" x2="25" y2="-10" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)" stroke-dasharray="2 6"/>
  <line x1="0" y1="10" x2="25" y2="-5" stroke="#c084fc" stroke-width="2" stroke-linecap="round" filter="url(#violetGlow)"/>

  <!-- Binding / Frame -->
  <path d="M0 10 L-25 -5 M0 10 L25 -5 M0 -5 L-25 -20 M0 -5 L25 -20" fill="none" stroke="#f5d0fe" stroke-width="1.5" opacity="0.4"/>
  <line x1="0" y1="-5" x2="0" y2="10" stroke="#ffffff" stroke-width="4" stroke-linecap="round" filter="url(#violetBloom)"/>
</g>"""

v3 = """<g transform="translate(105, 105)">
  <!-- Variation A3: The Dynamic Grimoire Book -->
  <!-- Projection grid base -->
  <ellipse cx="0" cy="20" rx="30" ry="8" stroke="#a855f7" stroke-width="1" stroke-opacity="0.3" fill="none" filter="url(#ringGlow)"/>
  <ellipse cx="0" cy="20" rx="15" ry="4" stroke="#a855f7" stroke-width="1" stroke-opacity="0.6" fill="none" filter="url(#ringGlow)"/>
  
  <!-- Dynamic Left Page (Curved edges) -->
  <path d="M0 12 Q -15 15 -30 -2 L-30 -22 Q -15 -5 0 -8 Z" fill="none" stroke="#a855f7" stroke-width="2.5" filter="url(#violetGlow)" stroke-linejoin="round"/>
  <!-- Dynamic Right Page (Curved edges) -->
  <path d="M0 12 Q 15 15 30 -2 L30 -22 Q 15 -5 0 -8 Z" fill="none" stroke="#c084fc" stroke-width="2.5" filter="url(#violetGlow)" stroke-linejoin="round"/>

  <!-- Bookmarks / Ribbons hanging down -->
  <path d="M-4 5 L-4 18 L-8 22 Z" fill="#f5d0fe" opacity="0.8" filter="url(#violetBloom)"/>
  <path d="M4 8 L4 22 L8 26 Z" fill="#c084fc" opacity="0.8" filter="url(#violetBloom)"/>

  <!-- Core Diamond above spine -->
  <polygon points="0,-18 4,-12 0,-6 -4,-12" fill="#ffffff" filter="url(#violetBloom)"/>
  <line x1="0" y1="-8" x2="0" y2="12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" filter="url(#violetBloom)"/>
</g>"""

os.makedirs('design/logos/Opta-Help', exist_ok=True)

for i, mark in zip(['a1', 'a2', 'a3'], [v1, v2, v3]):
    svg_content = base_svg.replace('{INNER_MARK}', mark)
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
    out_path = f'design/logos/Opta-Help/opta-help-book-{i}.html'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    subprocess.run(['open', out_path])
    print(f"Opened {out_path}")
