import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { campaignId, limit } = await req.json()

        if (!campaignId) {
            throw new Error('campaignId is required')
        }

        // 1. Fetch campaign details to get audience filter and daily limit
        const { data: campaign, error: campaignError } = await supabaseClient
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()

        if (campaignError) throw campaignError

        // 2. Fetch IDs of contacts who already received this campaign
        const { data: existingLogs, error: logsError } = await supabaseClient
            .from('campaign_logs')
            .select('contact_id')
            .eq('campaign_id', campaignId)
            .in('status', ['sent', 'delivered', 'success'])
            .not('contact_id', 'is', null)

        if (logsError) throw logsError

        const excludedContactIds = existingLogs?.map((log: any) => log.contact_id) || []

        // 3. Build the query for contacts
        let query = supabaseClient
            .from('contatos')
            .select('*')

        // Apply Audience Filter
        if (campaign.audience_filter?.type === 'tag' && campaign.audience_filter.value) {
            query = query.contains('tags', [campaign.audience_filter.value])
        }

        // Exclude contacts who already received it
        if (excludedContactIds.length > 0) {
            // Supabase JS doesn't support 'not.in' with a large array directly in the same way as SQL 'NOT IN' sometimes
            // But .not('id', 'in', `(${list})`) works if formatted correctly as a filter string
            // Alternatively, we can use .filter('id', 'not.in', `(${excludedContactIds.join(',')})`)
            // However, for very large lists, this might hit URL length limits. 
            // For now, we assume the list is manageable or we might need a different approach (RPC) for massive scales.
            query = query.not('id', 'in', `(${excludedContactIds.join(',')})`)
        }

        // Apply Limit
        const campaignLimit = campaign.daily_limit
        const effectiveLimit = limit && campaignLimit
            ? Math.min(limit, campaignLimit)
            : limit || campaignLimit

        if (effectiveLimit) {
            query = query.limit(effectiveLimit)
        }

        const { data: contacts, error: contactsError } = await query

        if (contactsError) throw contactsError

        return new Response(
            JSON.stringify(contacts),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
