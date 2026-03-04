import type { Platform } from "../../hooks/usePlatform.js";
import { WIZARD_THEME } from "./shared";

export function StepWelcome({ platform }: { platform: Platform | null }) {
  const desc =
    platform === "windows"
      ? "Routes prompts to your Opta LMX inference server or Anthropic cloud - fully private when running locally. Takes about 90 seconds to configure."
      : "Routes prompts through your own local LMX inference server - zero cloud latency, fully private. Takes about 90 seconds to configure.";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 9,
          marginBottom: 28,
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            background:
              "linear-gradient(130deg, #fff 0%, #c4b5fd 60%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          OPTA
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: WIZARD_THEME.primaryBright,
            background: WIZARD_THEME.primaryDim,
            border: "1px solid rgba(139,92,246,0.22)",
            borderRadius: 5,
            padding: "3px 8px",
            letterSpacing: "0.07em",
          }}
        >
          CLI v0.5
        </span>
      </div>

      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1.22,
          marginBottom: 12,
          color: WIZARD_THEME.text1,
        }}
      >
        Your local AI
        <br />
        coding assistant
      </h1>

      <p
        style={{
          fontSize: 13.5,
          color: WIZARD_THEME.text2,
          lineHeight: 1.65,
          maxWidth: 370,
        }}
      >
        {desc}
      </p>

      <ul
        style={{
          marginTop: 26,
          display: "flex",
          flexDirection: "column",
          gap: 9,
          listStyle: "none",
          padding: 0,
        }}
      >
        {[
          "Agent tools - read, write, edit, search, run commands",
          "Persistent daemon with WebSocket streaming",
          "Full-screen TUI with session search & history",
        ].map((text) => (
          <li
            key={text}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              fontSize: 12.5,
              color: WIZARD_THEME.text2,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: WIZARD_THEME.primary,
                flexShrink: 0,
                boxShadow: `0 0 5px ${WIZARD_THEME.primary}`,
              }}
            />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
