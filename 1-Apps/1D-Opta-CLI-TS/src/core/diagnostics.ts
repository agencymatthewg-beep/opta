import chalk from 'chalk';

export interface DiagnosticResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

/**
 * Run connection diagnostics against the LMX server.
 * Checks: port reachable, correct port (1234 vs 10001), health endpoint, model loaded.
 */
export async function runConnectionDiagnostics(host: string, port: number): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. Check if configured port is reachable
  try {
    const res = await fetch(`http://${host}:${port}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      results.push({ status: 'ok', message: `LMX reachable at ${host}:${port}` });
    } else {
      results.push({ status: 'warning', message: `LMX returned ${res.status} at ${host}:${port}`, suggestion: 'Check server logs' });
    }
  } catch {
    results.push({
      status: 'error',
      message: `Cannot reach LMX at ${host}:${port}`,
      suggestion: `Check if LMX is running. Try: curl http://${host}:${port}/v1/models`,
    });

    // 2. Try common alternative ports
    const altPorts = [1234, 10001, 8080, 11434].filter(p => p !== port);
    for (const altPort of altPorts) {
      try {
        const altRes = await fetch(`http://${host}:${altPort}/v1/models`, { signal: AbortSignal.timeout(2000) });
        if (altRes.ok) {
          results.push({
            status: 'warning',
            message: `LMX found on port ${altPort} instead of ${port}`,
            suggestion: `Run: opta config set connection.port ${altPort}`,
          });
          break;
        }
      } catch { /* port not reachable */ }
    }
  }

  // 3. Check if any model is loaded (only if connection works)
  if (results[0]?.status === 'ok') {
    try {
      const res = await fetch(`http://${host}:${port}/v1/models`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as { data?: Array<{ id: string }> };
      if (!data.data?.length) {
        results.push({
          status: 'warning',
          message: 'No models loaded in LMX',
          suggestion: 'Load a model: /load <model-id> or opta models load <id>',
        });
      }
    } catch { /* already reported */ }
  }

  return results;
}

/**
 * Format diagnostics for display.
 */
export function formatDiagnostics(results: DiagnosticResult[]): string {
  return results.map(r => {
    const icon = r.status === 'ok' ? chalk.green('\u25cf') : r.status === 'warning' ? chalk.yellow('\u25cf') : chalk.red('\u25cf');
    let line = `  ${icon} ${r.message}`;
    if (r.suggestion) {
      line += '\n    ' + chalk.dim(r.suggestion);
    }
    return line;
  }).join('\n');
}
