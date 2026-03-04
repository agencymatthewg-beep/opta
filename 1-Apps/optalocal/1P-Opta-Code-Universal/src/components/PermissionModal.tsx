import React from "react";
import type { PermissionRequest } from "../types";

interface PermissionModalProps {
  request: PermissionRequest;
  onResolve: (sessionId: string, requestId: string, decision: "allow" | "deny") => void;
}

export function PermissionModal({ request, onResolve }: PermissionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 text-red-400 mb-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-100">
              Permission Required
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            The agent is requesting permission to execute a potentially sensitive operation.
          </p>
        </div>

        <div className="p-6 bg-zinc-950/50 flex-1 overflow-y-auto max-h-[50vh]">
          <div className="mb-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Tool Name
            </h3>
            <div className="font-mono text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 p-2 rounded-md">
              {request.toolName}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Arguments
            </h3>
            <pre className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(request.args, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600"
            onClick={() => onResolve(request.sessionId, request.requestId, "deny")}
          >
            Deny Operation
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2"
            onClick={() => onResolve(request.sessionId, request.requestId, "allow")}
          >
            Approve Execution
          </button>
        </div>
      </div>
    </div>
  );
}
