-- =====================================================================
-- Next Step CRM · banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem perder dados (só recria funções e regras).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------

-- Pessoas da equipe (uma linha por usuário do Supabase Auth)
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text not null default '',
  papel      text not null default 'vendedor' check (papel in ('admin','vendedor')),
  ativo      boolean not null default false,
  criado_em  timestamptz not null default now()
);
alter table public.perfis add column if not exists dono boolean not null default false;

-- Donos da empresa: sempre entram como admin, com acesso liberado, e
-- ninguém consegue bloquear ou rebaixar. Para incluir outro sócio, acrescente
-- o e-mail na lista do insert abaixo e rode este arquivo de novo.
create table if not exists public.donos (
  email text primary key check (email = lower(email))
);
insert into public.donos (email) values
  ('stepnext.soluctions@gmail.com')
on conflict do nothing;

-- E-mails autorizados a criar conta (o admin cadastra na tela Equipe)
create table if not exists public.convites (
  email      text primary key check (email = lower(email)),
  papel      text not null default 'vendedor' check (papel in ('admin','vendedor')),
  criado_em  timestamptz not null default now()
);

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (char_length(nome) between 1 and 200),
  empresa         text not null default '' check (char_length(empresa) <= 200),
  cargo           text not null default '' check (char_length(cargo) <= 120),
  telefone        text not null default '' check (char_length(telefone) <= 40),
  email           text not null default '' check (char_length(email) <= 200),
  instagram       text not null default '' check (char_length(instagram) <= 120),
  cidade          text not null default 'Belo Horizonte' check (char_length(cidade) <= 120),
  origem          text not null default '' check (char_length(origem) <= 60),
  servico         text not null default '' check (char_length(servico) <= 120),
  valor           numeric(12,2) not null default 0 check (valor >= 0),
  etapa           text not null default 'novo'
                  check (etapa in ('novo','contato','reuniao','proposta','negociacao','ganho','perdido')),
  proximo_contato date,
  proxima_acao    text not null default '' check (char_length(proxima_acao) <= 300),
  motivo_perda    text not null default '' check (char_length(motivo_perda) <= 300),
  fechado_em      date,
  responsavel     uuid references public.perfis(id) on delete set null,
  criado_por      uuid references public.perfis(id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists leads_etapa_idx       on public.leads (etapa);
create index if not exists leads_proximo_idx     on public.leads (proximo_contato);
create index if not exists leads_responsavel_idx on public.leads (responsavel);

create table if not exists public.notas (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  autor      uuid references public.perfis(id) on delete set null,
  texto      text not null check (char_length(texto) between 1 and 5000),
  sistema    boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists notas_lead_idx on public.notas (lead_id, criado_em);

-- ---------- Funções de apoio ----------

create or replace function public.eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo);
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'admin');
$$;

-- Quando alguém cria conta: enquanto não houver admin ativo, quem entra vira admin; os outros só
-- entram ativos se o e-mail estiver na lista de convites.
create or replace function public.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_conv convites%rowtype;
  v_primeiro boolean;
  v_dono boolean;
begin
  select not exists (select 1 from perfis where papel = 'admin' and ativo) into v_primeiro;
  select exists (select 1 from donos where email = lower(new.email)) into v_dono;
  select * into v_conv from convites where email = lower(new.email);
  insert into perfis (id, nome, email, papel, ativo, dono)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    case when v_primeiro or v_dono then 'admin' else coalesce(v_conv.papel, 'vendedor') end,
    v_primeiro or v_dono or v_conv.email is not null,
    v_dono
  )
  on conflict (id) do nothing;
  if v_conv.email is not null then delete from convites where email = v_conv.email; end if;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- Rótulos das etapas (usados nas anotações automáticas)
create or replace function public.nome_etapa(e text) returns text
language sql immutable as $$
  select case e
    when 'novo' then 'Novo lead' when 'contato' then 'Primeiro contato'
    when 'reuniao' then 'Reunião / diagnóstico' when 'proposta' then 'Proposta enviada'
    when 'negociacao' then 'Negociação' when 'ganho' then 'Fechado' when 'perdido' then 'Perdido'
    else e end;
$$;

-- Atualiza datas e registra mudança de etapa no histórico
create or replace function public.antes_salvar_lead() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    if new.etapa = 'ganho' and new.fechado_em is null then new.fechado_em := current_date; end if;
  elsif new.etapa is distinct from old.etapa then
    if new.etapa = 'ganho' then new.fechado_em := coalesce(new.fechado_em, current_date);
    elsif old.etapa = 'ganho' then new.fechado_em := null; end if;
  end if;
  return new;
end $$;

create or replace function public.depois_salvar_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa then
    insert into notas (lead_id, autor, texto, sistema)
    values (new.id, auth.uid(), 'Etapa: ' || nome_etapa(old.etapa) || ' → ' || nome_etapa(new.etapa), true);
  end if;
  return null;
end $$;

drop trigger if exists antes_salvar_lead on public.leads;
create trigger antes_salvar_lead before insert or update on public.leads
  for each row execute function public.antes_salvar_lead();
drop trigger if exists depois_salvar_lead on public.leads;
create trigger depois_salvar_lead after update on public.leads
  for each row execute function public.depois_salvar_lead();

-- Leads vindos do quiz do site. O público só pode chamar esta função:
-- não lê, não edita e não apaga nada.
create or replace function public.registrar_lead_site(
  p_nome text, p_empresa text default '', p_telefone text default '', p_email text default '',
  p_servico text default '', p_cidade text default '', p_respostas text default '', p_site text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(p_site, '') <> '' then return true; end if;            -- honeypot preenchido: robô
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome'; end if;
  if coalesce(trim(p_telefone), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'Informe WhatsApp ou e-mail';
  end if;
  -- mesmo contato nos últimos 10 minutos: ignora (evita envio duplo e spam)
  if exists (select 1 from leads where criado_em > now() - interval '10 minutes'
             and ((p_email <> '' and email = left(lower(trim(p_email)), 200))
               or (p_telefone <> '' and telefone = left(trim(p_telefone), 40)))) then
    return true;
  end if;
  if (select count(*) from leads where origem = 'Site (diagnóstico)' and criado_em > now() - interval '1 hour') > 60 then
    raise exception 'Muitos envios. Tente mais tarde.';
  end if;
  insert into leads (nome, empresa, telefone, email, servico, cidade, origem, etapa, proximo_contato, proxima_acao)
  values (left(trim(p_nome), 200), left(trim(coalesce(p_empresa, '')), 200), left(trim(coalesce(p_telefone, '')), 40),
          left(lower(trim(coalesce(p_email, ''))), 200), left(trim(coalesce(p_servico, '')), 120),
          coalesce(nullif(left(trim(coalesce(p_cidade, '')), 120), ''), 'Belo Horizonte'),
          'Site (diagnóstico)', 'novo', current_date, 'Responder lead do site')
  returning id into v_id;
  insert into notas (lead_id, texto, sistema) values (v_id, 'Lead chegou pelo diagnóstico do site', true);
  if coalesce(trim(p_respostas), '') <> '' then
    insert into notas (lead_id, texto) values (v_id, left(p_respostas, 5000));
  end if;
  return true;
end $$;

-- ---------- Segurança (Row Level Security) ----------

alter table public.perfis   enable row level security;
alter table public.convites enable row level security;
alter table public.leads    enable row level security;
alter table public.notas    enable row level security;

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated
  using (eh_membro() or id = auth.uid());
drop policy if exists perfis_admin on public.perfis;
create policy perfis_admin on public.perfis for update to authenticated
  using (eh_admin()) with check (eh_admin());

drop policy if exists convites_admin on public.convites;
create policy convites_admin on public.convites for all to authenticated
  using (eh_admin()) with check (eh_admin());

drop policy if exists leads_ler on public.leads;
create policy leads_ler on public.leads for select to authenticated using (eh_membro());
drop policy if exists leads_criar on public.leads;
create policy leads_criar on public.leads for insert to authenticated with check (eh_membro());
drop policy if exists leads_editar on public.leads;
create policy leads_editar on public.leads for update to authenticated using (eh_membro()) with check (eh_membro());
drop policy if exists leads_excluir on public.leads;
create policy leads_excluir on public.leads for delete to authenticated using (eh_admin());

drop policy if exists notas_ler on public.notas;
create policy notas_ler on public.notas for select to authenticated using (eh_membro());
drop policy if exists notas_criar on public.notas;
create policy notas_criar on public.notas for insert to authenticated
  with check (eh_membro() and autor = auth.uid() and not sistema);
drop policy if exists notas_excluir on public.notas;
create policy notas_excluir on public.notas for delete to authenticated
  using (eh_admin() or (autor = auth.uid() and not sistema));

-- Permissões por papel do Postgres
revoke all on public.perfis, public.convites, public.leads, public.notas from anon;
grant select, update on public.perfis to authenticated;
grant select, insert, delete on public.convites to authenticated;
grant select, insert, update, delete on public.leads, public.notas to authenticated;
revoke execute on function public.registrar_lead_site(text,text,text,text,text,text,text,text) from public;
grant execute on function public.registrar_lead_site(text,text,text,text,text,text,text,text) to anon, authenticated;
revoke execute on function public.ao_criar_usuario() from public, anon, authenticated;

-- Um vendedor não pode virar admin sozinho nem desativar o último admin
create or replace function public.proteger_perfis() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from donos where email = old.email) then
    new.papel := 'admin'; new.ativo := true; new.dono := true;
  else
    new.dono := false;
  end if;
  if old.papel = 'admin' and old.ativo and (new.papel <> 'admin' or not new.ativo)
     and (select count(*) from perfis where papel = 'admin' and ativo and id <> old.id) = 0 then
    raise exception 'A equipe precisa de pelo menos um admin ativo';
  end if;
  new.id := old.id; new.email := old.email; new.criado_em := old.criado_em;
  return new;
end $$;
drop trigger if exists proteger_perfis on public.perfis;
create trigger proteger_perfis before update on public.perfis
  for each row execute function public.proteger_perfis();

-- ---------- Tempo real ----------
-- Faz a tela de todos atualizar quando alguém da equipe mexe num lead.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.leads; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.notas; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- Donos: aplica nas contas que já existem ----------
alter table public.donos enable row level security;  -- só pelo SQL Editor
revoke all on public.donos from anon, authenticated;
update public.perfis p set papel = 'admin', ativo = true, dono = true
  where p.email in (select email from public.donos);
