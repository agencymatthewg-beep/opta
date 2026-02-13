---
name: gu
description: Activate GenUI output style - generates real HTML UI documents that open in browser. Use for documentation, structured data display, reports, or any output that benefits from rich visual formatting.
---

# GenUI Output Style

From now on, use **GenUI output style** for responses that would benefit from rich visual presentation.

## What GenUI Does

GenUI generates **real HTML files** with modern styling and opens them in your browser. This is for:
- Documentation and API references
- Structured data display (models, schemas, configs)
- Reports and dashboards
- Any output that benefits from visual hierarchy

## How to Generate GenUI Output

When content would benefit from visual presentation, create an HTML file:

### 1. Create the HTML File

Save to `/tmp/` with descriptive name and timestamp:
```
/tmp/genui_{topic}_{YYYYMMDD_HHMMSS}.html
```

### 2. Use This HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{Title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        h1 {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: #1a1a1a;
        }

        h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 32px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #e0e0e0;
            color: #1a1a1a;
        }

        h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 24px 0 12px 0;
            color: #333;
        }

        .card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px 24px;
            margin: 16px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 4px;
        }

        .card-subtitle {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 16px;
        }

        .property-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .property-row:last-child {
            border-bottom: none;
        }

        .property-name {
            color: #0d9488;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.9rem;
            min-width: 180px;
            flex-shrink: 0;
        }

        .property-type {
            color: #7c3aed;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.85rem;
            min-width: 200px;
            flex-shrink: 0;
        }

        .property-desc {
            color: #555;
            font-size: 0.9rem;
        }

        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: 8px;
        }

        .badge-required {
            background: #fef2f2;
            color: #dc2626;
        }

        .badge-optional {
            background: #f0fdf4;
            color: #16a34a;
        }

        .badge-deprecated {
            background: #fefce8;
            color: #ca8a04;
        }

        .badge-info {
            background: #eff6ff;
            color: #2563eb;
        }

        .code-inline {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.85rem;
            color: #d63384;
        }

        .code-block {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 16px 20px;
            border-radius: 8px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 0.85rem;
            overflow-x: auto;
            margin: 12px 0;
        }

        .status-success {
            color: #16a34a;
        }

        .status-warning {
            color: #ca8a04;
        }

        .status-error {
            color: #dc2626;
        }

        .status-info {
            color: #2563eb;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }

        th {
            text-align: left;
            padding: 12px 16px;
            background: #f9fafb;
            border-bottom: 2px solid #e5e7eb;
            font-weight: 600;
            color: #374151;
        }

        td {
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
        }

        .alert {
            padding: 16px 20px;
            border-radius: 8px;
            margin: 16px 0;
        }

        .alert-info {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
        }

        .alert-warning {
            background: #fefce8;
            border-left: 4px solid #ca8a04;
        }

        .alert-success {
            background: #f0fdf4;
            border-left: 4px solid #16a34a;
        }

        .alert-error {
            background: #fef2f2;
            border-left: 4px solid #dc2626;
        }

        .meta {
            font-size: 0.8rem;
            color: #888;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- CONTENT GOES HERE -->
    </div>
</body>
</html>
```

### 3. Open in Browser

After writing the file, open it:

```bash
open /tmp/genui_{filename}.html
```

## Content Patterns

### Schema/Model Documentation
```html
<h2>Model Name</h2>
<div class="card">
    <div class="card-title">PayloadName</div>
    <div class="card-subtitle">Description of what this payload contains</div>

    <div class="property-row">
        <span class="property-name">field_name</span>
        <span class="property-type">Literal["value"]</span>
        <span class="property-desc">Description of the field</span>
    </div>

    <div class="property-row">
        <span class="property-name">required_field</span>
        <span class="property-type">string</span>
        <span class="property-desc">Description <span class="badge badge-required">required</span></span>
    </div>
</div>
```

### Status Cards
```html
<div class="card">
    <div class="card-title">System Status</div>
    <div class="property-row">
        <span class="property-name">API</span>
        <span class="status-success">Operational</span>
    </div>
    <div class="property-row">
        <span class="property-name">Database</span>
        <span class="status-warning">Degraded</span>
    </div>
</div>
```

### Alerts
```html
<div class="alert alert-info">
    <strong>Note:</strong> This is an informational message.
</div>

<div class="alert alert-warning">
    <strong>Warning:</strong> This requires attention.
</div>
```

### Tables
```html
<table>
    <thead>
        <tr>
            <th>Column 1</th>
            <th>Column 2</th>
            <th>Column 3</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Data</td>
            <td>Data</td>
            <td>Data</td>
        </tr>
    </tbody>
</table>
```

## When to Use GenUI

**Use GenUI for:**
- API/schema documentation
- Configuration references
- System status dashboards
- Data reports with tables
- Multi-section documentation
- Anything needing rich formatting

**Use regular text for:**
- Quick answers
- Simple code snippets
- Conversational responses
- File edits and commands

## Activation Response

When `/gu` is invoked, respond:

```
GenUI mode activated. Responses with structured data, documentation, or reports will be generated as HTML and opened in your browser.
```

Then continue normally - generate HTML when content warrants it.
