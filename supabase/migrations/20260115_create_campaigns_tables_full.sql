-- Migration: Full Setup for Campaigns Feature (Maqlam)
-- Creates tables: integration_settings, campaigns, campaign_metrics, campaign_logs, campaign_triggers_log
-- Adds triggers and functions for dispatch logic

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Integration Settings (for Credentials)
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT UNIQUE NOT NULL,  -- e.g. 'campaign_settings'
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on integration_settings" 
ON public.integration_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'instant', 'scheduled', 'recurring'
    status TEXT NOT NULL DEFAULT 'draft',
    schedule_time TIMESTAMPTZ,
    recurrence_rule JSONB,
    audience_filter JSONB NOT NULL DEFAULT '{"type": "all"}'::jsonb,
    message_type TEXT NOT NULL DEFAULT 'text',
    media_url TEXT,
    daily_limit INTEGER,
    message_variations TEXT[],
    
    -- Hybrid Provider Fields
    provider TEXT CHECK (provider IN ('official', 'unofficial')) DEFAULT 'unofficial',
    template_name TEXT,
    template_language TEXT,
    template_text TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on campaigns" 
ON public.campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Campaign Logs (Individual Message Logs)
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contatos(id) ON DELETE SET NULL, -- optional
    phone TEXT,
    status TEXT, -- 'sent', 'delivered', 'read', 'failed'
    message_content TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on campaign_logs" 
ON public.campaign_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Campaign Metrics (Aggregated Stats)
CREATE TABLE IF NOT EXISTS public.campaign_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    total_sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on campaign_metrics" 
ON public.campaign_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Campaign Triggers Log (Dispatch/Batch History)
CREATE TABLE IF NOT EXISTS public.campaign_triggers_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    phone TEXT, 
    contact_id UUID 
);

ALTER TABLE public.campaign_triggers_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on campaign_triggers_log" 
ON public.campaign_triggers_log FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 7. Trigger Function for INSTANT Campaigns
CREATE OR REPLACE FUNCTION public.trigger_instant_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    webhook_url TEXT;
    instance_name TEXT;
    request_id BIGINT;
    meta_token TEXT;
    meta_account_id TEXT;
BEGIN
    -- Only process INSTANT campaigns with PENDING status
    IF NEW.type = 'instant' AND NEW.status = 'pending' THEN
        BEGIN
            -- Fetch integration settings
            SELECT 
                config->>'gateway_url',
                config->>'meta_access_token',
                config->>'meta_account_id'
            INTO webhook_url, meta_token, meta_account_id
            FROM public.integration_settings
            WHERE service_name = 'campaign_settings'
            LIMIT 1;

            -- BRANCH LOGIC BASED ON PROVIDER
            IF NEW.provider = 'unofficial' THEN
                -- Fetch ONE active instance for sending
                SELECT name INTO instance_name
                FROM public.whatsapp_instances
                WHERE is_active_for_campaigns = true
                ORDER BY status = 'connected' DESC, random()
                LIMIT 1;

                -- Validate basics
                IF webhook_url IS NULL OR webhook_url = '' THEN
                    INSERT INTO public.campaign_triggers_log (campaign_id, status, error_message)
                    VALUES (NEW.id, 'skipped', 'No webhook URL configured');
                    RETURN NEW;
                END IF;

                -- Fire Webhook to Gateway
                SELECT net.http_post(
                    url := webhook_url,
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := jsonb_build_object(
                        'campaign_id', NEW.id,
                        'name', NEW.name,
                        'type', NEW.type,
                        'audience_filter', NEW.audience_filter,
                        'provider', NEW.provider,
                        'instance_name', instance_name,
                        'message_type', NEW.message_type,
                        'media_url', NEW.media_url,
                        'daily_limit', NEW.daily_limit,
                        'message_variations', NEW.message_variations,
                        'target_time', NOW(),
                        'triggered_at', NOW()
                    )
                ) INTO request_id;
                
                -- Log
                 INSERT INTO public.campaign_triggers_log (campaign_id, status, response)
                 VALUES (NEW.id, 'success', jsonb_build_object('request_id', request_id, 'provider', 'unofficial', 'instance', instance_name));

            ELSIF NEW.provider = 'official' THEN
                
                IF webhook_url IS NULL OR webhook_url = '' THEN
                    INSERT INTO public.campaign_triggers_log (campaign_id, status, error_message)
                    VALUES (NEW.id, 'skipped', 'No webhook URL for official dispatch');
                    RETURN NEW;
                END IF;

                SELECT net.http_post(
                    url := webhook_url,
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := jsonb_build_object(
                        'campaign_id', NEW.id,
                        'name', NEW.name,
                        'type', NEW.type,
                        'audience_filter', NEW.audience_filter,
                        'provider', 'official',
                        'template_name', NEW.template_name,
                        'template_language', NEW.template_language,
                        'template_text', NEW.template_text,
                        'meta_token', meta_token,         
                        'meta_account_id', meta_account_id,
                        'target_time', NOW(),
                        'triggered_at', NOW()
                    )
                ) INTO request_id;

                 INSERT INTO public.campaign_triggers_log (campaign_id, status, response)
                 VALUES (NEW.id, 'success', jsonb_build_object('request_id', request_id, 'provider', 'official'));

            END IF;

            -- Update Status to Completed
            UPDATE public.campaigns 
            SET status = 'completed', last_run_at = NOW() 
            WHERE id = NEW.id;

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.campaign_triggers_log (campaign_id, status, error_message)
            VALUES (NEW.id, 'error', SQLERRM);
            RAISE WARNING 'Erro ao disparar campanha %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- 8. Create Trigger
DROP TRIGGER IF EXISTS on_instant_campaign_created ON public.campaigns;
CREATE TRIGGER on_instant_campaign_created
AFTER INSERT ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.trigger_instant_campaign();

-- 9. CRON Function (Process Queue) for Scheduled/Recurring
CREATE OR REPLACE FUNCTION public.process_campaign_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    campaign_record RECORD;
    webhook_url TEXT;
    instance_name TEXT;
    request_id BIGINT;
    timezone_br TEXT := 'America/Sao_Paulo';
    recurrence_rule_jsonb JSONB;
    meta_token TEXT;
    meta_account_id TEXT;
BEGIN
    -- Fetch settings
    SELECT 
        config->>'gateway_url',
        config->>'meta_access_token',
        config->>'meta_account_id'
    INTO webhook_url, meta_token, meta_account_id
    FROM public.integration_settings
    WHERE service_name = 'campaign_settings'
    LIMIT 1;

    IF webhook_url IS NULL OR webhook_url = '' THEN
        RETURN;
    END IF;

    -- Fetch instance once for batch (optimization for unofficial)
    SELECT name INTO instance_name
    FROM public.whatsapp_instances
    WHERE is_active_for_campaigns = true
    ORDER BY status = 'connected' DESC, random()
    LIMIT 1;

    -- ========================================
    -- PROCESS SCHEDULED CAMPAIGNS
    -- ========================================
    FOR campaign_record IN
        SELECT * FROM public.campaigns
        WHERE
            status = 'pending'
            AND type = 'scheduled'
            AND schedule_time IS NOT NULL
            AND schedule_time <= NOW()
        ORDER BY schedule_time ASC
    LOOP
        BEGIN
             -- Dispatch
             SELECT net.http_post(
                url := webhook_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := jsonb_build_object(
                    'campaign_id', campaign_record.id,
                    'name', campaign_record.name,
                    'type', campaign_record.type,
                    'audience_filter', campaign_record.audience_filter,
                    'provider', campaign_record.provider,
                    'instance_name', instance_name,
                    'template_name', campaign_record.template_name,
                    'template_language', campaign_record.template_language,
                    'template_text', campaign_record.template_text,
                    'message_type', campaign_record.message_type,
                    'media_url', campaign_record.media_url,
                    'daily_limit', campaign_record.daily_limit,
                    'message_variations', campaign_record.message_variations,
                    'meta_token', meta_token,
                    'meta_account_id', meta_account_id,
                    'target_time', campaign_record.schedule_time,
                    'triggered_at', NOW()
                )
            ) INTO request_id;

            UPDATE public.campaigns
            SET status = 'completed', last_run_at = NOW()
            WHERE id = campaign_record.id;

            INSERT INTO public.campaign_triggers_log (campaign_id, status, response)
            VALUES (campaign_record.id, 'success', jsonb_build_object('request_id', request_id, 'type', 'scheduled', 'provider', campaign_record.provider));

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.campaign_triggers_log (campaign_id, status, error_message)
            VALUES (campaign_record.id, 'error', SQLERRM);
        END;
    END LOOP;

    -- ========================================
    -- PROCESS RECURRING CAMPAIGNS
    -- ========================================
    FOR campaign_record IN
        SELECT 
            *,
            CASE 
                WHEN pg_typeof(recurrence_rule) = 'text'::regtype THEN recurrence_rule::jsonb
                ELSE recurrence_rule
            END as recurrence_rule_jsonb
        FROM public.campaigns
        WHERE
            status = 'active'
            AND type = 'recurring'
            AND recurrence_rule IS NOT NULL
            AND (
                last_run_at IS NULL 
                OR DATE(last_run_at AT TIME ZONE timezone_br) < DATE(NOW() AT TIME ZONE timezone_br)
            )
            AND (
                (CASE 
                    WHEN pg_typeof(recurrence_rule) = 'text'::regtype THEN recurrence_rule::jsonb
                    ELSE recurrence_rule
                END)->'days' @> to_jsonb(EXTRACT(DOW FROM (NOW() AT TIME ZONE timezone_br))::int)
            )
        ORDER BY created_at ASC
    LOOP
        BEGIN
            recurrence_rule_jsonb := campaign_record.recurrence_rule_jsonb;

            -- Check if current time matches any scheduled time (within 2 min window)
            DECLARE
                current_time_br TIME := (NOW() AT TIME ZONE timezone_br)::time;
                times_array JSONB := recurrence_rule_jsonb->'times';
                should_trigger BOOLEAN := FALSE;
                time_slot TEXT;
                target_time TIME;
            BEGIN
                FOR time_slot IN SELECT jsonb_array_elements_text(times_array)
                LOOP
                    target_time := time_slot::time;
                    
                    IF current_time_br >= target_time 
                       AND current_time_br < (target_time + interval '2 minutes') THEN
                        should_trigger := TRUE;
                        EXIT;
                    END IF;
                END LOOP;

                IF NOT should_trigger THEN
                    CONTINUE;
                END IF;
            END;

            -- Fire webhook
            SELECT net.http_post(
                url := webhook_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := jsonb_build_object(
                    'campaign_id', campaign_record.id,
                    'name', campaign_record.name,
                    'type', campaign_record.type,
                    'audience_filter', campaign_record.audience_filter,
                    'provider', campaign_record.provider,
                    'instance_name', instance_name,
                    'template_name', campaign_record.template_name,
                    'template_language', campaign_record.template_language,
                    'template_text', campaign_record.template_text,
                    'message_type', campaign_record.message_type,
                    'media_url', campaign_record.media_url,
                    'daily_limit', campaign_record.daily_limit,
                    'message_variations', campaign_record.message_variations,
                    'meta_token', meta_token,
                    'meta_account_id', meta_account_id,
                    'recurrence_rule', recurrence_rule_jsonb,
                    'target_time', NOW(),
                    'triggered_at', NOW()
                )
            ) INTO request_id;

            UPDATE public.campaigns
            SET last_run_at = NOW()
            WHERE id = campaign_record.id;

            INSERT INTO public.campaign_triggers_log (campaign_id, status, response)
            VALUES (campaign_record.id, 'success', jsonb_build_object('request_id', request_id, 'type', 'recurring', 'provider', campaign_record.provider));

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.campaign_triggers_log (campaign_id, status, error_message)
            VALUES (campaign_record.id, 'error', SQLERRM);
        END;
    END LOOP;

END;
$$;
