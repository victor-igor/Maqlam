-- Re-sequence Despesas Administrativas children to be alphabetical

DO $$ 
DECLARE 
    r RECORD;
    new_code_suffix integer := 1;
    formatted_code text;
    id_adm integer;
BEGIN
    SELECT id INTO id_adm FROM public.categorias_dre WHERE codigo = '8';

    -- Iterate over all children of Adm, sorted by Name
    FOR r IN 
        SELECT id, nome 
        FROM public.categorias_dre 
        WHERE id_pai = id_adm 
        ORDER BY nome ASC
    LOOP
        -- Generate new code: 8.01, 8.02 ... 8.10, 8.11 ...
        -- Using TO_CHAR to format leading zero? Or just straight math if using dots?
        -- Actually, the frontend parses float '8.1' vs '8.10'. 
        -- 8.1 == 8.10. This is bad for sorting if we have > 9 items.
        -- If we use '8.01', '8.02', '8.09', '8.10'.
        -- parseFloat('8.01') = 8.01.
        -- parseFloat('8.10') = 8.1.
        -- 8.01 < 8.1. Correct.
        -- BUT parseFloat('8.2') (8.2) > parseFloat('8.10') (8.1).
        -- So '8.2' comes AFTER '8.10'.
        -- If I generate 8.1, 8.2... 8.9, 8.10.
        -- 8.1 (8.1)
        -- 8.2 (8.2)
        -- ...
        -- 8.9 (8.9)
        -- 8.10 (8.1) -> Sorts equal to 8.1!
        
        -- SOLUTION: Use strictly 2-digit decimals for everything? 8.01, 8.02... 8.99.
        -- Up to 99 items.
        
        IF new_code_suffix < 10 THEN
            formatted_code := '8.0' || new_code_suffix::text;
        ELSE
            formatted_code := '8.' || new_code_suffix::text;
        END IF;

        -- Update
        UPDATE public.categorias_dre SET codigo = formatted_code WHERE id = r.id;
        
        new_code_suffix := new_code_suffix + 1;
    END LOOP;
END $$;
