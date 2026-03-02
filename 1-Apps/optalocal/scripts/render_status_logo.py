import os
import re
import subprocess

with open('design/logos/opta-logo-template.html', 'r', encoding='utf-8') as f:
    template = f.read()

with open('design/logos/Opta-Status/opta-status-mark.svg', 'r', encoding='utf-8') as f:
    svg_content = f.read()

html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)
html_out = re.sub(
    r'<span class="learn-text">[^<]+</span>',
    '<span class="learn-text">status</span>',
    html_out,
    count=1,
)

out_html = 'design/logos/Opta-Status/opta-status-full.html'
out_png = 'design/logos/Opta-Status/opta-status-full.png'

with open(out_html, 'w', encoding='utf-8') as f:
    f.write(html_out)
    
cmd = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "--headless",
    "--window-size=600,600",
    "--force-device-scale-factor=4.0",
    f"--screenshot={out_png}",
    f"file://{os.path.abspath(out_html)}"
]
subprocess.run(cmd, check=True)
