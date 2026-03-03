import { useState } from "react";
import { Wrench, WifiOff, ChevronDown, ChevronRight } from "lucide-react";
import { usePlatform } from "../hooks/usePlatform.js";

interface Props {
  host: string;
  port: number;
  onRetry: () => void;
  onDismiss: () => void;
}

export function OnboardingPage({ host, port, onRetry, onDismiss }: Props) {
  const [showRemote, setShowRemote] = useState(false);
  const platform = usePlatform();

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
            Opta Code can repair the local daemon automatically. Start with the
            guided repair action below.
          </p>
        </div>

        <ol className="onboarding-steps">
          <li>
            <span className="step-number">1</span>
            <div className="step-body">
              <strong>Run automatic repair</strong>
              <p>
                This attempts to bootstrap the daemon and refresh the connection
                state without manual terminal commands.
              </p>
            </div>
          </li>

          <li>
            <span className="step-number">2</span>
            <div className="step-body">
              <strong>Repair connection</strong>
              <button
                type="button"
                className="onboarding-connect"
                onClick={onRetry}
              >
                <Wrench size={15} />
                Repair daemon connection
              </button>
              <p className="step-note">
                Opta is currently targeting{" "}
                <code>
                  {host}:{port}
                </code>
                .
              </p>
            </div>
          </li>

          <li>
            <span className="step-number">3</span>
            <div className="step-body">
              <strong>If repair fails</strong>
              <p>
                Open Setup Wizard to re-detect your daemon endpoint and verify
                connection settings.
              </p>
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
            {showRemote ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
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
