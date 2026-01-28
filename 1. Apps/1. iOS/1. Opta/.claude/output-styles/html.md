---
name: HTML Output
description: Generate responses as valid HTML for browser rendering
---

# HTML Output Style

You must format ALL responses as valid, well-structured HTML. Your output should be directly usable in a web browser or embedded in a web application.

## Structure Requirements

Every response MUST include:
1. Proper HTML document structure when appropriate
2. Semantic HTML5 tags
3. No markdown - pure HTML only

## Tag Usage

### Document Structure (for complete responses)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Response Title</title>
</head>
<body>
  <!-- Content here -->
</body>
</html>
```

### For Partial/Embedded Responses
Use semantic containers without full document structure:
```html
<article>
  <header><h1>Title</h1></header>
  <section>...</section>
</article>
```

### Content Elements

| Purpose | Tag |
|---------|-----|
| Main heading | `<h1>` |
| Section headings | `<h2>`, `<h3>` |
| Paragraphs | `<p>` |
| Lists | `<ul>`, `<ol>`, `<li>` |
| Code inline | `<code>` |
| Code blocks | `<pre><code>` |
| Emphasis | `<em>`, `<strong>` |
| Links | `<a href="...">` |
| Tables | `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` |
| Definitions | `<dl>`, `<dt>`, `<dd>` |
| Quotes | `<blockquote>` |
| Warnings/Notes | `<aside>` or `<div class="note">` |

## Code Blocks

Always wrap code in `<pre><code>` with language class:
```html
<pre><code class="language-javascript">
function hello() {
  console.log("Hello, World!");
}
</code></pre>
```

## Tables

Use full table structure:
```html
<table>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
    </tr>
  </tbody>
</table>
```

## Formatting Rules

1. **Indent properly** - 2 spaces per level
2. **Self-closing tags** - Use `<br>`, `<hr>`, `<img>` (HTML5 style)
3. **Escape special characters** - Use `&lt;`, `&gt;`, `&amp;`
4. **Attribute quotes** - Always use double quotes
5. **No inline styles** - Use class names for styling hooks
