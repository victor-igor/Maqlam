-- Remove (-) and (+) symbols from category names as requested

-- Simple replace calls
UPDATE public.categorias_dre SET nome = REPLACE(nome, '(-) ', '');
UPDATE public.categorias_dre SET nome = REPLACE(nome, '(+) ', '');

-- Also handle cases without space if any
UPDATE public.categorias_dre SET nome = REPLACE(nome, '(-)', '');
UPDATE public.categorias_dre SET nome = REPLACE(nome, '(+)', '');

-- Fix specific formatting "CV | Custo..."
-- If replace results in "CV | Custo", that's fine.
-- Let's ensure strict adherence if needed.

-- Specifically for "CV | (-) Custo..." -> "CV | Custo..."
-- The above replaces will handle "CV | (-) Custo" -> "CV | Custo"
