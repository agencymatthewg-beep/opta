"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Callout } from "@/components/docs/Callout";
import { StepList } from "@/components/docs/StepList";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "config-commands", title: "Config Commands", level: 2 as const },
  { id: "config-list", title: "Listing Config", level: 3 as const },
  { id: "config-get-set", title: "Get and Set", level: 3 as const },
  { id: "config-menu", title: "TUI Settings Menu", level: 3 as const },
  { id: "config-file", title: "Config File Location", level: 2 as const },
  { id: "environment-profiles", title: "Environment Profiles", level: 2 as const },
  { id: "key-settings", title: "Key Settings Reference", level: 2 as const },
];

export default function ConfigurationPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Configuration" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Configuration</h1>
          <p className="lead">
            Configure the Opta CLI with persistent settings, environment
            profiles, and a TUI settings menu. All configuration is stored in a
            single JSON file and can be managed via commands or edited directly.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            The Opta CLI stores its configuration in a JSON file at{" "}
            <code>~/.config/opta/config.json</code>. Settings control
            connection parameters, default model selection, provider fallback
            behavior, UI preferences, and more. You can manage configuration
            through three interfaces: CLI commands, the TUI settings menu, or
            direct file editing.
          </p>

          <h2 id="config-commands">Config Commands</h2>

          <h3 id="config-list">Listing Config</h3>
          <p>
            <code>opta config list</code> displays all current configuration
            values in a readable format. Settings are grouped by category.
          </p>

          <CommandBlock
            command="opta config list"
            output={`connection.host     192.168.188.11
connection.port     1234
model.default       qwen3-30b-a3b
provider.fallback   true
ui.theme            dark
ui.streaming        true`}
            description="List all configuration settings"
          />

          <h3 id="config-get-set">Get and Set</h3>
          <p>
            Use <code>opta config get</code> to read a single setting and{" "}
            <code>opta config set</code> to update one. Settings use dot
            notation for nested keys.
          </p>

          <CommandBlock
            command="opta config get connection.host"
            output="192.168.188.11"
            description="Read a single setting"
          />

          <CommandBlock
            command="opta config set connection.host 192.168.1.100"
            output="connection.host = 192.168.1.100"
            description="Update a setting"
          />

          <CommandBlock
            command="opta config set model.default deepseek-r1"
            output="model.default = deepseek-r1"
            description="Change default model"
          />

          <h3 id="config-menu">TUI Settings Menu</h3>
          <p>
            <code>opta config menu</code> opens an interactive terminal UI for
            browsing and modifying settings. This is the easiest way to explore
            available options and understand what each setting does.
          </p>

          <CommandBlock
            command="opta config menu"
            description="Open interactive settings TUI"
          />

          <CodeBlock
            code={`Opta Settings
━━━━━━━━━━━━━
> Connection
    Host: 192.168.188.11
    Port: 1234
  Model
    Default: qwen3-30b-a3b
    Fallback: Anthropic (enabled)
  UI
    Theme: dark
    Streaming: enabled

[Enter] Edit  [Tab] Next section  [q] Save & Quit`}
            filename="Settings TUI"
          />

          <h2 id="config-file">Config File Location</h2>
          <p>
            The configuration file lives at{" "}
            <code>~/.config/opta/config.json</code> and follows the XDG Base
            Directory specification. On Linux, it respects{" "}
            <code>$XDG_CONFIG_HOME</code> if set.
          </p>

          <CodeBlock
            language="json"
            code={`{
  "connection": {
    "host": "192.168.188.11",
    "port": 1234
  },
  "model": {
    "default": "qwen3-30b-a3b",
    "aliases": {
      "qwen": "mlx-community/Qwen3-30B-A3B-MLX-4bit",
      "deepseek": "mlx-community/DeepSeek-R1-0528-MLX-4bit"
    }
  },
  "provider": {
    "fallback": true,
    "anthropicKey": null
  },
  "ui": {
    "theme": "dark",
    "streaming": true
  }
}`}
            filename="~/.config/opta/config.json"
          />

          <Callout variant="info">
            The config file is created automatically on first run with sensible
            defaults. You can safely edit it by hand -- the CLI validates the
            schema on startup and reports any errors.
          </Callout>

          <h2 id="environment-profiles">Environment Profiles</h2>
          <p>
            Environment profiles let you save and switch between named
            configuration snapshots. This is useful when you work with different
            LMX servers, switch between local and cloud inference, or maintain
            separate configs for different projects.
          </p>

          <StepList
            steps={[
              {
                title: "Save the current config as a profile",
                content: (
                  <CommandBlock
                    command='opta env save home'
                    output="Profile 'home' saved."
                  />
                ),
              },
              {
                title: "Modify settings for a different environment",
                content: (
                  <CommandBlock
                    command="opta config set connection.host 10.0.0.50"
                  />
                ),
              },
              {
                title: "Save the new config as another profile",
                content: (
                  <CommandBlock
                    command='opta env save office'
                    output="Profile 'office' saved."
                  />
                ),
              },
              {
                title: "Switch between profiles",
                content: (
                  <CommandBlock
                    command="opta env use home"
                    output="Switched to profile 'home'.\nconnection.host = 192.168.188.11"
                  />
                ),
              },
            ]}
          />

          <CommandBlock
            command="opta env list"
            output={`Profiles:
  * home    (active)
    office`}
            description="List all environment profiles"
          />

          <Callout variant="tip" title="Quick switching">
            Profiles are stored alongside the main config file at{" "}
            <code>~/.config/opta/profiles/</code>. Switching profiles overwrites
            the active config, so always save your current settings before
            switching.
          </Callout>

          <h2 id="key-settings">Key Settings Reference</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Key</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Default</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">connection.host</td>
                  <td className="px-4 py-2.5 font-mono text-xs">192.168.188.11</td>
                  <td className="px-4 py-2.5">LMX server IP address</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">connection.port</td>
                  <td className="px-4 py-2.5 font-mono text-xs">1234</td>
                  <td className="px-4 py-2.5">LMX server port</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">model.default</td>
                  <td className="px-4 py-2.5 font-mono text-xs">qwen3-30b-a3b</td>
                  <td className="px-4 py-2.5">Model loaded at daemon startup</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">provider.fallback</td>
                  <td className="px-4 py-2.5 font-mono text-xs">true</td>
                  <td className="px-4 py-2.5">Fall back to Anthropic if LMX fails</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">provider.anthropicKey</td>
                  <td className="px-4 py-2.5 font-mono text-xs">null</td>
                  <td className="px-4 py-2.5">Anthropic API key for cloud fallback</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">ui.theme</td>
                  <td className="px-4 py-2.5 font-mono text-xs">dark</td>
                  <td className="px-4 py-2.5">CLI color theme</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">ui.streaming</td>
                  <td className="px-4 py-2.5 font-mono text-xs">true</td>
                  <td className="px-4 py-2.5">Enable token-by-token streaming output</td>
                </tr>
              </tbody>
            </table>
          </div>

          <PrevNextNav
            prev={{ title: "Sessions", href: "/docs/cli/sessions/" }}
            next={{ title: "Slash Commands", href: "/docs/cli/slash-commands/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
