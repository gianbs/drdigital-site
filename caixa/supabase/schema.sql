-- Controle de Caixa Dr Digital: tabela única que guarda todos os registros do app.
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.

create table if not exists public.caixa_registros (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,
  col        text        not null,               -- tipo do registro: lancamentos, clientes, vendas, fixos, contas, config
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false, -- exclusões ficam marcadas para sincronizar entre aparelhos
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists caixa_registros_sinc on public.caixa_registros (user_id, updated_at);

-- A data de alteração é sempre a do servidor (é ela que decide o que cada aparelho ainda precisa baixar).
create or replace function public.caixa_carimbo() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists caixa_registros_carimbo on public.caixa_registros;
create trigger caixa_registros_carimbo
  before insert or update on public.caixa_registros
  for each row execute function public.caixa_carimbo();

-- Segurança: cada usuário só enxerga e altera os próprios registros.
alter table public.caixa_registros enable row level security;

drop policy if exists "caixa: ler os meus" on public.caixa_registros;
create policy "caixa: ler os meus" on public.caixa_registros
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "caixa: criar os meus" on public.caixa_registros;
create policy "caixa: criar os meus" on public.caixa_registros
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "caixa: alterar os meus" on public.caixa_registros;
create policy "caixa: alterar os meus" on public.caixa_registros
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "caixa: apagar os meus" on public.caixa_registros;
create policy "caixa: apagar os meus" on public.caixa_registros
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.caixa_registros to authenticated;
