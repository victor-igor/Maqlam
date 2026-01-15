
-- Migration to create the get_financial_report RPC

CREATE OR REPLACE FUNCTION get_financial_report(
  start_date DATE,
  end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH RECURSIVE category_tree AS (
    -- Base Case: Root Categories
    SELECT 
      c.id,
      c.nome,
      c.codigo,
      c.id_pai,
      c.tipo,
      c.natureza_dre,
      0 as nivel,
      ARRAY[c.id] as path
    FROM categorias_dre c
    WHERE c.id_pai IS NULL

    UNION ALL

    -- Recursive Step: Child Categories
    SELECT 
      c.id,
      c.nome,
      c.codigo,
      c.id_pai,
      c.tipo,
      c.natureza_dre,
      ct.nivel + 1,
      ct.path || c.id
    FROM categorias_dre c
    JOIN category_tree ct ON c.id_pai = ct.id
  ),
  
  -- Monthly Aggregation from Transactions
  monthly_totals AS (
    SELECT 
      l.id_categoria_dre,
      -- Extract Month/Year for grouping
      -- data_competencia is varchar, cast to date first
      TO_CHAR(TO_DATE(l.data_competencia, 'YYYY-MM-DD'), 'YYYY-MM') as month_key,
      SUM(CASE WHEN l.tipo_operacao = 'E' THEN l.valor ELSE -l.valor END) as total_dre,
      -- For DFC we use data_pagamento if available, otherwise fallback or separate logic?
      -- Provided schema shows data_pagamento is date.
      SUM(CASE WHEN l.data_pagamento IS NOT NULL AND l.tipo_operacao = 'E' THEN l.valor 
               WHEN l.data_pagamento IS NOT NULL AND l.tipo_operacao = 'S' THEN -l.valor 
               ELSE 0 END) as total_dfc
    FROM lancamentos l
    WHERE 
      -- Filter by range (using competência as main driver for now, or we might need separate ranges)
      TO_DATE(l.data_competencia, 'YYYY-MM-DD') BETWEEN start_date AND end_date
    GROUP BY 1, 2
  ),
  
  -- Rollup Logic: Join Tree with Totals
  category_with_values AS (
      SELECT 
        ct.*,
        mt.month_key,
        COALESCE(mt.total_dre, 0) as raw_dre,
        COALESCE(mt.total_dfc, 0) as raw_dfc
      FROM category_tree ct
      LEFT JOIN monthly_totals mt ON ct.id = mt.id_categoria_dre
  ),

  -- Recursive Rollup for Parents
  -- This is tricky in SQL. Easier approach: 
  -- For each category, join with all its descendants (where path contains id)
  rollup_totals AS (
     SELECT
        root.id,
        root.nome,
        root.codigo,
        root.id_pai,
        root.nivel,
        root.tipo,
        root.natureza_dre,
        cwv.month_key,
        SUM(cwv.total_dre) as aggregated_dre,
        SUM(cwv.total_dfc) as aggregated_dfc
     FROM category_tree root
     JOIN category_tree descendant ON descendant.path @> ARRAY[root.id] -- Descendant contains Root's ID in path
     LEFT JOIN monthly_totals cwv ON cwv.id_categoria_dre = descendant.id
     WHERE cwv.month_key IS NOT NULL -- Only sum existing data months
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  )

  SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'nome', nome,
        'codigo', codigo,
        'id_pai', id_pai,
        'nivel', nivel,
        'tipo', tipo,
        'natureza', natureza_dre,
        'monthly_data', (
            SELECT jsonb_object_agg(
                sub.month_key, 
                jsonb_build_object(
                    'dre', sub.aggregated_dre, 
                    'dfc', sub.aggregated_dfc
                )
            )
            FROM rollup_totals sub
            WHERE sub.id = main.id
        )
      ) ORDER BY codigo
  ) INTO result
  FROM category_tree main;

  RETURN result;
END;
$$;

-- Grant permissions (Adjust role as necessary, e.g., authenticated)
GRANT EXECUTE ON FUNCTION get_financial_report(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_report(DATE, DATE) TO service_role;
