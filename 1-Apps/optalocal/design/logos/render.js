const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function renderLogo(appName, htmlTemplate, outputSuffix, omitBackground = false) {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 600, height: 600 },
        deviceScaleFactor: 4, // 2400x2400 high-res output
    });

    const templatePath = path.resolve(__dirname, htmlTemplate);
    await page.goto(`file://${templatePath}`);

    const outDir = path.resolve(__dirname, appName);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const outputPath = path.join(outDir, `${appName.toLowerCase()}-logo${outputSuffix}.png`);
    await page.screenshot({ 
        path: outputPath, 
        omitBackground: omitBackground 
    });

    console.log(`✅ Rendered: ${outputPath}`);
    await browser.close();
}

async function main() {
    // Example: Render Opta-Learn logos (both standard and transparent)
    const apps = ['Opta-Learn']; // You can expand this array to include all apps

    for (const app of apps) {
        console.log(`Generating logos for ${app}...`);
        
        // 1. Standard Logo with Background + Particles + Wordmark
        await renderLogo(app, 'opta-logo-template.html', '-final', false);

        // 2. Transparent Logo (Mark Only)
        await renderLogo(app, 'opta-logo-transparent-template.html', '-transparent', true);
    }
}

main().catch(console.error);