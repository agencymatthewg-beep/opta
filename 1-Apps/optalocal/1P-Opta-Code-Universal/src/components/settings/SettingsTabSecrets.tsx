import { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { RefreshCw, Key, Shield, CheckCircle, AlertTriangle } from "lucide-react";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic API Key", placeholder: "sk-ant-..." },
  { id: "claude", label: "Claude API Key (Alias)", placeholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI API Key", placeholder: "sk-..." },
  { id: "codex", label: "Codex API Key (Alias)", placeholder: "sk-..." },
  { id: "minimax", label: "Minimax API Key", placeholder: "xxxx..." },
  { id: "lmx", label: "LMX API Key", placeholder: "lmx-..." },
  { id: "gemini", label: "Gemini API Key", placeholder: "AIzaSy..." },
  { id: "google", label: "Google API Key (Alias)", placeholder: "AIzaSy..." },
  { id: "opencode-zen", label: "OpenCode Zen API Key", placeholder: "zen-..." },
  { id: "opencode", label: "OpenCode API Key (Alias)", placeholder: "zen-..." },
];

export function SettingsTabSecrets({
  connection,
}: {
  connection: DaemonConnectionOptions;
}) {
  const { runOperation, running } = useOperations(connection);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        await runOperation("keychain.status", {});
      } catch (e) {
        console.error("Failed to fetch keychain status:", e);
      }
    };
    void fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveKey = async (provider: string, key: string) => {
    if (!key.trim()) return;
    setStatusMsg(null);
    try {
      const result = await runOperation(`keychain.set-${provider}`, {
        apiKey: key.trim(),
      });
      if (result.ok) {
        setStatusMsg({
          type: "success",
          text: `Successfully saved ${provider} key.`,
        });
        setKeys((prev) => ({ ...prev, [provider]: "" }));
      } else {
        setStatusMsg({
          type: "error",
          text: result.error?.message || "Failed to save key.",
        });
      }
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Unknown error.",
      });
    }
  };

  const handleSyncVault = async () => {
    setStatusMsg(null);
    try {
      const result = await runOperation("vault.pull", {});
      if (result.ok) {
        setStatusMsg({ type: "success", text: "Successfully synced vault." });
      } else {
        setStatusMsg({
          type: "error",
          text: result.error?.message || "Failed to sync vault.",
        });
      }
    } catch (e) {
      setStatusMsg({
        type: "error",
        text: e instanceof Error ? e.message : "Unknown error.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
            <Shield size={20} className="text-purple-500" />
            Secrets & Vault
          </h3>
          <p className="text-sm text-gray-400 m-0">
            Manage your API keys securely. Keys are stored in the local daemon
            keychain.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSyncVault()}
          disabled={running}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm border border-white/10 hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} />
          Sync Vault
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          {statusMsg.text}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {PROVIDERS.map((provider) => (
          <div key={provider.id} className="bg-black/20 border border-white/10 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {provider.label}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="password"
                  value={keys[provider.id] || ""}
                  onChange={(e) =>
                    setKeys((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                  placeholder={provider.placeholder}
                  className="w-full bg-black/50 border border-white/10 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSaveKey(provider.id, keys[provider.id] || "")}
                disabled={!(keys[provider.id] || "").trim() || running}
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
