-- Migration to move subcategories to new parents

DO $$ 
DECLARE 
    id_imovel integer;
    id_funcionarios integer;
    id_vendas integer;
    id_adm integer;
    id_outros_custos integer;
    id_servico integer;
BEGIN
    -- Get Parent IDs
    SELECT id INTO id_imovel FROM public.categorias_dre WHERE codigo = '7';
    SELECT id INTO id_funcionarios FROM public.categorias_dre WHERE codigo = '9';
    SELECT id INTO id_vendas FROM public.categorias_dre WHERE codigo = '6';
    SELECT id INTO id_adm FROM public.categorias_dre WHERE codigo = '8';
    
    -- 1. Move to Imovel (Code 7)
    UPDATE public.categorias_dre SET id_pai = id_imovel, codigo = '7.01' WHERE nome = 'Aluguel';
    UPDATE public.categorias_dre SET id_pai = id_imovel, codigo = '7.02' WHERE nome = 'Água e Esgoto';
    UPDATE public.categorias_dre SET id_pai = id_imovel, codigo = '7.03' WHERE nome = 'Luz e Energia';
    UPDATE public.categorias_dre SET id_pai = id_imovel, codigo = '7.04' WHERE nome LIKE 'Manutenção (Predial%';
    -- Add others from user list if they exist or map close matches
    -- 'Monitoramento' does not exist, skipping.

    -- 2. Move to Funcionarios (Code 9)
    UPDATE public.categorias_dre SET id_pai = id_funcionarios, codigo = '9.01' WHERE nome LIKE 'Salários e Encargos%';
    
    -- 3. Move to Vendas (Code 6)
    UPDATE public.categorias_dre SET id_pai = id_vendas, codigo = '6.01' WHERE nome = 'Comissões de Venda';
    UPDATE public.categorias_dre SET id_pai = id_vendas, codigo = '6.02' WHERE nome LIKE 'Marketing%';
    UPDATE public.categorias_dre SET id_pai = id_vendas, codigo = '6.03' WHERE nome LIKE 'Feiras e Eventos%';

    -- 4. Clean up Adm (Code 8) - Renumber remaining to be safe? 
    -- Existing in Adm: 'Material de Escritorio', 'Telecomunicacao', 'Software', 'Contabilidade', 'Viagens'.
    -- These are fine in Adm.

END $$;
