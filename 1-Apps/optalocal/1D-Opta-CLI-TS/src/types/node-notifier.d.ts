declare module 'node-notifier' {
  interface NotificationOptions {
    title?: string;
    message?: string;
    sound?: boolean | string;
    wait?: boolean;
    timeout?: number | false;
    subtitle?: string;
    icon?: string;
    contentImage?: string;
    open?: string;
    closeLabel?: string;
    actions?: string[];
    dropdownLabel?: string;
    reply?: boolean;
  }

  interface Notifier {
    notify(options: NotificationOptions | string, callback?: (error: Error | null) => void): void;
  }

  const notifier: Notifier;
  export default notifier;
}
