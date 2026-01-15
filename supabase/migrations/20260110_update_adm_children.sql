-- Update Despesas Administrativas children to match specific user list

DO $$ 
DECLARE 
    id_adm integer;
BEGIN
    SELECT id INTO id_adm FROM public.categorias_dre WHERE codigo = '8';

    -- 1. Rename existing combined/broad categories to match specific items from list
    UPDATE public.categorias_dre SET nome = 'Contabilidade' WHERE id_pai = id_adm AND nome = 'Contabilidade e Jurídico';
    UPDATE public.categorias_dre SET nome = 'Software de gestão' WHERE id_pai = id_adm AND nome = 'Software de Gestão/Consulta';
    UPDATE public.categorias_dre SET nome = 'Material de escritório' WHERE id_pai = id_adm AND nome = 'Material de Escritório/Consumo';

    -- 2. Insert missing categories
    -- using a temp table or values approach to iterate
    INSERT INTO public.categorias_dre (nome, codigo, tipo, natureza_dre, id_pai)
    VALUES 
    ('3º honorário contábil', '8.21', 'D', 'Despesa Fixa', id_adm),
    ('Advogados', '8.22', 'D', 'Despesa Fixa', id_adm),
    ('Cartão de crédito', '8.23', 'D', 'Despesa Fixa', id_adm),
    ('Compras', '8.24', 'D', 'Despesa Fixa', id_adm),
    ('Despesas jurídicas', '8.25', 'D', 'Despesa Fixa', id_adm),
    ('Financeiro Americano', '8.26', 'D', 'Despesa Fixa', id_adm),
    ('Gráfica', '8.27', 'D', 'Despesa Fixa', id_adm),
    ('Manutenção de equipamentos', '8.28', 'D', 'Despesa Fixa', id_adm),
    ('Manutenção de veículos', '8.29', 'D', 'Despesa Fixa', id_adm),
    ('Materiais Elétricos', '8.30', 'D', 'Despesa Fixa', id_adm),
    ('Materiais/suprimentos', '8.31', 'D', 'Despesa Fixa', id_adm),
    ('Material de uso e consumo', '8.32', 'D', 'Despesa Fixa', id_adm),
    ('Móveis e utensílios', '8.33', 'D', 'Despesa Fixa', id_adm),
    ('Registro Marca', '8.34', 'D', 'Despesa Fixa', id_adm),
    ('Seguro de veículo', '8.35', 'D', 'Despesa Fixa', id_adm),
    ('Seguro empresarial', '8.36', 'D', 'Despesa Fixa', id_adm),
    ('Seguros', '8.37', 'D', 'Despesa Fixa', id_adm),
    ('Software de consulta', '8.38', 'D', 'Despesa Fixa', id_adm)
    ON CONFLICT (codigo) DO NOTHING; 
    -- Note: ON CONFLICT ignores provided code if already exists. 
    -- If '8.xx' style conflicts with old 15->8 move, we might need manual code handling.
    -- But previous step fixed 15 to 8.xx (4,6,7,8,11). 
    -- Used range 21+ to avoid collision with 01-11.

END $$;
