-- Add progress tracking columns
ALTER TABLE documentos_importacao 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_description TEXT;
