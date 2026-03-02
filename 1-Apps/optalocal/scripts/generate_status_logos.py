import os
import re
import subprocess

template_path = 'design/logos/opta-logo-template.html'
with open(template_path, 'r', encoding='utf-8') as f:
    template = f.read()

# Update text to 'status'
template = re.sub(r'<span class="learn-text">learn</span>', '<span class="learn-text">status</span>', template)

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
      <!-- Concept 1: The Heartbeat / Signal Pulse -->
      <!-- Circular radar sweep rings -->
      <circle cx="0" cy="0" r="30" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4 6"/>
      <circle cx="0" cy="0" r="15" fill="none" stroke="#a855f7" stroke-width="1" stroke-opacity="0.5"/>
      
      <!-- Pulse line extending across the centre -->
      <path d="M-40 0 L-15 0 L-8 -15 L8 20 L15 0 L40 0" fill="none" stroke="#f5d0fe" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#violetBloom)"/>
      <path d="M-40 0 L-15 0 L-8 -15 L8 20 L15 0 L40 0" fill="none" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      
      <!-- Nodes at the peaks and troughs of the signal -->
      <circle cx="-8" cy="-15" r="2.5" fill="#ffffff" filter="url(#violetBloom)"/>
      <circle cx="8" cy="20" r="2.5" fill="#ffffff" filter="url(#violetBloom)"/>
    </g>"""

v2 = """<g transform="translate(105, 105)">
      <!-- Concept 2: The Server Rack / Equaliser Bars -->
      <!-- Bounding tech bracket -->
      <path d="M-25 35 L-35 35 L-35 -35 L-25 -35" fill="none" stroke="#a855f7" stroke-width="2" opacity="0.6"/>
      <path d="M25 35 L35 35 L35 -35 L25 -35" fill="none" stroke="#a855f7" stroke-width="2" opacity="0.6"/>

      <!-- Vertical data / status bars -->
      <!-- Left Bar: Stable/Mid -->
      <line x1="-15" y1="20" x2="-15" y2="-5" stroke="#c084fc" stroke-width="5" stroke-linecap="round" filter="url(#violetGlow)"/>
      <circle cx="-15" cy="25" r="2" fill="#a855f7"/>
      
      <!-- Center Bar: Active/High -->
      <line x1="0" y1="20" x2="0" y2="-20" stroke="#f5d0fe" stroke-width="5" stroke-linecap="round" filter="url(#violetBloom)"/>
      <circle cx="0" cy="25" r="2" fill="#f5d0fe" filter="url(#violetBloom)"/>
      
      <!-- Right Bar: Idle/Low -->
      <line x1="15" y1="20" x2="15" y2="10" stroke="#a855f7" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
      <circle cx="15" cy="25" r="2" fill="#a855f7" opacity="0.5"/>

      <!-- Top active ping line -->
      <line x1="-20" y1="-25" x2="20" y2="-25" stroke="#f5d0fe" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.8"/>
    </g>"""

v3 = """<g transform="translate(105, 105)">
      <!-- Concept 3: The Radial Dial / Metre -->
      <!-- Outer dial arc representing system load (75% full) -->
      <path d="M-25 25 A 35 35 0 1 1 25 25" fill="none" stroke="#a855f7" stroke-width="2" stroke-opacity="0.3" stroke-linecap="round"/>
      <path d="M-25 25 A 35 35 0 1 1 25 -25" fill="none" stroke="#c084fc" stroke-width="3" stroke-linecap="round" filter="url(#violetGlow)"/>
      <path d="M-25 25 A 35 35 0 0 1 -10 -33" fill="none" stroke="#f5d0fe" stroke-width="3" stroke-linecap="round" filter="url(#violetBloom)"/>
      
      <!-- Inner tick marks -->
      <line x1="0" y1="-25" x2="0" y2="-20" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
      <line x1="-25" y1="0" x2="-20" y2="0" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
      <line x1="25" y1="0" x2="20" y2="0" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>

      <!-- Central Pivot and Needle -->
      <circle cx="0" cy="10" r="6" fill="none" stroke="#f5d0fe" stroke-width="2" filter="url(#violetBloom)"/>
      <circle cx="0" cy="10" r="2.5" fill="#ffffff"/>
      <line x1="0" y1="10" x2="18" y2="-12" stroke="#f5d0fe" stroke-width="2.5" stroke-linecap="round" filter="url(#violetBloom)"/>
      
      <!-- Indicator dot at needle tip -->
      <circle cx="18" cy="-12" r="2.5" fill="#ffffff" filter="url(#violetBloom)"/>
    </g>"""

os.makedirs('design/logos/Opta-Status', exist_ok=True)

for i, mark in enumerate([v1, v2, v3], 1):
    svg_content = base_svg.replace('{INNER_MARK}', mark)
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
    out_path = f'design/logos/Opta-Status/opta-status-v{i}.html'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html_out)
    subprocess.run(['open', out_path])
    print(f"Opened {out_path}")
