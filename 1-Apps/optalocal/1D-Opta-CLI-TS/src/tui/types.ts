export type StartupNoticeSeverity = 'error' | 'warning';

export interface StartupConnectionNotice {
  severity: StartupNoticeSeverity;
  bullets: string[];
  attemptedEndpoints: string[];
}
