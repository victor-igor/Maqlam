
import { createClient } from '@supabase/supabase-js';

// Using the keys found in lib/supabase.ts
const supabaseUrl = 'https://nglcftgdninqessypxow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbGNmdGdkbmlucWVzc3lweG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODU0MzYsImV4cCI6MjA4MTM2MTQzNn0.Gt-iBe7D9PofBTyocUOehM0DnNC_rCCgiPRVGz7lkic';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- Inspecting categorias_dre ---');

    const table = 'categorias_dre';

    // 1. Check existence and count
    const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true });

    if (countError) {
        console.log(`Error accessing ${table}: ${countError.message} (Code: ${countError.code})`);
        // It might be RLS.
    } else {
        console.log(`${table} exists. Rows: ${count}`);
    }

    // 2. Probe Columns
    // We want to find the ID, Name, and Parent ID (for hierarchy)
    const candidateColumns = [
        'id',
        'created_at',
        'nome', 'name', 'titulo', 'descricao',
        'parent_id', 'categoria_pai_id', 'id_pai', 'pai_id', 'id_categoria_pai',
        'tipo', 'type', 'natureza',
        'ordem', 'order', 'codigo', 'cod'
    ];

    const confirmedCols = [];

    for (const col of candidateColumns) {
        const { data, error } = await supabase.from(table).select(col).limit(1);
        if (!error) {
            confirmedCols.push(col);
        }
    }

    console.log(`Confirmed columns in ${table}:`, confirmedCols.join(', '));

    // 3. Peek at data to understand structure if we found columns
    if (confirmedCols.length > 0) {
        const { data: rows } = await supabase.from(table).select(confirmedCols.join(',')).limit(5);
        console.log('Sample Data:', rows);
    }
}

inspect();
