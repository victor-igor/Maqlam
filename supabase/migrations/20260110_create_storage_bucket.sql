-- Create private bucket 'financial-uploads'
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-uploads', 'financial-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'financial-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own imports"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'financial-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
