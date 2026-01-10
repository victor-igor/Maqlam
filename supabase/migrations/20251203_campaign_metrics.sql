-- 1. Add columns to campaign_logs
ALTER TABLE campaign_logs
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS message_content TEXT,
ADD COLUMN IF NOT EXISTS variation_index INTEGER;

-- 2. Create campaign_metrics table
CREATE TABLE IF NOT EXISTS campaign_metrics (
    campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    variation_stats JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on campaign_metrics
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy for reading metrics (authenticated users can read)
CREATE POLICY "Authenticated users can read campaign metrics"
ON campaign_metrics FOR SELECT
TO authenticated
USING (true);

-- 3. Create function for trigger
CREATE OR REPLACE FUNCTION update_campaign_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_campaign_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_campaign_id := NEW.campaign_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_campaign_id := NEW.campaign_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_campaign_id := OLD.campaign_id;
    END IF;

    -- Upsert campaign_metrics row to ensure it exists
    INSERT INTO campaign_metrics (campaign_id)
    VALUES (v_campaign_id)
    ON CONFLICT (campaign_id) DO NOTHING;

    -- Recalculate metrics for this campaign
    -- We count ALL logs as 'total_sent' (processed)
    -- We count specific statuses for other metrics
    UPDATE campaign_metrics
    SET 
        total_sent = (SELECT count(*) FROM campaign_logs WHERE campaign_id = v_campaign_id),
        total_delivered = (SELECT count(*) FROM campaign_logs WHERE campaign_id = v_campaign_id AND status = 'delivered'),
        total_failed = (SELECT count(*) FROM campaign_logs WHERE campaign_id = v_campaign_id AND status = 'failed'),
        variation_stats = COALESCE((
            SELECT jsonb_object_agg(
                COALESCE(variation_index::text, 'default'), 
                jsonb_build_object(
                    'total', count(*),
                    'delivered', count(*) FILTER (WHERE status = 'delivered'),
                    'failed', count(*) FILTER (WHERE status = 'failed')
                )
            )
            FROM campaign_logs
            WHERE campaign_id = v_campaign_id
            GROUP BY campaign_id
        ), '{}'::jsonb),
        last_updated = NOW()
    WHERE campaign_id = v_campaign_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_update_campaign_metrics ON campaign_logs;
CREATE TRIGGER trigger_update_campaign_metrics
AFTER INSERT OR UPDATE OR DELETE ON campaign_logs
FOR EACH ROW
EXECUTE FUNCTION update_campaign_metrics();

-- 5. Backfill existing data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT campaign_id FROM campaign_logs LOOP
        -- Insert placeholder
        INSERT INTO campaign_metrics (campaign_id) VALUES (r.campaign_id) ON CONFLICT DO NOTHING;
        
        -- Trigger update manually (by updating a log or just running the update logic? 
        -- Simpler to just run the update logic directly here for backfill)
        UPDATE campaign_metrics
        SET 
            total_sent = (SELECT count(*) FROM campaign_logs WHERE campaign_id = r.campaign_id),
            total_delivered = (SELECT count(*) FROM campaign_logs WHERE campaign_id = r.campaign_id AND status = 'delivered'),
            total_failed = (SELECT count(*) FROM campaign_logs WHERE campaign_id = r.campaign_id AND status = 'failed'),
            variation_stats = COALESCE((
                SELECT jsonb_object_agg(
                    COALESCE(variation_index::text, 'default'), 
                    jsonb_build_object(
                        'total', count(*),
                        'delivered', count(*) FILTER (WHERE status = 'delivered'),
                        'failed', count(*) FILTER (WHERE status = 'failed')
                    )
                )
                FROM campaign_logs
                WHERE campaign_id = r.campaign_id
                GROUP BY campaign_id
            ), '{}'::jsonb),
            last_updated = NOW()
        WHERE campaign_id = r.campaign_id;
    END LOOP;
END $$;
