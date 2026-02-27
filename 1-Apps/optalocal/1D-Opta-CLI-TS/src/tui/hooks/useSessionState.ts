import { useState } from 'react';
import type { TuiMessage, WorkflowMode } from '../App.js';
import type { ConnectionState } from '../utils.js';
import type { SubAgentDisplayState } from '../../core/subagent-events.js';

export interface UseSessionStateReturn {
  messages: TuiMessage[];
  setMessages: React.Dispatch<React.SetStateAction<TuiMessage[]>>;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  workflowMode: WorkflowMode;
  setWorkflowMode: React.Dispatch<React.SetStateAction<WorkflowMode>>;
  bypassPermissions: boolean;
  setBypassPermissions: React.Dispatch<React.SetStateAction<boolean>>;
  liveActivity: import('../App.js').TurnActivityItem[];
  setLiveActivity: React.Dispatch<React.SetStateAction<import('../App.js').TurnActivityItem[]>>;
  liveStreamingText: string;
  setLiveStreamingText: React.Dispatch<React.SetStateAction<string>>;
  liveThinkingText: string;
  setLiveThinkingText: React.Dispatch<React.SetStateAction<string>>;
  currentModel: string;
  setCurrentModel: (v: string) => void;
  tokens: number;
  setTokens: React.Dispatch<React.SetStateAction<number>>;
  promptTokens: number;
  setPromptTokens: React.Dispatch<React.SetStateAction<number>>;
  completionTokens: number;
  setCompletionTokens: React.Dispatch<React.SetStateAction<number>>;
  toolCallCount: number;
  setToolCallCount: React.Dispatch<React.SetStateAction<number>>;
  elapsed: number;
  setElapsed: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  cost: string;
  setCost: (v: string) => void;
  sessionTitle: string | undefined;
  setSessionTitle: (v: string | undefined) => void;
  modelLoaded: boolean;
  setModelLoaded: (v: boolean) => void;
  turnPhase: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done';
  setTurnPhase: (v: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done') => void;
  connectionState: ConnectionState;
  setConnectionState: (v: ConnectionState) => void;
  turnElapsed: number;
  setTurnElapsed: (v: number) => void;
  firstTokenLatency: number | null;
  setFirstTokenLatency: (v: number | null) => void;
  turnSpeed: number;
  setTurnSpeed: (v: number) => void;
  turnCompletionTokens: number;
  setTurnCompletionTokens: (v: number) => void;
  contextLimit: number;
  setContextLimit: (v: number) => void;
  registeredToolCount: number;
  setRegisteredToolCount: (v: number) => void;
  autonomyLevel: number;
  setAutonomyLevel: (v: number) => void;
  autonomyMode: 'execution' | 'ceo';
  setAutonomyMode: (v: 'execution' | 'ceo') => void;
  activeAgents: SubAgentDisplayState[];
  setActiveAgents: React.Dispatch<React.SetStateAction<SubAgentDisplayState[]>>;
}

export function useSessionState(
  initialMessages: TuiMessage[],
  initialModel: string,
  initialModelLoaded: boolean,
  initialTitle: string | undefined,
): UseSessionStateReturn {
  const [messages, setMessages] = useState<TuiMessage[]>(() => initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('normal');
  const [bypassPermissions, setBypassPermissions] = useState(false);
  const [liveActivity, setLiveActivity] = useState<import('../App.js').TurnActivityItem[]>([]);
  const [liveStreamingText, setLiveStreamingText] = useState('');
  const [liveThinkingText, setLiveThinkingText] = useState('');
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [tokens, setTokens] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [toolCallCount, setToolCallCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [cost, setCost] = useState('$0.00');
  const [sessionTitle, setSessionTitle] = useState<string | undefined>(initialTitle);
  const [modelLoaded, setModelLoaded] = useState(initialModelLoaded);
  const [turnPhase, setTurnPhase] = useState<'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done'>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [turnElapsed, setTurnElapsed] = useState(0);
  const [firstTokenLatency, setFirstTokenLatency] = useState<number | null>(null);
  const [turnSpeed, setTurnSpeed] = useState(0);
  const [turnCompletionTokens, setTurnCompletionTokens] = useState(0);
  const [contextLimit, setContextLimit] = useState(196608);
  const [registeredToolCount, setRegisteredToolCount] = useState(8);
  const [autonomyLevel, setAutonomyLevel] = useState(2);
  const [autonomyMode, setAutonomyMode] = useState<'execution' | 'ceo'>('execution');
  const [activeAgents, setActiveAgents] = useState<SubAgentDisplayState[]>([]);

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    workflowMode,
    setWorkflowMode,
    bypassPermissions,
    setBypassPermissions,
    liveActivity,
    setLiveActivity,
    liveStreamingText,
    setLiveStreamingText,
    liveThinkingText,
    setLiveThinkingText,
    currentModel,
    setCurrentModel,
    tokens,
    setTokens,
    promptTokens,
    setPromptTokens,
    completionTokens,
    setCompletionTokens,
    toolCallCount,
    setToolCallCount,
    elapsed,
    setElapsed,
    speed,
    setSpeed,
    cost,
    setCost,
    sessionTitle,
    setSessionTitle,
    modelLoaded,
    setModelLoaded,
    turnPhase,
    setTurnPhase,
    connectionState,
    setConnectionState,
    turnElapsed,
    setTurnElapsed,
    firstTokenLatency,
    setFirstTokenLatency,
    turnSpeed,
    setTurnSpeed,
    turnCompletionTokens,
    setTurnCompletionTokens,
    contextLimit,
    setContextLimit,
    registeredToolCount,
    setRegisteredToolCount,
    autonomyLevel,
    setAutonomyLevel,
    autonomyMode,
    setAutonomyMode,
    activeAgents,
    setActiveAgents,
  };
}
