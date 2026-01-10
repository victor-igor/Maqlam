import { supabase } from './supabase';

export type CampaignType = 'instant' | 'scheduled' | 'recurring';
export type CampaignStatus = 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface RecurrenceRule {
    days: number[]; // 0-6 (Sunday-Saturday)
    times: string[]; // Array of HH:mm strings
}

export interface AudienceFilter {
    type: 'all' | 'tag' | 'csv';
    value?: string; // Tag name or CSV file URL
}

export type MessageType = 'text' | 'image' | 'video';

export interface Campaign {
    id: string;
    name: string;
    type: CampaignType;
    status: CampaignStatus;
    schedule_time?: string;
    recurrence_rule?: RecurrenceRule;
    audience_filter: AudienceFilter;
    created_at: string;
    last_run_at?: string;
    created_by?: string;
    message_type: MessageType;
    media_url?: string;
    daily_limit?: number;
    message_variations?: string[];
}

export async function createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'status' | 'created_by'>) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('campaigns')
        .insert([
            {
                name: campaign.name,
                type: campaign.type,
                schedule_time: campaign.schedule_time,
                recurrence_rule: campaign.recurrence_rule,
                audience_filter: campaign.audience_filter,
                message_type: campaign.message_type,
                media_url: campaign.media_url,
                daily_limit: campaign.daily_limit,
                message_variations: campaign.message_variations,
                status: 'pending', // Default status for new campaigns
                created_by: user.id
            }
        ])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function listCampaigns() {
    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Campaign[];
}

export async function deleteCampaign(id: string) {
    const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getCampaignStats(campaignId: string, startDate?: string, endDate?: string) {
    // 1. Fetch aggregated metrics for performance (only if no date filter is applied)
    // If date filter is applied, we must calculate from logs to be accurate for that period
    let metrics = null;
    if (!startDate && !endDate) {
        const { data, error } = await supabase
            .from('campaign_metrics')
            .select('*')
            .eq('campaign_id', campaignId)
            .maybeSingle();

        if (!error) metrics = data;
    }

    // 2. Fetch detailed logs for the list view and hourly chart
    let query = supabase
        .from('campaign_logs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

    if (startDate) {
        query = query.gte('created_at', startDate);
    }
    if (endDate) {
        // Add time to end date to include the full day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDateTime.toISOString());
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) throw logsError;

    // Calculate metrics from logs (always calculate if filtering, or fallback if metrics table is empty)
    // If we have metrics and no filter, we could use them, but calculating from logs ensures consistency
    // especially since we just fetched them. Let's prioritize dynamic calculation for the report view.

    const total = logs.length;
    const sent = logs.length; // Total processed
    const delivered = logs.filter(l => l.status === 'success' || l.status === 'delivered').length;
    const failed = logs.filter(l => l.status === 'failed').length;

    // Calculate variation stats dynamically
    const variationStats: Record<string, any> = {};
    logs.forEach(log => {
        const key = log.message_content || 'default';
        if (!variationStats[key]) {
            variationStats[key] = { total: 0, delivered: 0, failed: 0 };
        }
        variationStats[key].total++;
        if (log.status === 'success' || log.status === 'delivered') variationStats[key].delivered++;
        if (log.status === 'failed') variationStats[key].failed++;
    });

    // Group by hour for "Response Times" (Activity Distribution)
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        sent: 0,
        delivered: 0,
        failed: 0
    }));

    logs.forEach(curr => {
        const date = new Date(curr.created_at);
        const hour = date.getHours();
        if (hourlyDistribution[hour]) {
            if (curr.status === 'success' || curr.status === 'delivered') {
                hourlyDistribution[hour].sent++;
                hourlyDistribution[hour].delivered++;
            }
            if (curr.status === 'failed') hourlyDistribution[hour].failed++;
        }
    });

    // 3. Fetch campaign details to get message variations (fallback for logs without content)
    const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    if (campaignError) throw campaignError;

    return {
        total,
        sent,
        delivered,
        failed,
        hourlyDistribution,
        logs,
        variationStats,
        campaign // Return the full campaign object
    };
}

export async function updateCampaignStatus(id: string, status: CampaignStatus) {
    const { error } = await supabase
        .from('campaigns')
        .update({ status })
        .eq('id', id);

    if (error) throw error;
}

export async function getCampaign(id: string) {
    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as Campaign;
}

export async function updateCampaign(id: string, updates: Partial<Omit<Campaign, 'id' | 'created_at' | 'created_by'>>) {
    const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function logCampaignError(
    campaignId: string,
    phone: string,
    errorMessage: string,
    contactId?: string,
    messageContent?: string
) {
    const { error } = await supabase
        .from('campaign_logs')
        .insert({
            campaign_id: campaignId,
            phone: phone,
            contact_id: contactId || null,
            status: 'failed',
            details: { error: errorMessage },
            message_content: messageContent,
            created_at: new Date().toISOString()
        });

    if (error) console.error('Erro ao logar falha:', error);
}

export async function logCampaignSuccess(
    campaignId: string,
    phone: string,
    contactId?: string,
    messageContent?: string
) {
    const { error } = await supabase
        .from('campaign_logs')
        .insert({
            campaign_id: campaignId,
            phone: phone,
            contact_id: contactId || null,
            status: 'success',
            message_content: messageContent,
            created_at: new Date().toISOString()
        });

    if (error) console.error('Erro ao logar sucesso:', error);
}

export async function getCampaignTargetAudience(campaignId: string, limit?: number) {
    // 1. Fetch campaign details to get audience filter and daily limit
    const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    if (campaignError) throw campaignError;

    // 2. Fetch IDs of contacts who already received this campaign
    // We filter by 'success', 'sent', or 'delivered' to avoid re-sending
    const { data: existingLogs, error: logsError } = await supabase
        .from('campaign_logs')
        .select('contact_id')
        .eq('campaign_id', campaignId)
        .in('status', ['sent', 'delivered', 'success'])
        .not('contact_id', 'is', null);

    if (logsError) throw logsError;

    const excludedContactIds = existingLogs?.map(log => log.contact_id) || [];

    // 3. Build the query for contacts
    let query = supabase
        .from('contatos')
        .select('*');

    // Apply Audience Filter
    if (campaign.audience_filter?.type === 'tag' && campaign.audience_filter.value) {
        // Assuming 'tags' is a text array column in Postgres
        query = query.contains('tags', [campaign.audience_filter.value]);
    }
    // If type is 'all', we don't need an extra filter

    // Exclude contacts who already received it
    if (excludedContactIds.length > 0) {
        query = query.not('id', 'in', `(${excludedContactIds.join(',')})`);
    }

    // Apply Limit
    // Use the provided limit (e.g. for batching) OR the campaign's daily limit
    // If both are present, use the smaller one to be safe
    const campaignLimit = campaign.daily_limit;
    const effectiveLimit = limit && campaignLimit
        ? Math.min(limit, campaignLimit)
        : limit || campaignLimit;

    if (effectiveLimit) {
        query = query.limit(effectiveLimit);
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError) throw contactsError;

    return contacts;
}


