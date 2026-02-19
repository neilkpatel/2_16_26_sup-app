import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webPush from "npm:web-push"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { userId, message, targetActive } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Get user's username
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single()

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get all squad member IDs (bidirectional friendships)
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

    const squadIds = (friendships || []).map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    )

    if (squadIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Filter squad members based on active Sup status
    const { data: activeSessions } = await supabase
      .from("sup_sessions")
      .select("user_id")
      .in("user_id", squadIds)
      .gt("expires_at", new Date().toISOString())

    const alreadySupIds = new Set((activeSessions || []).map((s) => s.user_id))

    // targetActive: notify only Sup'd users (e.g. bar selection)
    // default: notify only non-Sup'd users (e.g. new Sup broadcast)
    const notifyIds = targetActive
      ? squadIds.filter((id) => alreadySupIds.has(id))
      : squadIds.filter((id) => !alreadySupIds.has(id))

    if (notifyIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: squadIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get push subscriptions for target squad members
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, subscription")
      .in("user_id", notifyIds)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Configure web-push
    webPush.setVapidDetails(
      "mailto:noreply@sup.app",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    )

    const body = message || `${user.username} is free to hang`

    const payload = JSON.stringify({
      title: body,
      url: "/",
    })

    // Log notification for each recipient
    const notificationRows = notifyIds.map((recipientId) => ({
      user_id: recipientId,
      from_user_id: userId,
      message: body,
    }))
    await supabase.from("notifications").insert(notificationRows)

    // Send push to each subscription
    const expiredIds: string[] = []
    let sent = 0

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(sub.subscription, payload)
          sent++
        } catch (err: unknown) {
          const error = err as { statusCode?: number }
          if (error.statusCode === 410 || error.statusCode === 404) {
            expiredIds.push(sub.id)
          }
        }
      })
    )

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds)
    }

    return new Response(JSON.stringify({ sent, expired: expiredIds.length, skipped: alreadySupIds.size }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
