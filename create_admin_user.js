
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bshmmxcegwwppihlyyag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzaG1teGNlZ3d3cHBpaGx5eWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTM1NTcsImV4cCI6MjA3OTU4OTU1N30.crvPAkjlgD5VWAXjxflDiGBA4NJYnG9JfV8r3s0arnE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
    const email = 'admin@example.com';
    const password = 'admin@123';
    const nome = 'Admin Campos Joias';

    console.log(`Creating user ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('Error creating user:', error.message);
        return;
    }

    console.log('User created:', data.user?.id);

    if (data.user) {
        console.log('Creating profile in public.usuarios...');
        const { error: profileError } = await supabase
            .from('usuarios')
            .insert({
                auth_id: data.user.id,
                email: email,
                nome: nome,
                role: 'admin',
                ativo: true
            });

        if (profileError) {
            console.error('Error creating profile:', profileError.message);
        } else {
            console.log('Profile created successfully.');
        }
    }
}

createAdmin();
