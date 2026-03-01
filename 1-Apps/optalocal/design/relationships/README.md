# Opta Local Ecosystem Relationships

The Opta Local ecosystem is composed of several specialized applications that work together to deliver a seamless local AI experience. The architecture spans from the core inference engine to the overarching web presence.

## 1. Core Infrastructure Layer

*   **Opta LMX (1M-Opta-LMX)**
    *   **Role:** The core local inference engine.
    *   **Relationships:** Acts as the backend brain for Opta-CLI, Opta-Local, and Opta-Code-Desktop. It handles model loading, execution, and local API serving.

## 2. Interface Layer

*   **Opta CLI (1D-Opta-CLI-TS)**
    *   **Role:** The terminal-native command-line interface.
    *   **Relationships:** Communicates directly with Opta LMX to execute commands, check status, and manage local deployments. It is the primary developer tool.

*   **Opta Local (1L-Opta-Local)**
    *   **Role:** The local web-based control plane/dashboard.
    *   **Relationships:** Provides a graphical interface over Opta LMX.

*   **Opta Code Desktop (1P-Opta-Code-Desktop)**
    *   **Role:** A desktop application designed for AI-assisted coding.
    *   **Relationships:** Consumes Opta LMX's local API for deep integration with codebases without sending data externally.

## 3. Onboarding & Identity Layer

*   **Opta Init (1O-Opta-Init)**
    *   **Role:** The onboarding and setup experience.
    *   **Relationships:** Bootstraps the environment, ensuring Opta LMX and Opta CLI are correctly installed and configured on the user's machine.

*   **Opta Accounts (1R-Opta-Accounts)**
    *   **Role:** Authentication and identity management.
    *   **Relationships:** Handles user sync, premium features, and license verification. Connected to Opta Local and Opta CLI for authenticated states.

## 4. Discovery & Documentation Layer (Web Properties)

*   **Opta Home (1T-Opta-Home)** - The main marketing site (`optalocal.com`), routing traffic to relevant apps and docs.
*   **Opta Learn (1V-Opta-Learn)** - The discovery portal (`learn.optalocal.com`) for tutorials and guides.
*   **Opta Help (1U-Opta-Help)** - The technical documentation hub (`help.optalocal.com`) referenced by the CLI and Web apps for deep-dives.
*   **Opta Status (1S-Opta-Status)** - System health monitoring.

## Ecosystem User Flow Example

1.  A user discovers the platform via **Opta Home** and reads the guides on **Opta Learn**.
2.  They sign up via **Opta Accounts** and download the installer from **Opta Init**.
3.  **Opta Init** bootstraps **Opta LMX** (the engine) and **Opta CLI** (the tool) on their machine.
4.  The user configures their models using **Opta CLI** and monitors them via **Opta Local**.
5.  Finally, they write code using **Opta Code Desktop**, powered entirely by the local **Opta LMX** backend.
