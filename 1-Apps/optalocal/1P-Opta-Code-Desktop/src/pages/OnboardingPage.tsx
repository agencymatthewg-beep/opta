import { useState } from "react";
import { Terminal, WifiOff, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { usePlatform } from "../hooks/usePlatform.js";

interface Props {
  host: string;
  port: number;
  onRetry: () => void;
  onDismiss: () => void;
}

const INSTALL_CMD = "npm install -g @opta/cli";
const DAEMON_CMD = "opta daemon start";
const DAEMON_BG_CMD = "opta daemon start --background";

export function OnboardingPage({ host, port, onRetry, onDismiss }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showRemote, setShowRemote] = useState(false);
  const platform = usePlatform();
  const terminalName = platform === "windows" ? "PowerShell" : "Terminal";

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card glass">
        <button
          type="button"
          className="onboarding-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss setup guide"
        >
          ✕
        </button>

        <div className="onboarding-header">
          <div className="onboarding-icon">
            <WifiOff size={28} />
          </div>
          <h2>Daemon not detected</h2>
          <p>
            Opta Code connects to the Opta CLI daemon running on your machine.
            Follow the steps below to get started.
          </p>
        </div>

        <ol className="onboarding-steps">
          <li>
            <span className="step-number">1</span>
            <div className="step-body">
              <strong>Install the Opta CLI</strong>
              <p>Skip this step if you already have it installed.</p>
              <div className="onboarding-command">
                <code>{INSTALL_CMD}</code>
                <button
                  type="button"
                  onClick={() => void copy(INSTALL_CMD, "install")}
                  aria-label="Copy install command"
                >
                  {copied === "install" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </li>

          <li>
            <span className="step-number">2</span>
            <div className="step-body">
              <strong>Start the daemon</strong>
              <p>Run this in {terminalName}, then come back here:</p>
              <div className="onboarding-command">
                <code>{DAEMON_CMD}</code>
                <button
                  type="button"
                  onClick={() => void copy(DAEMON_CMD, "daemon")}
                  aria-label="Copy daemon command"
                >
                  {copied === "daemon" ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <p className="step-note">
                Keep {terminalName} open, or run{" "}
                <code>{DAEMON_BG_CMD}</code> to detach it.
                Listens on port <code>{port}</code> by default.
              </p>
            </div>
          </li>

          <li>
            <span className="step-number">3</span>
            <div className="step-body">
              <strong>Connect</strong>
              <button
                type="button"
                className="onboarding-connect"
                onClick={onRetry}
              >
                <Terminal size={15} />
                Try connecting to {host}:{port}
              </button>
            </div>
          </li>
        </ol>

        <div className="onboarding-remote">
          <button
            type="button"
            className="onboarding-remote-toggle"
            onClick={() => setShowRemote((v) => !v)}
            aria-expanded={showRemote}
          >
            {showRemote ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Using a remote or non-default daemon?
          </button>
          {showRemote && (
            <p className="onboarding-remote-body">
              Close this screen and use the <strong>connection form</strong> in
              the header to set a custom host and port. The daemon can run on
              any machine reachable from this device —{" "}
              {platform === "macos"
                ? "including your Mac Studio on the local network."
                : "including a remote server on your local network."}
            </p>
          )}
        </div>

        <button type="button" className="onboarding-skip" onClick={onDismiss}>
          Skip — configure manually
        </button>
      </div>
    </div>
  );
}
