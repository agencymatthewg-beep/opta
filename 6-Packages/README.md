# packages

## Quick Context
- 6-Packages: documentation and resources
- Contains: guides, examples, and reference materials
- Use for: implementation and troubleshooting


Shared npm packages and utilities across the Opta ecosystem. These are reusable components and configurations.

## Contents
- **ui/** - Shared React UI components and design system
- **api/** - Shared API utilities and middleware
- **tsconfig/** - TypeScript configuration presets
- **eslint-config/** - ESLint configuration presets

## Usage
These packages are published to npm or can be installed locally. Reference them in your app's package.json:
```json
{
  "dependencies": {
    "@opta/ui": "workspace:*",
    "@opta/api": "workspace:*"
  }
}
```
