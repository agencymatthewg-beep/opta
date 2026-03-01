# Homebrew Formula for opta-cli

This directory contains the Homebrew formula for installing opta-cli via `brew`.

## Prerequisites

- macOS with Homebrew installed
- Node.js 20+ (installed automatically as a dependency)

## Setting Up the Tap

A Homebrew "tap" is a third-party repository of formulae. To add the opta-cli tap:

```bash
brew tap optaops/opta-cli https://github.com/optaops/homebrew-opta-cli
```

> **Note:** The tap repository (`homebrew-opta-cli`) must contain this formula at
> `Formula/opta-cli.rb`. Copy `opta-cli.rb` from this directory into that repo.

## Installing

```bash
brew install opta-cli
```

This installs the `opta` binary, Node.js 20, and all production dependencies.

## Updating

```bash
brew update
brew upgrade opta-cli
```

## Uninstalling

```bash
brew uninstall opta-cli
```

## Verifying the Installation

```bash
opta --version
opta --help
```

## Post-Install Configuration

opta-cli connects to your local Opta-LMX inference server by default. To configure
a cloud fallback provider:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

View all settings:

```bash
opta config list
```

Start the background daemon:

```bash
opta daemon start
```

## Releasing a New Version

When cutting a new release, update the formula as follows:

1. **Build the tarball** from a clean checkout:

   ```bash
   npm ci
   npm run build
   cd .. && tar czf opta-cli-X.Y.Z.tar.gz \
     --exclude='node_modules' \
     --exclude='.git' \
     --exclude='src' \
     --exclude='tests' \
     --exclude='homebrew' \
     1D-Opta-CLI-TS/dist \
     1D-Opta-CLI-TS/package.json \
     1D-Opta-CLI-TS/package-lock.json \
     1D-Opta-CLI-TS/README.md
   ```

2. **Upload** the tarball to the GitHub release (tag `vX.Y.Z`).

3. **Compute the SHA-256**:

   ```bash
   shasum -a 256 opta-cli-X.Y.Z.tar.gz
   ```

4. **Update the formula** (`opta-cli.rb`):
   - Set `url` to the new release tarball URL
   - Set `sha256` to the computed hash
   - Bump the version if it is not inferred from the URL

5. **Push** the updated formula to the `homebrew-opta-cli` tap repository.

6. **Test** the install:

   ```bash
   brew update
   brew upgrade opta-cli
   opta --version
   ```

## Local Development Testing

You can test the formula locally without publishing:

```bash
brew install --build-from-source ./homebrew/opta-cli.rb
```

Or use `brew audit` to check for style issues:

```bash
brew audit --strict --new-formula ./homebrew/opta-cli.rb
```
