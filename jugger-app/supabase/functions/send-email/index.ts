import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // The public anon key also passes the gateway's JWT check, so require a real signed-in user.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sign in to send email' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { subject, html, recipients, attachments } = await req.json()

    if (!subject || !html || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: subject, html, recipients' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Email service not configured (RESEND_API_KEY missing)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Juggerknocker Invitational <noreply@juggerknockerinvitational.com>',
        to: recipients,
        subject,
        html,
        ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message ?? `Resend error ${res.status}` }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
