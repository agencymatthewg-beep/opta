# Opta Project Structure Guide

This document outlines the purpose, contents, tech stack, users, key files, and dependencies for each folder within the reorganized Opta project.

---

## `/Opta/` (Root Directory)

This is the top-level directory for the entire Opta project. It serves as the central repository for all applications, shared components, research, and project configurations.

*   **Primary Purpose:** Contains the complete Opta ecosystem.
*   **Contents:** All sub-projects, applications, shared libraries, and documentation.
*   **Tech Stack:** N/A (orchestrates multiple tech stacks).
*   **Users:** All developers, AI agents, project managers.
*   **Key Files/Subdirectories:** `.gitignore`, `README.md`, `1. Apps/`, `2. Gemini Deep Research/`, `3. Matthew x Opta/`.
*   **Dependencies:** N/A (all other folders are contained within it).

---

## `1. Apps/`

This directory consolidates all user-facing applications developed under the Opta umbrella, categorized by platform (iOS, Desktop, Web) and includes shared components.

*   **Primary Purpose:** Houses all the distinct applications (mobile, desktop, web) that are part of the Opta product suite.
*   **Contents:** Platform-specific application projects and shared code/assets.
*   **Tech Stack:** Varies by sub-directory (Swift, Kotlin, JavaScript frameworks, C++, etc.).
*   **Users:** Application developers, end-users (via deployed apps), CI/CD systems, AI agents.
*   **Key Files/Subdirectories:** `1. iOS/`, `2. Desktop/`, `3. Web/`, `4. Shared/`.
*   **Dependencies:** Depends on `4. Shared/` for common libraries and design assets.

### `1. iOS/`

Contains all iOS-specific application projects.

*   **Primary Purpose:** Development and management of Opta applications for Apple's iOS platform.
*   **Contents:** Xcode projects, Swift/Objective-C source code, assets specific to iOS apps.
*   **Tech Stack:** Swift, Objective-C, Xcode, UIKit/SwiftUI.
*   **Users:** iOS developers, QA testers, end-users (on iOS devices).
*   **Key Files/Subdirectories:** `1. Opta/`, `2. Opta Scan/`, `3. Opta LM iOS/`.
*   **Dependencies:**
    *   Relies on `4. Shared/opta-native/` for any shared native logic.
    *   Relies on `4. Shared/design-assets/` for UI/UX elements.

#### `1. Opta/`

The main Opta application for iOS.

*   **Primary Purpose:** Core Opta functionality delivered on iOS.
*   **Contents:** Source code, assets, project files for the primary iOS app.
*   **Tech Stack:** Swift, Xcode, UIKit/SwiftUI.
*   **Users:** iOS developers, end-users.
*   **Key Files/Subdirectories:** `Info.plist`, `AppDelegate.swift`, `ContentView.swift` (or similar main view), `.xcodeproj` files.
*   **Dependencies:** `4. Shared/opta-native/`, `4. Shared/design-assets/`.

#### `2. Opta Scan/`

The Opta Scan application for iOS, likely focused on scanning capabilities.

*   **Primary Purpose:** Provides scanning functionalities on the iOS platform.
*   **Contents:** Source code, assets, project files for the iOS scanning app.
*   **Tech Stack:** Swift, Xcode, Vision framework (Apple), CoreML (potential).
*   **Users:** iOS developers, end-users requiring scanning features.
*   **Key Files/Subdirectories:** Similar to `1. Opta/` but focused on scanning features.
*   **Dependencies:** `4. Shared/opta-native/`, `4. Shared/design-assets/`.

#### `3. Opta LM iOS/`

The Opta Life Manager application specifically for iOS.

*   **Primary Purpose:** Delivers the Opta Life Manager experience on iOS.
*   **Contents:** Source code, assets, project files for the iOS Life Manager app.
*   **Tech Stack:** Swift, Xcode.
*   **Users:** iOS developers, end-users managing life-related aspects.
*   **Key Files/Subdirectories:** Similar to `1. Opta/` but focused on life management features.
*   **Dependencies:** `4. Shared/opta-native/`, `4. Shared/design-assets/`.

### `2. Desktop/`

Contains all desktop-specific application projects.

*   **Primary Purpose:** Development and management of Opta applications for desktop operating systems (e.g., macOS, Windows, Linux).
*   **Contents:** Source code, assets, and project files for desktop applications.
*   **Tech Stack:** Varies (e.g., Electron, C++/Qt, Swift/Objective-C for macOS native, C#/WPF for Windows native).
*   **Users:** Desktop application developers, QA testers, end-users (on desktop devices).
*   **Key Files/Subdirectories:** `1. Opta Native/`, `2. Opta Mini/`.
*   **Dependencies:**
    *   Relies on `4. Shared/opta-native/` for shared native logic.
    *   Relies on `4. Shared/design-assets/` for UI/UX elements.

#### `1. Opta Native/`

The main Opta application for desktop, likely built with native technologies or a cross-platform native wrapper.

*   **Primary Purpose:** Core Opta functionality delivered on desktop platforms.
*   **Contents:** Source code, assets, project files for the primary desktop app.
*   **Tech Stack:** Could be C++/Qt, Electron (Node.js, React/Vue/Angular), Tauri (Rust, web technologies), Swift/Objective-C (macOS specific), C#/WPF (Windows specific).
*   **Users:** Desktop developers, end-users.
*   **Key Files/Subdirectories:** `main.js` (Electron), `Cargo.toml` (Tauri/Rust), project solution files (`.sln`, `.xcodeproj`).
*   **Dependencies:** `4. Shared/opta-native/`, `4. Shared/design-assets/`.

#### `2. Opta Mini/`

A lightweight or mini version of an Opta application for desktop.

*   **Primary Purpose:** A smaller, possibly simplified or utility-focused desktop application.
*   **Contents:** Source code, assets, project files for the mini desktop app.
*   **Tech Stack:** Similar to `1. Opta Native/` but potentially optimized for smaller footprint.
*   **Users:** Desktop developers, end-users with specific, lighter use cases.
*   **Key Files/Subdirectories:** Similar to `1. Opta Native/`.
*   **Dependencies:** `4. Shared/opta-native/`, `4. Shared/design-assets/`.

### `3. Web/`

Contains all web-specific application projects.

*   **Primary Purpose:** Development and management of Opta web applications and websites.
*   **Contents:** Frontend and potentially backend code for web-based services.
*   **Tech Stack:** JavaScript (React, Angular, Vue), TypeScript, Node.js, HTML, CSS, various web frameworks.
*   **Users:** Web developers, end-users (via web browsers), CI/CD systems, AI agents.
*   **Key Files/Subdirectories:** `1. Opta Life Manager/`, `2. Opta LM Edge/`, `3. Optamize Website/`.
*   **Dependencies:**
    *   Relies on `4. Shared/design-assets/` for UI/UX elements.
    *   Potentially uses shared API services from other backend projects (if any, not explicitly listed here).

#### `1. Opta Life Manager/`

The web application for Opta Life Manager.

*   **Primary Purpose:** Provides the full Opta Life Manager experience through a web browser.
*   **Contents:** Frontend source code (React, Vue, Angular), potentially Node.js backend code.
*   **Tech Stack:** React/Next.js, Vue/Nuxt.js, Angular, Node.js/Express, TypeScript, JavaScript, HTML, CSS.
*   **Users:** Web developers, end-users.
*   **Key Files/Subdirectories:** `package.json`, `tsconfig.json`, `src/`, `public/`.
*   **Dependencies:** `4. Shared/design-assets/`.

#### `2. Opta LM Edge/`

Likely an edge-deployed component of the Opta Life Manager, possibly for performance or specific regional deployments.

*   **Primary Purpose:** Enhances the Opta Life Manager with edge computing capabilities, such as serverless functions, CDN configurations, or localized content delivery.
*   **Contents:** Serverless function code, edge configuration files, static assets for edge delivery.
*   **Tech Stack:** JavaScript/TypeScript (Cloudflare Workers, AWS Lambda@Edge, Vercel Edge Functions), static site generators.
*   **Users:** Web developers, DevOps engineers.
*   **Key Files/Subdirectories:** `wrangler.toml` (Cloudflare), `serverless.yml` (AWS).
*   **Dependencies:** `1. Opta Life Manager/` (for deployed assets), `4. Shared/design-assets/`.

#### `3. Optamize Website/`

The main public-facing website for Optamize, possibly a marketing or informational site.

*   **Primary Purpose:** Marketing, information dissemination, and user acquisition for Optamize.
*   **Contents:** Static pages, blog content, marketing assets, potentially a CMS integration.
*   **Tech Stack:** HTML, CSS, JavaScript, potentially a static site generator (e.g., Next.js, Gatsby, Jekyll), or a CMS integration.
*   **Users:** Marketing team, web developers, end-users browsing for information.
*   **Key Files/Subdirectories:** `index.html`, `about.html`, `blog/`, `assets/`, `package.json` (if built with a framework).
*   **Dependencies:** `4. Shared/design-assets/`.

### `4. Shared/`

Contains reusable components and assets that are common across multiple applications.

*   **Primary Purpose:** To promote code reuse, consistency, and maintainability across different Opta applications.
*   **Contents:** Common libraries, utility functions, UI component libraries, design system assets.
*   **Tech Stack:** Varies (e.g., C++/Rust for native, JavaScript/TypeScript for web, design tools for assets).
*   **Users:** All application developers.
*   **Key Files/Subdirectories:** `1. opta-native/`, `2. design-assets/`.
*   **Dependencies:** N/A (serves as a dependency for other `Apps/` subdirectories).

#### `1. opta-native/`

Shared native code or libraries used by iOS and Desktop applications.

*   **Primary Purpose:** Provides core logic, algorithms, or system integrations that need to be implemented natively and shared across platforms.
*   **Contents:** C/C++/Rust source code, platform-specific bridge code, native library definitions.
*   **Tech Stack:** C, C++, Rust, Swift (for Objective-C bridging), Kotlin (for JNI bridging), CMake, Makefiles, Cargo.
*   **Users:** iOS developers, Desktop developers.
*   **Key Files/Subdirectories:** `.h` files, `.cpp` files, `Cargo.toml`, build scripts.
*   **Dependencies:** N/A (consumed by iOS and Desktop apps).

#### `2. design-assets/`

Shared design system assets, including icons, fonts, and potentially UI components.

*   **Primary Purpose:** Ensures brand consistency and provides a single source of truth for all visual assets across all Opta applications.
*   **Contents:** SVG icons, font files (TTF, OTF, WOFF), image assets, design tokens (JSON/CSS variables), potentially a Storybook/design system documentation.
*   **Tech Stack:** Design tools (Figma, Sketch), SVG, PNG, Font formats, CSS/SCSS variables, JavaScript (for design system components).
*   **Users:** All application developers, UI/UX designers, AI agents (for generating compliant UI).
*   **Key Files/Subdirectories:** `icons/`, `fonts/`, `images/`, `tokens/` (or similar).
*   **Dependencies:** N/A (consumed by all application types).

---

## `2. Gemini Deep Research/`

This directory is dedicated to research, experimentation, and documentation related to Gemini AI and its application within Opta.

*   **Primary Purpose:** To conduct and document in-depth research into Gemini AI models, their capabilities, and potential integrations or applications within the Opta ecosystem.
*   **Contents:** Research papers, experimental code, notebooks, data sets, architectural proposals, and findings.
*   **Tech Stack:** Python (TensorFlow, PyTorch, Jupyter), R, Markdown, potentially specialized AI frameworks.
*   **Users:** AI researchers, data scientists, AI engineers, AI agents (for learning and contextual understanding).
*   **Key Files/Subdirectories:** `README.md`, research papers (PDF/Markdown), Jupyter notebooks (`.ipynb`), Python scripts (`.py`).
*   **Dependencies:** None explicit within this project structure, but research might depend on external AI libraries and data sources.

---

## `3. Matthew x Opta/`

This section is dedicated to personal configurations, project-specific settings, and AI agent configurations, primarily for Matthew's workflow within the Opta project.

*   **Primary Purpose:** To manage personal development environment configurations, project-wide settings, and the specific configurations for AI agents assisting Matthew.
*   **Contents:** Personal scripts, dotfiles, project configuration files, and AI agent setup.
*   **Tech Stack:** Shell scripting (Bash, Zsh), JSON, YAML, various configuration languages.
*   **Users:** Matthew (developer), CI/CD systems, AI agents.
*   **Key Files/Subdirectories:** `1. personal/`, `2. project/`, `3. agent-config/`.
*   **Dependencies:** Dependencies on this folder are internal to Matthew's workflow or AI agent operations.

### `1. personal/`

Matthew's personal development environment configurations and scripts.

*   **Primary Purpose:** Stores Matthew's individual developer setup, scripts, and preferences that are not shared with the broader team.
*   **Contents:** Dotfiles, custom shell scripts, aliases, editor configurations.
*   **Tech Stack:** Bash, Zsh, fish, various text editor configuration languages (e.g., `.vimrc`, `settings.json` for VS Code).
*   **Users:** Matthew.
*   **Key Files/Subdirectories:** `.bashrc`, `.zshrc`, `.gitconfig`, custom scripts.
*   **Dependencies:** None internal; external tools depend on these configurations.

### `2. project/`

Project-wide configurations and scripts that might be specific to Matthew's project role or environment.

*   **Primary Purpose:** Contains project-specific build scripts, deployment settings, or configuration files that are relevant to Matthew's interaction with the overall Opta project.
*   **Contents:** Build scripts, deployment manifests, environment variables, task automation scripts.
*   **Tech Stack:** Shell scripting, Python, Makefiles, Dockerfiles, YAML, JSON.
*   **Users:** Matthew, potentially CI/CD pipelines if integrated.
*   **Key Files/Subdirectories:** `build.sh`, `deploy.yml`, `config.json`.
*   **Dependencies:** May impact other `Apps/` folders during local development or deployment.

### `3. agent-config/`

Configuration files specifically for AI agents (like this one) operating within the Opta project.

*   **Primary Purpose:** Defines the operational parameters, access credentials, specific instructions, or contextual data for AI agents assisting with the Opta project.
*   **Contents:** JSON or YAML configuration files, prompt templates, tool definitions, agent specific knowledge bases.
*   **Tech Stack:** JSON, YAML, Markdown (for prompts/instructions).
*   **Users:** AI agents, Matthew (for managing agent configurations).
*   **Key Files/Subdirectories:** `agent_settings.json`, `tool_definitions.yml`, `prompt_templates/`.
*   **Dependencies:** Directly consumed by AI agents for their operation within the project.

---

**Generated by:** Gemini AI via /gu command
**Date:** 2026-01-28
**Purpose:** Comprehensive reference for the proposed Opta folder reorganization
