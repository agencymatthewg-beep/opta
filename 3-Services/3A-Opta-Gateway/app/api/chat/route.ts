import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  provider?: 'gemini' | 'claude' | 'opencode' | 'minimax'
  model?: string
  temperature?: number
  maxTokens?: number
}

export async function POST(req: NextRequest) {
  try {
    // Extract Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get request body
    const body: ChatRequest = await req.json()
    const { messages, provider, model, temperature = 0.7, maxTokens = 2048 } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Fetch user's AI provider keys
    const { data: keys, error: keysError } = await supabaseAdmin
      .from('ai_provider_keys')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (keysError || !keys) {
      return NextResponse.json(
        { error: 'No AI provider keys configured. Please add your API keys in settings.' },
        { status: 400 }
      )
    }

    // Determine which provider to use
    const selectedProvider = provider || keys.default_provider || 'gemini'

    // Get the appropriate API key
    let apiKey: string | undefined
    switch (selectedProvider) {
      case 'gemini':
        apiKey = keys.gemini_key
        break
      case 'claude':
        apiKey = keys.claude_key
        break
      case 'opencode':
        apiKey = keys.opencode_key
        break
      case 'minimax':
        apiKey = keys.minimax_key
        break
      default:
        return NextResponse.json(
          { error: `Unknown provider: ${selectedProvider}` },
          { status: 400 }
        )
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for provider: ${selectedProvider}` },
        { status: 400 }
      )
    }

    // Route to the appropriate AI provider
    const response = await routeToProvider(
      selectedProvider,
      apiKey,
      messages,
      model,
      temperature,
      maxTokens
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function routeToProvider(
  provider: string,
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  temperature?: number,
  maxTokens?: number
): Promise<any> {
  switch (provider) {
    case 'gemini':
      return await callGemini(apiKey, messages, model, temperature, maxTokens)
    case 'claude':
      return await callClaude(apiKey, messages, model, temperature, maxTokens)
    case 'opencode':
      return await callOpenCode(apiKey, messages, model, temperature, maxTokens)
    case 'minimax':
      return await callMiniMax(apiKey, messages, model, temperature, maxTokens)
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  temperature?: number,
  maxTokens?: number
): Promise<any> {
  const modelName = model || 'gemini-2.0-flash-exp'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }))

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${error}`)
  }

  const data = await response.json()
  return {
    provider: 'gemini',
    model: modelName,
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response',
    usage: data.usageMetadata
  }
}

async function callClaude(
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  temperature?: number,
  maxTokens?: number
): Promise<any> {
  const modelName = model || 'claude-sonnet-4-5'
  const url = 'https://api.anthropic.com/v1/messages'

  // Separate system messages
  const systemMessages = messages.filter(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelName,
      messages: userMessages,
      system: systemMessages.map(m => m.content).join('\n\n'),
      temperature,
      max_tokens: maxTokens || 4096
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = await response.json()
  return {
    provider: 'claude',
    model: modelName,
    content: data.content?.[0]?.text || 'No response',
    usage: data.usage
  }
}

async function callOpenCode(
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  temperature?: number,
  maxTokens?: number
): Promise<any> {
  // OpenCode uses OpenRouter format
  const modelName = model || 'anthropic/claude-sonnet-4-5'
  const url = 'https://openrouter.ai/api/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://lm.optamize.biz',
      'X-Title': 'Opta AI'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenCode API error: ${error}`)
  }

  const data = await response.json()
  return {
    provider: 'opencode',
    model: modelName,
    content: data.choices?.[0]?.message?.content || 'No response',
    usage: data.usage
  }
}

async function callMiniMax(
  apiKey: string,
  messages: ChatMessage[],
  model?: string,
  temperature?: number,
  maxTokens?: number
): Promise<any> {
  const modelName = model || 'MiniMax-Text-01'
  const url = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MiniMax API error: ${error}`)
  }

  const data = await response.json()
  return {
    provider: 'minimax',
    model: modelName,
    content: data.choices?.[0]?.message?.content || 'No response',
    usage: data.usage
  }
}
