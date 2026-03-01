import { cn } from "@/lib/utils";

interface ApiEndpointProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "WS";
  path: string;
  description: string;
  auth?: boolean;
  params?: { name: string; type: string; description: string; required?: boolean }[];
  response?: string;
}

const methodColors: Record<string, string> = {
  GET: "bg-neon-green/10 text-neon-green border-neon-green/20",
  POST: "bg-neon-blue/10 text-neon-blue border-neon-blue/20",
  PUT: "bg-neon-amber/10 text-neon-amber border-neon-amber/20",
  DELETE: "bg-neon-red/10 text-neon-red border-neon-red/20",
  WS: "bg-neon-purple/10 text-neon-purple border-neon-purple/20",
};

export function ApiEndpoint({ method, path, description, auth, params, response }: ApiEndpointProps) {
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden mb-4">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface">
        <span className={cn("px-2 py-0.5 rounded text-xs font-bold font-mono border", methodColors[method])}>
          {method}
        </span>
        <code className="text-sm text-text-primary font-mono">{path}</code>
        {auth && (
          <span className="ml-auto text-xs text-text-muted bg-elevated px-2 py-0.5 rounded">
            Auth required
          </span>
        )}
      </div>
      <div className="px-4 py-3 border-t border-white/5">
        <p className="text-sm text-text-secondary">{description}</p>
        {params && params.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-text-muted mb-2">Parameters</h4>
            <div className="space-y-1">
              {params.map((p) => (
                <div key={p.name} className="flex items-baseline gap-2 text-sm">
                  <code className="text-neon-cyan text-xs">{p.name}</code>
                  <span className="text-text-muted text-xs">{p.type}</span>
                  {p.required && <span className="text-neon-red text-xs">required</span>}
                  <span className="text-text-secondary text-xs">— {p.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {response && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-text-muted mb-1">Response</h4>
            <pre className="text-xs text-text-muted font-mono bg-[var(--color-code-bg)] rounded p-2 overflow-x-auto">{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
