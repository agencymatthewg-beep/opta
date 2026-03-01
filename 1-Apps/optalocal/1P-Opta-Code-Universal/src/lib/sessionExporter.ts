import type { TimelineItem } from "../types";

export function exportToMarkdown(
  sessionId: string,
  items: TimelineItem[],
): string {
  const lines: string[] = [];
  lines.push(`# Opta Session: ${sessionId}`);
  lines.push(`> Exported: ${new Date().toISOString()}`);
  lines.push("");

  for (const item of items) {
    switch (item.kind) {
      case "user":
        lines.push(`### ${item.title || "User"}`);
        if (item.body) lines.push(item.body);
        break;

      case "assistant":
        lines.push("### Assistant");
        if (item.body) lines.push(item.body);
        break;

      case "tool":
        if (item.isToolResult) {
          lines.push(`**Tool result** (${item.title})`);
        } else {
          lines.push(`**Tool call** \`${item.title}\``);
        }
        if (item.body) {
          lines.push("```");
          lines.push(item.body);
          lines.push("```");
        }
        break;

      case "thinking":
        lines.push("### Thinking");
        if (item.body) {
          lines.push(`> ${item.body.replace(/\n/g, "\n> ")}`);
        }
        break;

      case "system":
        lines.push(`*${item.title}*`);
        if (item.body) lines.push(item.body);
        if (item.stats) {
          lines.push(
            `\`${item.stats.tokens} tokens | ${item.stats.speed.toFixed(1)} tok/s | ${item.stats.elapsed.toFixed(1)}s | ${item.stats.toolCalls} tool calls\``,
          );
        }
        break;

      default:
        lines.push(`**${item.title}**`);
        if (item.body) lines.push(item.body);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadAsFile(
  filename: string,
  content: string,
  mimeType = "text/markdown",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
