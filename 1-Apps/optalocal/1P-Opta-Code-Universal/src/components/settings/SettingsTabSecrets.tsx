import { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { RefreshCw, Key, Shield, CheckCircle, AlertTriangle } from "lucide-react";

export function SettingsTabSecrets({
  connection,
}: {
  connection: DaemonConnectionOptions;
}) {
  const { runOperation, running } = useOperations(connection);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [lmxKey, setLmxKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
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
        if (provider === "anthropic") setAnthropicKey("");
        if (provider === "openai") setOpenAiKey("");
        if (provider === "lmx") setLmxKey("");
        if (provider === "gemini") setGeminiKey("");
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
        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Anthropic API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-black/50 border border-white/10 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSaveKey("anthropic", anthropicKey)}
              disabled={!anthropicKey.trim() || running}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            OpenAI API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="password"
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-black/50 border border-white/10 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSaveKey("openai", openAiKey)}
              disabled={!openAiKey.trim() || running}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            LMX API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="password"
                value={lmxKey}
                onChange={(e) => setLmxKey(e.target.value)}
                placeholder="lmx-..."
                className="w-full bg-black/50 border border-white/10 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSaveKey("lmx", lmxKey)}
              disabled={!lmxKey.trim() || running}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        <div className="bg-black/20 border border-white/10 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Gemini API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-black/50 border border-white/10 rounded-md py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSaveKey("gemini", geminiKey)}
              disabled={!geminiKey.trim() || running}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
