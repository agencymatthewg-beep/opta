# Opta Ecosystem Relationships

This document outlines the architecture and user flows of the **Opta** business, with a specific focus on the **Opta Local** sub-ecosystem and how it interacts with supporting management websites.

## Business Hierarchy

*   **Opta / Opta AI (Opta Operations):** The top-level business encompassing all products. This includes broader optimizing applications (e.g., Life Manager).
*   **Opta Local:** A dedicated sub-ecosystem of Opta focused entirely on applications that help a user run and use Local Large Language Models (LLMs).

---

## 1. Opta Local: Main Local Apps
These are the core applications within the Opta Local sub-ecosystem. They are the primary tools that users run on their machines to interact with local LLMs.

*   **Opta LMX (1M-Opta-LMX)**
    *   **Role:** The core local inference engine.
    *   **Relationships:** The backend brain for Opta CLI, Opta Local, and Opta Code Desktop. Serves the local API and manages model resources.

*   **Opta Local (1L-Opta-Local)**
    *   **Role:** The local web-based management dashboard for Opta LMX.
    *   **Relationships:** Provides a graphical control plane directly over the Opta LMX engine, allowing users to configure and monitor models visually.

*   **Opta CLI (1D-Opta-CLI-TS)**
    *   **Role:** The terminal-native command-line interface.
    *   **Relationships:** Communicates with Opta LMX for executing commands, checking status, and managing local deployments directly from the terminal.

*   **Opta Code Desktop (1P-Opta-Code-Desktop)**
    *   **Role:** A desktop application designed for AI-assisted coding.
    *   **Relationships:** Consumes Opta LMX's local API for deep integration with codebases without sending data externally.

---

## 2. Opta Management Websites
These web properties and services exist solely to assist, distribute, and manage the main Opta Local apps and the broader Opta ecosystem.

*   **Opta Accounts (1R-Opta-Accounts)**
    *   **Role:** Authentication, identity, and licensing.
    *   **Relationships:** Syncs user accounts, manages premium features, and provides authenticated states to the Opta Local apps (like Opta Local dashboard and Opta CLI).

*   **Opta Status (1S-Opta-Status)**
    *   **Role:** System health monitoring.
    *   **Relationships:** Provides uptime and incident reporting for the management websites and external API services.

*   **Opta Home (1T-Opta-Home / optalocal.com)**
    *   **Role:** The main marketing and distribution site for Opta Local.
    *   **Relationships:** Routes traffic to specific apps, downloads, and documentation.

*   **Opta Help (1U-Opta-Help / help.optalocal.com)**
    *   **Role:** Technical reference documentation hub.
    *   **Relationships:** Referenced directly by the CLI and Web apps for detailed guides, setup instructions, and troubleshooting.

*   **Opta Learn (1V-Opta-Learn)**
    *   **Role:** Tutorial and discovery portal.
    *   **Relationships:** Bridges the marketing site (Opta Home) and technical docs (Opta Help) with approachable, visual guides.

*   **Opta Init (1O-Opta-Init)**
    *   **Role:** The onboarding and setup bootstrap experience.
    *   **Relationships:** A web-guided installer that ensures Opta LMX, Opta CLI, and the local environment are correctly bootstrapped on the user's machine.

---

## Example User Flow (Opta Local)

1.  A user discovers the local LLM platform via the **Opta Home** management website (`optalocal.com`).
2.  They create an identity via **Opta Accounts** and begin the guided installation from **Opta Init**.
3.  **Opta Init** bootstraps the core apps: **Opta LMX** (the engine) and **Opta CLI** (the terminal tool) onto their local machine.
4.  The user configures and manages their models visually using the **Opta Local** management dashboard.
5.  Finally, they write code using **Opta Code Desktop**, entirely powered by the local **Opta LMX** backend, referencing the **Opta Help** website when needed.
