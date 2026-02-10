# Phase 6: Interactive Chat - Foundation Checklist

## Overview

**Project**: AICompare (Web)
**Phase**: 6 of 7
**Status**: Foundation Complete
**Estimated Complexity**: High
**Dependencies**: Phase 5 (AI Analysis)

### Objective
Build an interactive chat interface where users can ask questions about AI models, get personalized recommendations, and explore comparisons through natural conversation.

---

## Platform Impact Assessment

### Technology Stack
- **Streaming**: Vercel AI SDK (ai package)
- **Protocol**: Server-Sent Events (SSE)
- **State**: React hooks + URL state
- **Persistence**: Local storage (anonymous) + Database (authenticated)

### AI Provider
- Primary: OpenAI GPT-4o-mini (cost-effective, fast)
- Fallback: GPT-4 for complex queries
- Context: Model database embedded in system prompt

### Real-time Features
| Feature | Implementation |
|---------|----------------|
| Streaming responses | SSE via Vercel AI SDK |
| Typing indicators | Client-side animation |
| Message persistence | IndexedDB + server sync |
| Context retention | Conversation history in prompt |

---

## Architecture Impact

### New Components

```
src/lib/
├── chat/
│   ├── chat-engine.ts          # Chat orchestration
│   ├── context-builder.ts      # Build prompt context
│   ├── tools/                   # Function calling tools
│   │   ├── search-models.ts     # Search model database
│   │   ├── compare-models.ts    # Compare specific models
│   │   ├── calculate-cost.ts    # Cost calculations
│   │   └── get-recommendations.ts # AI recommendations
│   └── history/
│       ├── local-storage.ts     # Anonymous persistence
│       └── database.ts          # Authenticated persistence

src/app/
├── chat/
│   └── page.tsx                 # Chat interface
├── api/
│   └── chat/
│       ├── route.ts             # Main chat endpoint
│       └── history/route.ts     # History management

src/components/chat/
├── ChatInterface.tsx            # Main chat container
├── ChatMessage.tsx              # Individual message
├── ChatInput.tsx                # Input with suggestions
├── ChatSuggestions.tsx          # Quick action chips
├── ModelCard.tsx                # Inline model displays
└── StreamingText.tsx            # Streaming text renderer
```

### System Prompt Architecture

```typescript
const SYSTEM_PROMPT = `
You are an AI model expert assistant for AICompare. Your role is to help users:
- Find the best AI model for their use case
- Compare models based on capabilities, pricing, and benchmarks
- Estimate costs for their expected usage
- Explain technical concepts in simple terms

You have access to real-time data about AI models through function calls.

Guidelines:
- Be concise but thorough
- Always cite specific numbers (prices, benchmarks)
- Suggest follow-up questions
- If uncertain, ask clarifying questions

Current date: {date}
Models last updated: {lastUpdated}
`;
```

### Function Calling (Tools)

```typescript
const CHAT_TOOLS = [
  {
    name: 'search_models',
    description: 'Search for AI models by criteria',
    parameters: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Filter by provider' },
        capability: { type: 'string', description: 'Required capability' },
        maxPrice: { type: 'number', description: 'Max price per 1M tokens' },
      },
    },
  },
  {
    name: 'compare_models',
    description: 'Compare two or more models side by side',
    parameters: {
      type: 'object',
      properties: {
        modelIds: { type: 'array', items: { type: 'string' } },
        aspects: { type: 'array', items: { type: 'string' } },
      },
      required: ['modelIds'],
    },
  },
  {
    name: 'calculate_cost',
    description: 'Calculate estimated cost for usage',
    parameters: {
      type: 'object',
      properties: {
        modelId: { type: 'string' },
        inputTokens: { type: 'number' },
        outputTokens: { type: 'number' },
        period: { type: 'string', enum: ['daily', 'monthly', 'yearly'] },
      },
      required: ['modelId', 'inputTokens', 'outputTokens'],
    },
  },
];
```

### Conversation Flow

```
User: "What's the best model for code generation?"
        ↓
Chat Engine: Detect intent (recommendation)
        ↓
Tool Call: search_models({ capability: 'code' })
        ↓
Tool Result: [GPT-4, Claude 3.5, Codestral, ...]
        ↓
LLM: Generate response with model data
        ↓
User: Streaming response with recommendations
```

---

## Performance Analysis

### Latency Targets
| Metric | Target | Notes |
|--------|--------|-------|
| Time to first token | <500ms | SSE stream start |
| Tool execution | <200ms | Database query |
| Full response | <5s | Typical conversation |
| History load | <200ms | IndexedDB/API |

### Streaming Implementation

```typescript
// Using Vercel AI SDK
import { OpenAIStream, StreamingTextResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: buildMessages(messages),
    tools: CHAT_TOOLS,
    stream: true,
  });

  const stream = OpenAIStream(response, {
    onToolCall: async ({ toolCall }) => {
      return executeToolCall(toolCall);
    },
  });

  return new StreamingTextResponse(stream);
}
```

### Context Window Management
- Max conversation history: 20 messages
- Summarize older messages if exceeded
- Model data: ~2000 tokens in system prompt
- Reserve: 4000 tokens for response

---

## Security Considerations

### Input Sanitization
- [ ] Escape HTML in user messages
- [ ] Validate message length (<4000 chars)
- [ ] Rate limit message frequency
- [ ] Block common prompt injection patterns

### Authentication
- [ ] Anonymous chat (limited history)
- [ ] Authenticated chat (persistent history)
- [ ] Admin mode (access to all features)

### Data Privacy
- [ ] No PII in conversation logs
- [ ] User can delete history
- [ ] Opt-out of analytics
- [ ] Clear data retention policy

### Rate Limiting

```typescript
const CHAT_RATE_LIMITS = {
  anonymous: {
    messagesPerMinute: 5,
    messagesPerDay: 50,
  },
  authenticated: {
    messagesPerMinute: 20,
    messagesPerDay: 500,
  },
};
```

---

## Rollback Strategy

### Feature Flags

```typescript
const CHAT_FLAGS = {
  enabled: true,              // Master toggle
  streaming: true,            // SSE vs polling
  toolCalling: true,          // Function calls
  historyEnabled: true,       // Persistence
  maxMessages: 20,            // Context limit
};
```

### Graceful Degradation
1. **Full Chat**: Streaming + tools + history
2. **Simple Chat**: No tools, basic Q&A
3. **FAQ Mode**: Static responses only
4. **Disabled**: Link to documentation

### Error Recovery

```typescript
// Connection lost
if (!response.ok) {
  // Retry with exponential backoff
  // Show "reconnecting..." to user
  // Fall back to non-streaming after 3 retries
}
```

---

## Design System Compliance

### Chat Interface Layout

```
┌─────────────────────────────────────────────┐
│  AICompare Chat                      [□] [X]│
├─────────────────────────────────────────────┤
│                                             │
│  💬 Ask me anything about AI models         │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🤖 Hello! I'm here to help you find │   │
│  │    the perfect AI model. What are   │   │
│  │    you looking to build?            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 👤 I need a model for code generation│   │
│  │    with a budget of $500/month       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🤖 Based on your needs, here are    │   │
│  │    my top recommendations:          │   │
│  │                                     │   │
│  │    ┌──────────────────────────┐     │   │
│  │    │ #1 GPT-4 Turbo    95/100 │     │   │
│  │    │ Est: $320/mo             │     │   │
│  │    └──────────────────────────┘     │   │
│  │                                     │   │
│  │    [Compare] [See more options]     │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│ [Compare models] [Calculate cost] [Help]    │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────┐ [Send]  │
│ │ Ask a question...                │         │
│ └─────────────────────────────────┘         │
└─────────────────────────────────────────────┘
```

### Message Styling

**User Message**
```css
.user-message {
  background: var(--primary);
  color: white;
  border-radius: 16px 16px 4px 16px;
  align-self: flex-end;
}
```

**Assistant Message**
```css
.assistant-message {
  background: var(--card);
  color: var(--foreground);
  border-radius: 16px 16px 16px 4px;
  align-self: flex-start;
}
```

### Embedded Components
- Model cards (compact version)
- Comparison tables (inline)
- Cost breakdowns (expandable)
- Charts (when relevant)

### Animation
- Typing indicator: 3 bouncing dots
- Message appear: Fade up (200ms)
- Streaming: Character-by-character
- Tool results: Slide in

---

## Testing Requirements

### Unit Tests
- [ ] Message parsing
- [ ] Context building
- [ ] Tool execution
- [ ] Rate limiting logic

### Integration Tests
- [ ] Full conversation flow
- [ ] Tool calling round-trip
- [ ] History persistence
- [ ] Error recovery

### E2E Tests (Playwright)
- [ ] Send message and receive response
- [ ] Streaming text display
- [ ] Suggestion chips work
- [ ] History loads on return

### Load Tests
- [ ] 50 concurrent conversations
- [ ] Streaming under load
- [ ] Database write performance

---

## Implementation Checklist

### Wave 1: Chat Infrastructure
- [ ] Set up Vercel AI SDK
- [ ] Basic chat endpoint
- [ ] Streaming response handler
- [ ] Message component

### Wave 2: Tools & Context
- [ ] Implement chat tools
- [ ] Context builder with model data
- [ ] Tool result rendering
- [ ] Conversation history

### Wave 3: UI Polish
- [ ] Chat input with suggestions
- [ ] Embedded model cards
- [ ] Typing indicators
- [ ] Error states

### Wave 4: Persistence & Auth
- [ ] IndexedDB for anonymous
- [ ] Database for authenticated
- [ ] History management UI
- [ ] Rate limiting

---

## Success Criteria

| Criterion | Target | Validation |
|-----------|--------|------------|
| Time to first token | <500ms | Performance test |
| Conversation completion | >80% | Analytics |
| User satisfaction | >4/5 | Feedback |
| Tool accuracy | >95% | Integration test |
| History reliability | 100% | Persistence test |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Streaming failures | Medium | High | Fallback to polling |
| Context overflow | Medium | Medium | Summarization, limits |
| Tool errors | Medium | Medium | Graceful error display |
| Cost overrun | Low | Medium | Rate limiting, caching |

---

## Notes

### Vercel AI SDK Benefits
- Handles SSE complexity
- Built-in tool calling support
- React hooks for state
- Edge-compatible

### Conversation Memory
- Short-term: Last 20 messages in context
- Long-term: Summarize older conversations
- Cross-session: Resume previous chats

### Future Enhancements
- Voice input (Web Speech API)
- Share conversation links
- Export chat as PDF
- Embed chat on external sites
