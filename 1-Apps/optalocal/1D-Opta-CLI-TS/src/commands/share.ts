export type ExportFormat = 'markdown' | 'json' | 'text';

interface ExportInput {
  id: string;
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  title?: string;
  created?: string;
  toolCallCount?: number;
}

export function formatSessionExport(session: ExportInput, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(
        {
          id: session.id,
          model: session.model,
          title: session.title,
          created: session.created ?? new Date().toISOString(),
          messages: session.messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({
              role: m.role,
              content: typeof m.content === 'string' ? m.content : '[multimodal]',
            })),
          toolCallCount: session.toolCallCount ?? 0,
        },
        null,
        2
      );

    case 'text': {
      const lines: string[] = [];
      lines.push(`Session: ${session.id}`);
      lines.push(`Model: ${session.model}`);
      lines.push(`Date: ${session.created ?? new Date().toISOString()}`);
      lines.push('');
      for (const m of session.messages) {
        if (m.role === 'system') continue;
        const content = typeof m.content === 'string' ? m.content : '[multimodal]';
        const label = m.role === 'user' ? 'User' : 'Assistant';
        lines.push(`${label}: ${content}`);
        // Preserve image references in export
        if (Array.isArray(m.content)) {
          for (const part of m.content as Array<{ type: string; image_url?: { url?: string } }>) {
            if (part.type === 'image_url') {
              const url = part.image_url?.url;
              lines.push(
                `[Image: ${url?.startsWith('data:') ? 'embedded base64' : url || 'unknown'}]`
              );
            }
          }
        }
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'markdown':
    default: {
      let md = `# Opta CLI Session\n\n`;
      md += `- **Session:** ${session.id}\n`;
      md += `- **Model:** ${session.model}\n`;
      md += `- **Date:** ${session.created ?? new Date().toISOString()}\n\n---\n\n`;
      for (const m of session.messages) {
        if (m.role === 'system') continue;
        const content = typeof m.content === 'string' ? m.content : '[multimodal]';
        md += m.role === 'user' ? `## User\n\n${content}\n\n` : `## Assistant\n\n${content}\n\n`;
        // Preserve image references in export
        if (Array.isArray(m.content)) {
          for (const part of m.content as Array<{ type: string; image_url?: { url?: string } }>) {
            if (part.type === 'image_url') {
              const url = part.image_url?.url;
              md += `> [Image: ${url?.startsWith('data:') ? 'embedded base64' : url || 'unknown'}]\n\n`;
            }
          }
        }
      }
      return md;
    }
  }
}
