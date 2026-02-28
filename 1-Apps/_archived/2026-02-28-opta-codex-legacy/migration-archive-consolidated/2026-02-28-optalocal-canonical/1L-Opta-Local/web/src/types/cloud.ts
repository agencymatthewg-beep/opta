export type DeviceRole = 'llm_host' | 'workstation';

export interface Device {
  id: string;
  user_id: string;
  name: string;
  role: DeviceRole;
  hostname: string | null;
  lan_ip: string | null;
  lan_port: number;
  helper_enabled: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  is_online: boolean;
}

export interface CloudSession {
  id: string;
  user_id: string;
  device_id: string | null;
  title: string;
  model: string;
  messages: unknown[];
  created_at: string;
  updated_at: string;
}
