import { lazy } from "react";

const isTestMode = import.meta.env.MODE === "test";

const TestSettingsView = ({
  selectedTab,
  isFullscreen,
}: {
  selectedTab?: string;
  isFullscreen?: boolean;
}) => (
  <div data-testid="settings-view-mock">
    <div>SettingsViewMock</div>
    <div>{`selectedTab:${selectedTab ?? "none"}`}</div>
    <div>{`fullscreen:${isFullscreen ? "1" : "0"}`}</div>
  </div>
);

const TestSettingsModal = ({
  isOpen,
  activeTab,
  isDeepLayer,
  isFullscreen,
}: {
  isOpen: boolean;
  activeTab?: string;
  isDeepLayer?: boolean;
  isFullscreen?: boolean;
}) =>
  isOpen ? (
    <div data-testid="settings-modal-mock">
      <div>SettingsModalMock</div>
      <div>{`activeTab:${activeTab ?? "none"}`}</div>
      <div>{`layer:${isDeepLayer ? "3" : "2"}`}</div>
      <div>{`fullscreen:${isFullscreen ? "1" : "0"}`}</div>
    </div>
  ) : null;

const loadSettingsModal = async () => ({
  default: isTestMode
    ? TestSettingsModal
    : (await import("./components/SettingsModal")).SettingsModal,
});

const loadSettingsView = async () => ({
  default: isTestMode
    ? TestSettingsView
    : (await import("./components/SettingsView")).SettingsView,
});

const loadSetupWizard = async () => ({
  default: (await import("./components/SetupWizard")).SetupWizard,
});

const loadPermissionModal = async () => ({
  default: (await import("./components/PermissionModal")).PermissionModal,
});

const loadLiveBrowserView = async () => ({
  default: (await import("./components/LiveBrowserView")).LiveBrowserView,
});

const loadLiveStudio = async () => ({
  default: (await import("./components/LiveStudio")).LiveStudio,
});

const loadBrowserStudio = async () => ({
  default: (await import("./components/BrowserStudio")).BrowserStudio,
});

const loadModelsStudio = async () => ({
  default: (await import("./components/ModelsStudio")).ModelsStudio,
});

const loadAtpoStudio = async () => ({
  default: (await import("./components/AtpoStudio")).AtpoStudio,
});

const loadProjectsStudio = async () => ({
  default: (await import("./components/ProjectsStudio")).ProjectsStudio,
});

export const preloadSettingsModal = async () => {
  await loadSettingsModal();
};

export const preloadSettingsView = async () => {
  await loadSettingsView();
};

export const LazySettingsModal = lazy(loadSettingsModal);
export const LazySettingsView = lazy(loadSettingsView);
export const LazySetupWizard = lazy(loadSetupWizard);
export const LazyPermissionModal = lazy(loadPermissionModal);
export const LazyLiveBrowserView = lazy(loadLiveBrowserView);
export const LazyLiveStudio = lazy(loadLiveStudio);
export const LazyBrowserStudio = lazy(loadBrowserStudio);
export const LazyModelsStudio = lazy(loadModelsStudio);
export const LazyAtpoStudio = lazy(loadAtpoStudio);
export const LazyProjectsStudio = lazy(loadProjectsStudio);
