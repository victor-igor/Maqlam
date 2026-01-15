-- Add missing root categories requested by user
-- We will use codes 10+ to avoid conflicts with existing 1-9 codes.
-- Sort order will be determined by code, so we assign them to appear at the end for now,
-- or we can try to slot them if the user wants strict DRE ordering (implied).
-- For now, we simply ensure they exist as Root (id_pai NULL).

INSERT INTO public.categorias_dre (codigo, nome, tipo, natureza_dre, id_pai)
VALUES 
('10', 'CV | (-) Despesas de Vendas', 'D', 'Custo Variável', NULL),
('11', 'CF | (-) Despesas com Imóvel', 'D', 'Despesa Fixa', NULL),
('12', 'CF | (-) Funcionários', 'D', 'Despesa Fixa', NULL),
('13', 'CF | (-) Outros Tributos', 'D', 'Despesa Fixa', NULL),
('14', '(-) Investimentos', 'D', 'Investimento', NULL),
('15', '(-) Empréstimos e Financiamentos', 'D', 'Financeiro', NULL),
('16', '(-) Parcelamentos Tributários', 'D', 'Financeiro', NULL)
ON CONFLICT (codigo) DO NOTHING;
