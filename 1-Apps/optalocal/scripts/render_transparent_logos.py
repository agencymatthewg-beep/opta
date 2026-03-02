import os
import re
import subprocess

apps = {
    'Local': {'slug': 'local', 'text': 'local'},
    'LMX': {'slug': 'lmx', 'text': 'lmx'},
    'Accounts': {'slug': 'accounts', 'text': 'accounts'},
    'CLI': {'slug': 'cli', 'text': 'cli'},
    'Code-Desktop': {'slug': 'code', 'text': 'code'},
    'Learn': {'slug': 'learn', 'text': 'learn'},
    'Help': {'slug': 'help', 'text': 'help'},
    'Status': {'slug': 'status', 'text': 'status'}
}

with open('design/logos/opta-logo-transparent-template.html', 'r', encoding='utf-8') as f:
    template = f.read()

for app_name, info in apps.items():
    svg_path = f'design/logos/Opta-{app_name}/opta-{info["slug"]}-mark.svg'
    if not os.path.exists(svg_path):
        print(f"Skipping {app_name}, SVG not found.")
        continue
        
    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_content = f.read()

    # The template has an SVG starting with `<svg width="210"` and ending with `</svg>`
    # We replace it with svg_content.
    html_out = re.sub(r'<svg width="210".*?</svg>', svg_content, template, flags=re.DOTALL)

    out_html = f'design/logos/Opta-{app_name}/opta-{info["slug"]}-transparent.html'
    out_png = f'design/logos/Opta-{app_name}/opta-{info["slug"]}-transparent.png'
    
    # Create dir if not exists
    os.makedirs(f'design/logos/Opta-{app_name}', exist_ok=True)
    
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(html_out)
        
    print(f"Rendering {out_png}...")
    cmd = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless",
        "--window-size=600,600",
        "--force-device-scale-factor=4.0",
        "--default-background-color=00000000",
        f"--screenshot={out_png}",
        f"file://{os.path.abspath(out_html)}"
    ]
    subprocess.run(cmd, check=True)
    
    # Open the generated image and HTML for the user to review
    subprocess.run(["open", "-a", "Google Chrome", out_png])

print("Done rendering transparent logos.")
