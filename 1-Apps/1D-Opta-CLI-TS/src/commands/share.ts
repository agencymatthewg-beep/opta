export type ExportFormat = 'markdown' | 'json' | 'text';

interface ExportInput {
  id: string;
  model: string;
  messages: Array<{ role: string; content: string | unknown }>;
  title?: string;
  created?: string;
  toolCallCount?: number;
}

export function formatSessionExport(session: ExportInput, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        id: session.id,
        model: session.model,
        title: session.title,
        created: session.created ?? new Date().toISOString(),
        messages: session.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[multimodal]',
          })),
        toolCallCount: session.toolCallCount ?? 0,
      }, null, 2);

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
      }
      return md;
    }
  }
}
