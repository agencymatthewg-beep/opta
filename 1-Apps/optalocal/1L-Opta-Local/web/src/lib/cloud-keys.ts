import { createClient } from '@/lib/supabase/client';

export type CloudApiKey = {
  id: string;
  provider: string;
  label: string | null;
  key_value: string;
  is_active: boolean;
  updated_at: string;
};

export async function fetchCloudKeys(provider?: string): Promise<CloudApiKey[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from('api_keys')
    .select('id,provider,label,key_value,is_active,updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (provider) query = query.eq('provider', provider.toLowerCase());

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CloudApiKey[];
}
