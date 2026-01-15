-- Create Enum for import status
CREATE TYPE status_importacao AS ENUM ('pending', 'processing', 'completed', 'error');

-- Create Queue Table
CREATE TABLE documentos_importacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    status status_importacao DEFAULT 'pending',
    result_data JSONB, -- Stores the AI extraction result
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documentos_importacao ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own imports"
    ON documentos_importacao FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imports"
    ON documentos_importacao FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imports"
    ON documentos_importacao FOR UPDATE
    USING (auth.uid() = user_id);

-- Create Index for performance
CREATE INDEX idx_documentos_importacao_user_id ON documentos_importacao(user_id);
CREATE INDEX idx_documentos_importacao_status ON documentos_importacao(status);
