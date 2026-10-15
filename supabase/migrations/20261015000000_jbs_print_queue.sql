-- Run in the Supabase SQL editor. Assumes public.orders.id and created_at.
create extension if not exists pgcrypto with schema extensions;

-- These optional fields are used by the existing cardápio order flow. Adding
-- them only when missing keeps older installations compatible.
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists cashier_name text;

create table if not exists public.jbs_print_agents (
  agent_id text primary key,
  token_hash text not null,
  enabled boolean not null default true
);

create table if not exists public.jbs_print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'printed', 'failed')),
  claimed_by text,
  lease_until timestamptz,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists jbs_print_jobs_claim_idx
  on public.jbs_print_jobs (status, lease_until, created_at);
alter table public.jbs_print_agents enable row level security;
alter table public.jbs_print_jobs enable row level security;
revoke all on public.jbs_print_agents, public.jbs_print_jobs from anon, authenticated;

create or replace function public.jbs_enqueue_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payment_method text := coalesce(to_jsonb(new)->>'payment_method', '');
  v_cashier_name text := btrim(coalesce(to_jsonb(new)->>'cashier_name', ''));
begin
  -- Cashier orders stay on the cash register's existing local print path.
  if v_cashier_name <> '' then
    return new;
  end if;

  -- Online payments use online_*; table and kiosk orders use mesa/totem.
  if left(v_payment_method, 7) <> 'online_'
     and v_payment_method not in ('mesa', 'totem') then
    return new;
  end if;
  insert into public.jbs_print_jobs (order_id) values (new.id::text)
  on conflict (order_id) do nothing;
  return new;
end;
$$;

drop trigger if exists jbs_enqueue_order_after_insert on public.orders;
create trigger jbs_enqueue_order_after_insert after insert on public.orders
for each row execute function public.jbs_enqueue_order();

create or replace function public.jbs_claim_print_job(p_agent_id text, p_token text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_job public.jbs_print_jobs%rowtype; v_order jsonb;
begin
  if not exists (select 1 from public.jbs_print_agents a
    where a.agent_id = p_agent_id and a.enabled
      and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')) then
    raise exception 'invalid agent credentials' using errcode = '42501';
  end if;
  select * into v_job from public.jbs_print_jobs j
    where j.status = 'queued'
       or (j.status = 'processing' and j.lease_until < now())
    order by j.created_at limit 1 for update skip locked;
  if not found then return null; end if;
  update public.jbs_print_jobs set status = 'processing', claimed_by = p_agent_id,
    lease_until = now() + interval '2 minutes', attempts = attempts + 1,
    error_message = null where id = v_job.id returning * into v_job;
  select to_jsonb(o) into v_order from public.orders o where o.id::text = v_job.order_id;
  return jsonb_build_object('job_id', v_job.id, 'order', v_order);
end;
$$;

create or replace function public.jbs_complete_print_job(
  p_agent_id text, p_token text, p_job_id uuid, p_status text, p_error text default null
)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
begin
  if p_status is null or p_status not in ('printed', 'failed') then raise exception 'invalid status'; end if;
  if not exists (select 1 from public.jbs_print_agents a
    where a.agent_id = p_agent_id and a.enabled
      and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')) then
    raise exception 'invalid agent credentials' using errcode = '42501';
  end if;
  update public.jbs_print_jobs set status = p_status,
    error_message = case when p_status = 'failed' then left(p_error, 1000) else null end,
    completed_at = now(), lease_until = null
  where id = p_job_id and claimed_by = p_agent_id and status = 'processing';
  return found;
end;
$$;

revoke all on function public.jbs_claim_print_job(text, text) from public;
revoke all on function public.jbs_complete_print_job(text, text, uuid, text, text) from public;
grant execute on function public.jbs_claim_print_job(text, text) to anon, authenticated;
grant execute on function public.jbs_complete_print_job(text, text, uuid, text, text) to anon, authenticated;

-- Register an agent; replace both values and give the same token to JBS Print.
-- insert into public.jbs_print_agents (agent_id, token_hash)
-- values ('jbs-loja-1', encode(extensions.digest('LONG_RANDOM_TOKEN', 'sha256'), 'hex'));
