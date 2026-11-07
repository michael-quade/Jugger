// admin-users edge function
// Admin-only: create, delete, and resend invites for Supabase Auth users.
// All operations require the caller to be authenticated and have role='admin' in profiles.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Build a service-role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Build a regular client to verify the caller's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    )

    // Verify caller is authenticated
    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller has admin role in profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    // ── invite: create a confirmed user; no email is sent. The golfer signs in
    // with a 6-digit code from the login screen (links don't work with HashRouter/PWA).
    if (action === 'invite') {
      const { email, displayName, role, playerId, isSubAccount } = body
      if (!email) {
        return new Response(JSON.stringify({ error: 'email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!['player', 'scorer', 'admin', 'treasurer'].includes(role ?? 'player')) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          display_name: displayName || email.split('@')[0],
          role: role || 'player',
          player_id: playerId || null,
          is_sub_account: isSubAccount || false,
        },
      })

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ userId: data.user?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── delete: remove user from auth.users (cascade deletes profile row) ─────
    if (action === 'delete') {
      const { userId } = body
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Prevent deleting yourself
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
