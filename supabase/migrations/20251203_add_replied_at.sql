-- Add replied_at column to campaign_logs
ALTER TABLE campaign_logs
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;

-- Update the metrics trigger to handle 'replied' status if we decide to track it as a status
-- For now, we just store the timestamp. If status becomes 'replied', the existing trigger handles the count.
