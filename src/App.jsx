create table procedures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamp default now()
);

alter table procedures enable row level security;

-- Só o administrador pode ver, criar, editar e excluir procedimentos
create policy "Admin gerencia procedimentos"
  on procedures for all
  using (auth.jwt() ->> 'email' = 'sispassaros@gmail.com')
  with check (auth.jwt() ->> 'email' = 'sispassaros@gmail.com');
