import re
import os

with open('design/logos/opta-logo-template.html', 'r', encoding='utf-8') as f:
    template = f.read()

svg_match = re.search(r'<svg width="210".*?</svg>', template, flags=re.DOTALL)
if svg_match:
    svg_content = svg_match.group(0)
    os.makedirs('design/logos/Opta-Learn', exist_ok=True)
    with open('design/logos/Opta-Learn/opta-learn-logo-final.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print("Extracted Opta Learn SVG.")
else:
    print("SVG not found in template.")
