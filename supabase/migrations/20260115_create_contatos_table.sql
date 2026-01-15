-- Create tags table
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default 'blue',
  created_at timestamptz default now()
);

alter table tags enable row level security;

create policy "Enable all for authenticated users" on tags
  for all using (auth.role() = 'authenticated');

-- Create contatos table
create table if not exists contatos (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  telefone text not null,
  email text,
  empresa text,
  cargo text,
  cpf text,
  cep text,
  endereco text,
  bairro text,
  cidade text,
  estado text,
  aceita_whatsapp boolean default true,
  aceita_email boolean default true,
  status text default 'Lead',
  lead_score numeric default 0,
  funil_status text,
  tags text[],
  origem text,
  observacoes text,
  resumo_lead text,
  ultima_interacao_lead timestamptz,
  timeout timestamptz,
  created_at timestamptz default now()
);

alter table contatos enable row level security;

create policy "Enable all for authenticated users" on contatos
  for all using (auth.role() = 'authenticated');

-- Create indexes
create index if not exists contatos_nome_completo_idx on contatos (nome_completo);
create index if not exists contatos_telefone_idx on contatos (telefone);
create index if not exists contatos_email_idx on contatos (email);
