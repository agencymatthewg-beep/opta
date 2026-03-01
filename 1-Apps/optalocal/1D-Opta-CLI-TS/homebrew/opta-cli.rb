# Homebrew formula for opta-cli
# Agentic AI coding CLI powered by local LLMs
#
# To install from a custom tap:
#   brew tap optaops/opta-cli https://github.com/optaops/homebrew-opta-cli
#   brew install opta-cli
#
# To update the sha256 after cutting a release:
#   Run: shasum -a 256 opta-cli-npm.tgz after creating the GitHub release

class OptaCli < Formula
  desc "Agentic AI coding CLI powered by local LLMs"
  homepage "https://github.com/optaops/opta-cli"
  url "https://github.com/optaops/opta-cli/releases/download/v0.5.0-alpha.1/opta-cli-0.5.0-alpha.1.tar.gz"
  sha256 "PLACEHOLDER_SHA256_REPLACE_AFTER_RELEASE"
  license "MIT"

  depends_on "node@20"

  def install
    # Install production npm dependencies into the libexec prefix.
    # libexec keeps the node_modules tree private to this formula
    # and avoids polluting the global Homebrew lib directory.
    system "npm", "install", "--production", "--ignore-scripts"

    # Copy the built dist/ tree and package.json into libexec
    libexec.install Dir["dist", "package.json", "node_modules"]

    # Create a wrapper script that invokes Node with the correct entry point.
    # Homebrew's write_exec_script does not support ESM flags, so we write
    # the wrapper manually to ensure --experimental-vm-modules is not needed
    # and the correct Node from the dependency is used.
    (bin/"opta").write <<~SH
      #!/bin/bash
      exec "#{Formula["node@20"].opt_bin}/node" "#{libexec}/dist/index.js" "$@"
    SH
  end

  def caveats
    <<~EOS
      opta-cli connects to your local Opta-LMX inference server by default
      (192.168.188.11:1234). To use a cloud provider as fallback, set:

        export ANTHROPIC_API_KEY="sk-ant-..."

      Configuration is stored in ~/.config/opta/config.json. Run:

        opta config list

      to see all available settings.

      To start the background daemon:

        opta daemon start
    EOS
  end

  test do
    # --version should print the semver string and exit 0
    assert_match version.to_s, shell_output("#{bin}/opta --version")
  end
end
