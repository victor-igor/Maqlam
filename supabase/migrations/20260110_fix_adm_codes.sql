-- Fix 15.xx codes that should be 8.xx (Children of Adm)
-- Identifying them by parent 'Despesas Administrativas' (Code 8)
-- Or just by ensuring they are NOT children of Socios (Code 15).

DO $$ 
DECLARE 
    id_adm integer;
BEGIN
    SELECT id INTO id_adm FROM public.categorias_dre WHERE codigo = '8';

    -- Update children of Adm that have 15.xx code back to 8.xx
    -- 15.04 -> 8.04. 
    -- SUBSTRING('15.04' FROM 4) = '04'. '8.' || '04' = '8.04'.
    
    UPDATE public.categorias_dre 
    SET codigo = '8.' || SUBSTRING(codigo FROM 4)
    WHERE id_pai = id_adm AND codigo LIKE '15.%';

END $$;
