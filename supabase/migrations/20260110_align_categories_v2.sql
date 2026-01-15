-- Migration to align category names and codes with user request

-- 1. Rename existing categories to match user format
UPDATE public.categorias_dre SET nome = 'CV | (-) Custo de Materiais' WHERE codigo = '3';
UPDATE public.categorias_dre SET nome = 'CV | (-) Custo do Serviço' WHERE codigo = '4';
UPDATE public.categorias_dre SET nome = 'CV | (-) Outros Custos' WHERE codigo = '5';
UPDATE public.categorias_dre SET nome = 'CF | (-) Despesas Administrativas' WHERE codigo = '6';
UPDATE public.categorias_dre SET nome = 'CF | (-) Despesas Financeiras' WHERE codigo = '7';
UPDATE public.categorias_dre SET nome = '(-) Sócios' WHERE codigo = '8';
UPDATE public.categorias_dre SET nome = '(+) Receitas não Operacionais' WHERE codigo = '9';


-- 2. Reorder codes to sequence them correctly
-- We use a temporary approach or direct updates if no conflict.
-- Current -> Target
-- 6 (Adm) -> 8
-- 7 (Fin) -> 11
-- 8 (Socios) -> 15
-- 9 (NonOp) -> 16
-- 10 (Vendas) -> 6
-- 11 (Imovel) -> 7
-- 12 (Func) -> 9
-- 13 (Trib) -> 10
-- 14 (Inv) -> 12
-- 15 (Empr) -> 13
-- 16 (Parc) -> 14

-- To avoid unique constraint violations, we update to temporary codes first if needed, 
-- but since we are swapping, we can do it carefully or use a suffix.
-- Let's append 'X' to existing conflicting ones first.

UPDATE public.categorias_dre SET codigo = '8X' WHERE codigo = '6';
UPDATE public.categorias_dre SET codigo = '11X' WHERE codigo = '7';
UPDATE public.categorias_dre SET codigo = '15X' WHERE codigo = '8';
UPDATE public.categorias_dre SET codigo = '16X' WHERE codigo = '9';

-- Now slot in the new ones (10-16) to their new places
UPDATE public.categorias_dre SET codigo = '6' WHERE codigo = '10'; -- Vendas
UPDATE public.categorias_dre SET codigo = '7' WHERE codigo = '11'; -- Imovel
UPDATE public.categorias_dre SET codigo = '9' WHERE codigo = '12'; -- Funcionarios
UPDATE public.categorias_dre SET codigo = '10' WHERE codigo = '13'; -- Outros Trib
UPDATE public.categorias_dre SET codigo = '12' WHERE codigo = '14'; -- Invest
UPDATE public.categorias_dre SET codigo = '13' WHERE codigo = '15'; -- Empr
UPDATE public.categorias_dre SET codigo = '14' WHERE codigo = '16'; -- Parcel

-- Now restore the 'X' ones to their final places
UPDATE public.categorias_dre SET codigo = '8' WHERE codigo = '8X'; -- Adm
UPDATE public.categorias_dre SET codigo = '11' WHERE codigo = '11X'; -- Fin
UPDATE public.categorias_dre SET codigo = '15' WHERE codigo = '15X'; -- Socios
UPDATE public.categorias_dre SET codigo = '16' WHERE codigo = '16X'; -- NonOp

-- 3. Verify Sub-categories (Optional: Might need to update children prefix if they rely on it, 
-- but usually children have their own code. If children codes start with '6.01', changing parent '6' to '8'
-- means we often want to update children to '8.01' for consistency, though strictly not required by FK.
-- Let's update children codes for consistency.)

-- Update children of Old 6 (Adm) -> New 8
UPDATE public.categorias_dre SET codigo = '8.' || SUBSTRING(codigo FROM 3) WHERE codigo LIKE '6.%';

-- Update children of Old 7 (Fin) -> New 11
-- Note: 7.01 -> 11.01 (Length changes, logic needs care)
-- SUBSTRING(codigo FROM 3) works for '6.xx' but '7.xx' is same.
UPDATE public.categorias_dre SET codigo = '11.' || SUBSTRING(codigo FROM 3) WHERE codigo LIKE '7.%';

-- Update children of Old 8 (Socios) -> New 15
UPDATE public.categorias_dre SET codigo = '15.' || SUBSTRING(codigo FROM 3) WHERE codigo LIKE '8.%';

-- Update children of Old 9 (NonOp) -> New 16
UPDATE public.categorias_dre SET codigo = '16.' || SUBSTRING(codigo FROM 3) WHERE codigo LIKE '9.%';
