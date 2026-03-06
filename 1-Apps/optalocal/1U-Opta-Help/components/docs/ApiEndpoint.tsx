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
  GET: "bg-neon-green/10 text-neon-green shadow-[inset_0_0_0_1px_rgba(34,197,94,0.25)]",
  POST: "bg-neon-blue/10 text-neon-blue shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]",
  PUT: "bg-neon-amber/10 text-neon-amber shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)]",
  DELETE: "bg-neon-red/10 text-neon-red shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)]",
  WS: "bg-neon-purple/10 text-neon-purple shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]",
};

export function ApiEndpoint({ method, path, description, auth, params, response }: ApiEndpointProps) {
  return (
    <div className="rounded-lg doc-embed-block overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-transparent">
        <span className={cn("px-2 py-0.5 rounded text-xs font-bold font-mono", methodColors[method])}>
          {method}
        </span>
        <code className="text-sm text-text-primary font-mono">{path}</code>
        {auth && (
          <span className="ml-auto text-xs text-text-muted bg-white/5 px-2 py-0.5 rounded-md">
            Auth required
          </span>
        )}
      </div>
      <div className="px-4 py-3 bg-transparent">
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
            <pre className="text-xs text-text-muted font-mono surface-embedded-code bg-transparent rounded-md p-2 overflow-x-auto">{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
