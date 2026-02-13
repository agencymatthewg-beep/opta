import type { ModelInfo } from './base.js';
import { LMStudioProvider } from './lmstudio.js';
import { debug } from '../core/debug.js';
import { OptaError, EXIT } from '../core/errors.js';

export interface ConnectionResult {
  provider: LMStudioProvider;
  models: ModelInfo[];
  defaultModel: string;
  contextLimit: number;
}

export async function connectToProvider(
  host: string,
  port: number
): Promise<ConnectionResult> {
  const provider = new LMStudioProvider(host, port);

  debug(`Connecting to LM Studio at ${host}:${port}`);

  if (!(await provider.isAvailable())) {
    throw new OptaError(
      `Cannot reach LM Studio at ${host}:${port}`,
      EXIT.NO_CONNECTION,
      [
        'Mac Studio (Mono512) is offline',
        'LM Studio is not running',
        `Firewall blocking port ${port}`,
      ],
      [
        `Check connectivity: ping ${host}`,
        'Start LM Studio on the Mac Studio',
        'Use a different host: opta connect --host <ip>',
      ]
    );
  }

  const models = await provider.listModels();

  if (models.length === 0) {
    throw new OptaError(
      'LM Studio is running but no models are loaded',
      EXIT.ERROR,
      ['No models loaded in LM Studio'],
      [
        'Open LM Studio and load a model',
        'Check the LM Studio model library',
      ]
    );
  }

  const defaultModel = models[0]!.id;
  const contextLimit = models[0]!.contextLength ?? 32_768;

  debug(`Default model: ${defaultModel} (context: ${contextLimit})`);

  return { provider, models, defaultModel, contextLimit };
}
