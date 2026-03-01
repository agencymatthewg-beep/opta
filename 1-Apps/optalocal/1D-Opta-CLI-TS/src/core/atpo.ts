import type { OptaConfig } from './config.js';
import type { AgentMessage } from './agent.js';
import { getOrCreateClient } from './agent-setup.js';
import OpenAI from 'openai';
import { errorMessage } from '../utils/errors.js';

export interface AtpoState {
  status: 'offline' | 'standby' | 'active' | 'intervening';
  message?: string;
  provider?: 'anthropic' | 'gemini' | 'openai' | 'opencode_zen' | 'local';
}

export interface AtpoSupervisorOptions {
  config: OptaConfig;
  emitState?: (state: AtpoState) => void;
  emitLog?: (msg: string) => void;
}

export class AtpoSupervisor {
  private config: OptaConfig;
  private emitState?: (state: AtpoState) => void;
  private emitLog?: (msg: string) => void;
  
  private consecutiveErrors = 0;
  private toolCallCounter = 0;
  private isIntervening = false;
  private sessionCost = 0; // Simulated cost tracking

  constructor(options: AtpoSupervisorOptions) {
    this.config = options.config;
    this.emitState = options.emitState;
    this.emitLog = options.emitLog;

    if (this.config.atpo.enabled) {
      this.setStatus('standby', undefined);
    } else {
      this.setStatus('offline');
    }
  }

  public get isEnabled(): boolean {
    if (!this.config.atpo.enabled) return false;
    
    // Check usage limits
    const limit = this.config.atpo.limits.autoPauseThreshold;
    if (limit > 0 && this.sessionCost >= limit) {
      // If failover is enabled, we keep running (but getAtpoClient will handle the switch)
      if (!this.config.atpo.limits.providerFailover) {
        this.emitLog?.(`[Atpo] Auto-paused: Session usage (${this.sessionCost}) reached limit (${limit})`);
        return false;
      }
    }
    return true;
  }

  private setStatus(status: AtpoState['status'], message?: string) {
    if (!this.emitState) return;
    const provider = this.config.atpo.provider === 'auto' ? 'local' : this.config.atpo.provider;
    this.emitState({ status, message, provider });
  }

  public onToolStart() {
    this.toolCallCounter++;
  }

  public onToolError() {
    this.consecutiveErrors++;
  }

  public onToolSuccess() {
    this.consecutiveErrors = 0;
  }

  private async getAtpoClient(): Promise<{ client: OpenAI; model: string; providerName: AtpoState['provider'] }> {
    let provider = this.config.atpo.provider;
    let apiKey = this.config.atpo.apiKey?.trim();
    let model = this.config.atpo.model?.trim();

    // Usage limits failover logic
    const limit = this.config.atpo.limits.autoPauseThreshold;
    if (limit > 0 && this.sessionCost >= limit && this.config.atpo.limits.providerFailover) {
      this.emitLog?.(`[Atpo] Usage limit reached. Failing over to secondary provider/model.`);
      // Default failover behavior: switch to local
      provider = 'local' as any;
      apiKey = ''; // Ignore key for local
      model = this.config.atpo.limits.failoverModel || this.config.model.default;
    }

    // Smart Key Detection
    if (provider === 'auto' && apiKey) {
      if (apiKey.startsWith('sk-ant-')) provider = 'anthropic';
      else if (apiKey.startsWith('AIza')) provider = 'gemini';
      else if (apiKey.startsWith('oz-')) provider = 'opencode_zen';
      else if (apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-')) provider = 'openai';
    }

    if (!apiKey || provider === 'auto' || provider === 'local' as any) {
      // Fallback to primary Opta client
      const client = await getOrCreateClient(this.config);
      return { 
        client, 
        model: model || this.config.model.default,
        providerName: 'local'
      };
    }

    let baseURL: string | undefined;
    let defaultHeaders: Record<string, string> | undefined;

    switch (provider) {
      case 'anthropic':
        baseURL = 'https://api.anthropic.com/v1/';
        defaultHeaders = { 'anthropic-version': '2023-06-01' };
        model = model || 'claude-3-haiku-20240307';
        break;
      case 'gemini':
        baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
        model = model || 'gemini-1.5-flash';
        break;
      case 'opencode_zen':
        baseURL = 'https://api.opencodezen.com/v1/';
        model = model || 'zen-fast';
        break;
      case 'openai':
      default:
        baseURL = 'https://api.openai.com/v1/';
        model = model || 'gpt-4o-mini';
        break;
    }

    const client = new OpenAI({ baseURL, apiKey, defaultHeaders });
    return { client, model, providerName: provider as AtpoState['provider'] };
  }

  /**
   * Checks if Atpo should intervene in the current turn based on limits and thresholds.
   * Returns a boolean indicating if an intervention is required.
   */
  public async checkThresholds(_messages: AgentMessage[]): Promise<boolean> {
    if (!this.isEnabled || this.isIntervening) return false;

    const { errorCount, nToolsCount, milestoneFrequency } = this.config.atpo.thresholds;

    if (this.consecutiveErrors >= errorCount) {
      this.emitLog?.(`[Atpo] Triggered by consecutive errors (${this.consecutiveErrors})`);
      return true;
    }

    if (milestoneFrequency === 'n-tools' && this.toolCallCounter >= nToolsCount) {
      this.emitLog?.(`[Atpo] Triggered by tool call limit (${this.toolCallCounter})`);
      return true;
    }

    return false;
  }

  /**
   * Generates a review/intervention prompt based on the recent context and injects it.
   */
  public async intervene(messages: AgentMessage[]): Promise<AgentMessage | null> {
    if (!this.isEnabled) return null;
    
    this.isIntervening = true;
    
    try {
      const { client, model, providerName } = await this.getAtpoClient();
      this.setStatus('active', 'Reviewing context...');
      this.emitState?.({ status: 'active', message: 'Reviewing context...', provider: providerName });

      // Create a compacted context for the supervisor
      const recentMessages = messages.slice(-5); // Take last 5 turns for review
      
      this.setStatus('intervening', 'Debugging trajectory');
      this.emitState?.({ status: 'intervening', message: 'Debugging trajectory', provider: providerName });
      
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are Atpo, an autonomous supervisor. The following is a recent log from a local LLM agent trying to accomplish a task. Identify any loops, severe errors, or hallucinations. Provide a concise, single-paragraph correction wrapped in <atpo_correction> tags that the agent should read to get back on track.',
          },
          ...recentMessages.map(m => ({
            role: m.role === 'tool' ? 'user' : m.role, // Mapping tool to user for generic OpenAI API support
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          })) as OpenAI.ChatCompletionMessageParam[]
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      // Track rough simulated usage
      this.sessionCost += 0.01; 

      const correctionText = response.choices[0]?.message?.content || '';

      if (correctionText.includes('<atpo_correction>')) {
        this.emitLog?.(`[Atpo] Injected correction: ${correctionText}`);
        
        // Reset counters after intervention
        this.consecutiveErrors = 0;
        this.toolCallCounter = 0;
        
        return {
          role: 'user', // We inject this as a user message to guide the assistant
          content: correctionText
        };
      }
      
      return null;
    } catch (err) {
      this.emitLog?.(`[Atpo] Intervention failed: ${errorMessage(err)}`);
      return null;
    } finally {
      this.isIntervening = false;
      this.setStatus('standby');
    }
  }

  public endSession() {
    this.setStatus('offline');
  }
}
