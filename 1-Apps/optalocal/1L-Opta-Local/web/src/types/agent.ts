/**
 * Opta Agent Workspace Types
 *
 * Data models for multi-step agent workflows. Agents chain
 * prompts across models with conditional logic and tool calls.
 */

// ---------------------------------------------------------------------------
// Step Types
// ---------------------------------------------------------------------------

/** Available step types in the pipeline editor */
export type StepType = 'prompt' | 'transform' | 'conditional' | 'output';

/** Base step configuration */
interface StepBase {
  id: string;
  type: StepType;
  label: string;
  /** Position in the pipeline (0-indexed) */
  position: number;
}

/** Prompt step — sends a prompt to a model */
export interface PromptStep extends StepBase {
  type: 'prompt';
  config: {
    model: string;
    systemPrompt: string;
    userPromptTemplate: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/** Transform step — manipulates the output (extract, format, etc.) */
export interface TransformStep extends StepBase {
  type: 'transform';
  config: {
    operation: 'extract_json' | 'summarize' | 'format' | 'regex' | 'split';
    pattern?: string;
    template?: string;
  };
}

/** Conditional step — branches based on content analysis */
export interface ConditionalStep extends StepBase {
  type: 'conditional';
  config: {
    condition: 'contains' | 'length_gt' | 'sentiment' | 'regex_match';
    value: string;
    trueBranch: string; // step ID to jump to
    falseBranch: string; // step ID to jump to
  };
}

/** Output step — final output formatting */
export interface OutputStep extends StepBase {
  type: 'output';
  config: {
    format: 'text' | 'markdown' | 'json' | 'email';
    destination: 'display' | 'clipboard' | 'download';
  };
}

export type PipelineStep = PromptStep | TransformStep | ConditionalStep | OutputStep;

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

/** Complete agent workflow definition */
export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** Status of a step during execution */
export type StepExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Execution result for a single step */
export interface StepExecution {
  stepId: string;
  status: StepExecutionStatus;
  input: string;
  output: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  tokensUsed?: number;
  durationMs?: number;
}

/** Complete execution run */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: StepExecution[];
  startedAt: string;
  completedAt?: string;
  initialInput: string;
  finalOutput?: string;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Pre-built workflow templates */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'writing' | 'coding' | 'analysis' | 'communication';
  steps: Omit<PipelineStep, 'id'>[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'research-summarize',
    name: 'Research & Summarize',
    description: 'Research a topic, extract key points, and create a summary',
    category: 'research',
    steps: [
      {
        type: 'prompt',
        label: 'Research',
        position: 0,
        config: {
          model: '',
          systemPrompt: 'You are a thorough researcher. Provide comprehensive information.',
          userPromptTemplate: 'Research the following topic thoroughly:\n\n{{input}}',
          temperature: 0.7,
        },
      },
      {
        type: 'prompt',
        label: 'Summarize',
        position: 1,
        config: {
          model: '',
          systemPrompt: 'You are a concise summarizer. Extract and organize key points.',
          userPromptTemplate: 'Summarize the following research into key bullet points:\n\n{{input}}',
          temperature: 0.3,
        },
      },
      {
        type: 'output',
        label: 'Final Summary',
        position: 2,
        config: { format: 'markdown', destination: 'display' },
      },
    ],
  },
  {
    id: 'code-review-fix',
    name: 'Code Review & Fix',
    description: 'Review code for bugs, then generate fixes',
    category: 'coding',
    steps: [
      {
        type: 'prompt',
        label: 'Review',
        position: 0,
        config: {
          model: '',
          systemPrompt: 'You are a senior code reviewer. Find bugs, security issues, and improvements.',
          userPromptTemplate: 'Review this code and list all issues:\n\n```\n{{input}}\n```',
          temperature: 0.2,
        },
      },
      {
        type: 'prompt',
        label: 'Fix',
        position: 1,
        config: {
          model: '',
          systemPrompt: 'You are a skilled developer. Fix the identified issues in the code.',
          userPromptTemplate: 'Based on these review findings, provide the corrected code:\n\n{{input}}',
          temperature: 0.1,
        },
      },
      {
        type: 'output',
        label: 'Fixed Code',
        position: 2,
        config: { format: 'markdown', destination: 'display' },
      },
    ],
  },
  {
    id: 'draft-email',
    name: 'Research → Draft Email',
    description: 'Research a topic and draft a professional email',
    category: 'communication',
    steps: [
      {
        type: 'prompt',
        label: 'Research',
        position: 0,
        config: {
          model: '',
          systemPrompt: 'Gather relevant context and talking points.',
          userPromptTemplate: 'Research context for the following email topic:\n\n{{input}}',
          temperature: 0.5,
        },
      },
      {
        type: 'prompt',
        label: 'Draft',
        position: 1,
        config: {
          model: '',
          systemPrompt: 'You are a professional email writer. Write clear, concise emails.',
          userPromptTemplate: 'Draft a professional email based on this research:\n\n{{input}}',
          temperature: 0.4,
        },
      },
      {
        type: 'output',
        label: 'Email Draft',
        position: 2,
        config: { format: 'text', destination: 'display' },
      },
    ],
  },
  {
    id: 'analyze-data',
    name: 'Analyze & Report',
    description: 'Analyze data/text and generate a structured report',
    category: 'analysis',
    steps: [
      {
        type: 'prompt',
        label: 'Analyze',
        position: 0,
        config: {
          model: '',
          systemPrompt: 'You are a data analyst. Identify patterns, trends, and insights.',
          userPromptTemplate: 'Analyze the following data/text:\n\n{{input}}',
          temperature: 0.3,
        },
      },
      {
        type: 'prompt',
        label: 'Report',
        position: 1,
        config: {
          model: '',
          systemPrompt: 'Create a well-structured report with sections, findings, and recommendations.',
          userPromptTemplate: 'Generate a structured report from this analysis:\n\n{{input}}',
          temperature: 0.4,
        },
      },
      {
        type: 'output',
        label: 'Final Report',
        position: 2,
        config: { format: 'markdown', destination: 'display' },
      },
    ],
  },
];
