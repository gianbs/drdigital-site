-- Controle de Caixa Dr Digital: acesso de funcionário (limitado).
-- Rode este arquivo UMA vez no SQL Editor do Supabase, depois do schema.sql. Pode rodar de novo sem problema.
--
-- O funcionário entra com o próprio e-mail e senha e trabalha no caixa do dono, mas o banco só entrega a ele:
--   clientes, vendas parceladas, receitas (lançar e receber), nomes das contas e listas de categorias.
-- Ele NÃO recebe despesas, gastos fixos nem transferências, e não pode excluir nada.
-- Sem as despesas, o aparelho dele não tem como calcular lucro, saldo ou resumo.

create table if not exists public.caixa_membros (
  user_id   uuid primary key references auth.users (id) on delete cascade, -- o funcionário
  dono_id   uuid not null references auth.users (id) on delete cascade,    -- de quem é o caixa
  papel     text not null default 'funcionario',
  criado_em timestamptz not null default now(),
  check (user_id <> dono_id)
);

alter table public.caixa_membros enable row level security;

drop policy if exists "membros: ver o meu vinculo" on public.caixa_membros;
create policy "membros: ver o meu vinculo" on public.caixa_membros
  for select to authenticated using (user_id = auth.uid() or dono_id = auth.uid());

revoke all on public.caixa_membros from anon, authenticated;
grant select on public.caixa_membros to authenticated; -- vínculos só são criados aqui pelo SQL Editor

-- De quem é o caixa em que o usuário atual trabalha (o dele mesmo, se não for funcionário).
create or replace function public.caixa_dono() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce((select m.dono_id from public.caixa_membros m where m.user_id = auth.uid()), auth.uid())
$$;

create or replace function public.caixa_funcionario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.caixa_membros m where m.user_id = auth.uid())
$$;

-- O que o funcionário pode LER. Registros excluídos vêm vazios e servem só para sumir da tela dele.
create or replace function public.caixa_pode_ler(col text, data jsonb, deleted boolean) returns boolean
language sql immutable as $$
  select deleted
      or col in ('clientes', 'vendas', 'config', 'contas')
      or (col = 'lancamentos' and data ->> 'tipo' = 'receita')
$$;

-- O que o funcionário pode GRAVAR: clientes, vendas e receitas. Nunca excluir.
create or replace function public.caixa_pode_gravar(col text, data jsonb, deleted boolean) returns boolean
language sql immutable as $$
  select not deleted
     and (col in ('clientes', 'vendas') or (col = 'lancamentos' and data ->> 'tipo' = 'receita'))
$$;

drop policy if exists "caixa: ler os meus" on public.caixa_registros;
drop policy if exists "caixa: criar os meus" on public.caixa_registros;
drop policy if exists "caixa: alterar os meus" on public.caixa_registros;
drop policy if exists "caixa: apagar os meus" on public.caixa_registros;
drop policy if exists "caixa: ler" on public.caixa_registros;
drop policy if exists "caixa: criar" on public.caixa_registros;
drop policy if exists "caixa: alterar" on public.caixa_registros;
drop policy if exists "caixa: apagar" on public.caixa_registros;

create policy "caixa: ler" on public.caixa_registros
  for select to authenticated using (
    user_id = public.caixa_dono()
    and (not public.caixa_funcionario() or public.caixa_pode_ler(col, data, deleted))
  );

create policy "caixa: criar" on public.caixa_registros
  for insert to authenticated with check (
    user_id = public.caixa_dono()
    and (not public.caixa_funcionario() or public.caixa_pode_gravar(col, data, deleted))
  );

create policy "caixa: alterar" on public.caixa_registros
  for update to authenticated
  using (
    user_id = public.caixa_dono()
    and (not public.caixa_funcionario() or public.caixa_pode_gravar(col, data, deleted))
  )
  with check (
    user_id = public.caixa_dono()
    and (not public.caixa_funcionario() or public.caixa_pode_gravar(col, data, deleted))
  );

create policy "caixa: apagar" on public.caixa_registros
  for delete to authenticated using (user_id = auth.uid() and not public.caixa_funcionario());

-- ---------------------------------------------------------------------------------------------
-- Para VINCULAR um funcionário (depois de criá-lo em Authentication > Users), rode trocando os e-mails:
--
--   insert into public.caixa_membros (user_id, dono_id)
--   select f.id, d.id from auth.users f, auth.users d
--   where f.email = 'EMAIL-DO-FUNCIONARIO' and d.email = 'EMAIL-DO-DONO'
--   on conflict (user_id) do update set dono_id = excluded.dono_id;
--
-- Para REMOVER o acesso:
--
--   delete from public.caixa_membros where user_id = (select id from auth.users where email = 'EMAIL-DO-FUNCIONARIO');
-- ---------------------------------------------------------------------------------------------
