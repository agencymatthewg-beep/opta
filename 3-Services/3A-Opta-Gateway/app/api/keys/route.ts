import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

// GET /api/keys - Get user's API keys (encrypted values hidden)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Fetch keys (Supabase will decrypt automatically)
    const { data: keys, error } = await supabaseAdmin
      .from('ai_provider_keys')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Return with masked keys (for display purposes)
    const response = keys ? {
      gemini: keys.gemini_key ? maskKey(keys.gemini_key) : null,
      claude: keys.claude_key ? maskKey(keys.claude_key) : null,
      opencode: keys.opencode_key ? maskKey(keys.opencode_key) : null,
      minimax: keys.minimax_key ? maskKey(keys.minimax_key) : null,
      defaultProvider: keys.default_provider || 'gemini'
    } : {
      gemini: null,
      claude: null,
      opencode: null,
      minimax: null,
      defaultProvider: 'gemini'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get keys error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/keys - Update user's API keys
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { gemini, claude, opencode, minimax, defaultProvider } = body

    // Build update object (only include provided keys)
    const updates: any = { user_id: user.id }
    if (gemini !== undefined) updates.gemini_key = gemini
    if (claude !== undefined) updates.claude_key = claude
    if (opencode !== undefined) updates.opencode_key = opencode
    if (minimax !== undefined) updates.minimax_key = minimax
    if (defaultProvider) updates.default_provider = defaultProvider

    // Upsert (insert or update)
    const { data, error } = await supabaseAdmin
      .from('ai_provider_keys')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'API keys updated successfully'
    })
  } catch (error) {
    console.error('Update keys error:', error)
    return NextResponse.json(
      { error: 'Failed to update API keys' },
      { status: 500 }
    )
  }
}

// Helper function to mask API keys for display
function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.substring(0, 4) + '••••' + key.substring(key.length - 4)
}
