-- ============================================================================
-- FILA DE IMPRESSÃO AUTOMÁTICA PELO BANCO (JBS PRINT) PARA CARDÁPIO ONLINE AÇAÍ
-- Faz os pedidos online de public.acai_orders entrarem automaticamente em
-- public.jbs_print_jobs e saírem na impressora igual ao cardápio online Hero's.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

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

-- Normaliza um registro de acai_orders para o mesmo formato JSON de orders (compatível com JBS Print e Recibos)
create or replace function public.format_acai_order_for_print(p_order public.acai_orders)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_flavors text;
    v_addons text;
    v_raw_obs text;
    v_obs_parts text[];
    v_final_obs text;
    v_name text;
    v_price numeric(10, 2);
    v_qty integer;
    v_payment text;
begin
    if jsonb_typeof(p_order.items) = 'array' and jsonb_array_length(p_order.items) > 0 then
        for v_item in select * from jsonb_array_elements(p_order.items)
        loop
            v_qty := greatest(1, coalesce((v_item->>'qty')::integer, 1));
            v_name := coalesce(
                nullif(btrim(v_item->>'name'), ''),
                nullif(btrim(v_item->>'title'), ''),
                'Acai ' || coalesce(v_item->>'grams', p_order.grams::text, '0') || 'g'
            );
            v_price := coalesce((v_item->>'price')::numeric, (v_item->>'total')::numeric, 0);
            v_raw_obs := btrim(coalesce(v_item->>'notes', v_item->>'observation', ''));

            if position('Sabores:' in coalesce(v_item->>'observation', '')) > 0
               or position('Acomp:' in coalesce(v_item->>'observation', '')) > 0 then
                v_final_obs := btrim(coalesce(v_item->>'observation', ''));
            else
                v_obs_parts := array[]::text[];

                if jsonb_typeof(v_item->'flavors') = 'array' and jsonb_array_length(v_item->'flavors') > 0 then
                    select string_agg(btrim(val), ', ')
                    into v_flavors
                    from jsonb_array_elements_text(v_item->'flavors') as t(val)
                    where btrim(val) <> '';

                    if v_flavors is not null and v_flavors <> '' then
                        v_obs_parts := array_append(v_obs_parts, 'Sabores: ' || v_flavors);
                    end if;
                end if;

                if jsonb_typeof(v_item->'addons') = 'array' and jsonb_array_length(v_item->'addons') > 0 then
                    select string_agg(
                        coalesce(nullif(btrim(elem->>'name'), ''), nullif(btrim(elem#>>'{}'), '')),
                        ', '
                    )
                    into v_addons
                    from jsonb_array_elements(v_item->'addons') as t(elem)
                    where coalesce(nullif(btrim(elem->>'name'), ''), nullif(btrim(elem#>>'{}'), '')) is not null;

                    if v_addons is not null and v_addons <> '' then
                        v_obs_parts := array_append(v_obs_parts, 'Acomp: ' || v_addons);
                    end if;
                end if;

                if v_raw_obs <> '' then
                    v_obs_parts := array_append(v_obs_parts, v_raw_obs);
                end if;

                v_final_obs := array_to_string(v_obs_parts, ' | ');
            end if;

            v_items := v_items || jsonb_build_array(
                v_item || jsonb_build_object(
                    'qty', v_qty,
                    'name', v_name,
                    'price', v_price,
                    'observation', coalesce(v_final_obs, '')
                )
            );
        end loop;
    else
        v_items := jsonb_build_array(
            jsonb_build_object(
                'qty', 1,
                'name', 'Acai (' || coalesce(p_order.grams, 0)::text || 'g)',
                'price', coalesce(p_order.total, 0),
                'observation', coalesce(p_order.observation, '')
            )
        );
    end if;

    v_payment := btrim(coalesce(p_order.payment_method, ''));
    if btrim(coalesce(p_order.cashier_name, '')) = ''
       and v_payment <> ''
       and left(v_payment, 7) <> 'online_'
       and v_payment not in ('mesa', 'totem') then
        v_payment := 'online_' || v_payment;
    end if;

    return jsonb_build_object(
        'id', p_order.id,
        'created_at', p_order.created_at,
        'order_number', p_order.order_number,
        'customer_name', p_order.customer_name,
        'customer_phone', p_order.customer_phone,
        'customer_address', case
            when p_order.delivery_type = 'balcao' then null
            when coalesce(btrim(p_order.customer_address), '') = '' and p_order.delivery_type = 'retirada' then 'Retirada no Local'
            else p_order.customer_address
        end,
        'delivery_type', p_order.delivery_type,
        'cashier_name', p_order.cashier_name,
        'payment_method', nullif(v_payment, ''),
        'change_amount', p_order.change_amount,
        'observation', p_order.observation,
        'status', p_order.status,
        'total', p_order.total,
        'items', v_items,
        'source', 'acai'
    );
end;
$$;

-- Trigger que enfileira automaticamente os pedidos online de acai_orders na fila jbs_print_jobs
create or replace function public.jbs_enqueue_acai_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cashier_name text := btrim(coalesce(to_jsonb(new)->>'cashier_name', ''));
    v_delivery_type text := btrim(coalesce(to_jsonb(new)->>'delivery_type', ''));
begin
    -- Pedidos lançados pelo operador no balcão continuam na impressão local do caixa
    if v_cashier_name <> '' or v_delivery_type = 'balcao' then
        return new;
    end if;

    insert into public.jbs_print_jobs (order_id)
    values (new.id::text)
    on conflict (order_id) do nothing;

    return new;
end;
$$;

drop trigger if exists jbs_enqueue_acai_order_after_insert on public.acai_orders;
create trigger jbs_enqueue_acai_order_after_insert
    after insert on public.acai_orders
    for each row execute function public.jbs_enqueue_acai_order();

-- Atualiza jbs_claim_print_job para buscar o pedido tanto em public.orders quanto em public.acai_orders
create or replace function public.jbs_claim_print_job(p_agent_id text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_job public.jbs_print_jobs%rowtype;
    v_order jsonb;
    v_acai_order public.acai_orders%rowtype;
begin
    if not exists (
        select 1 from public.jbs_print_agents a
        where a.agent_id = p_agent_id
          and a.enabled
          and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    ) then
        raise exception 'invalid agent credentials' using errcode = '42501';
    end if;

    select * into v_job
    from public.jbs_print_jobs j
    where j.status = 'queued'
       or (j.status = 'processing' and j.lease_until < now())
    order by j.created_at
    limit 1
    for update skip locked;

    if not found then
        return null;
    end if;

    update public.jbs_print_jobs
    set status = 'processing',
        claimed_by = p_agent_id,
        lease_until = now() + interval '2 minutes',
        attempts = attempts + 1,
        error_message = null
    where id = v_job.id
    returning * into v_job;

    select to_jsonb(o) into v_order
    from public.orders o
    where o.id::text = v_job.order_id;

    if v_order is null then
        select * into v_acai_order
        from public.acai_orders ao
        where ao.id::text = v_job.order_id;

        if found then
            v_order := public.format_acai_order_for_print(v_acai_order);
        end if;
    end if;

    return jsonb_build_object('job_id', v_job.id, 'order', v_order);
end;
$$;

revoke all on function public.jbs_claim_print_job(text, text) from public;
grant execute on function public.jbs_claim_print_job(text, text) to anon, authenticated;

-- Atualiza list_delivery_orders_today e get_today_order_details para incluir recibos de acai_orders
create or replace function public.list_delivery_orders_today()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_orders jsonb;
begin
    v_today_start := date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo';

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', combined.id,
                'order_number', combined.order_number,
                'status', combined.status,
                'total', combined.total,
                'created_at', combined.created_at
            ) order by combined.created_at desc
        ),
        '[]'::jsonb
    ) into v_orders
    from (
        select
            o.id::text as id,
            o.order_number::text as order_number,
            o.status::text as status,
            o.total as total,
            o.created_at as created_at
        from public.orders o
        where o.created_at >= v_today_start
          and o.created_at < v_today_start + interval '1 day'

        union all

        select
            ao.id::text as id,
            ao.order_number::text as order_number,
            ao.status::text as status,
            ao.total as total,
            ao.created_at as created_at
        from public.acai_orders ao
        where ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
    ) as combined;

    return v_orders;
end;
$$;

create or replace function public.get_today_order_details(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_order public.orders%rowtype;
    v_acai_order public.acai_orders%rowtype;
    v_formatted_acai jsonb;
begin
    if p_order_id is null or btrim(p_order_id) = '' then
        return null;
    end if;

    v_today_start := date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo';

    select o.* into v_order
    from public.orders o
    where o.id::text = btrim(p_order_id)
      and o.created_at >= v_today_start
      and o.created_at < v_today_start + interval '1 day'
    limit 1;

    if found then
        return jsonb_build_object(
            'order_number', v_order.order_number,
            'customer_name', v_order.customer_name,
            'customer_phone', v_order.customer_phone,
            'customer_address', v_order.customer_address,
            'items', v_order.items,
            'total', v_order.total,
            'status', v_order.status,
            'payment_method', v_order.payment_method,
            'change_amount', v_order.change_amount,
            'observation', v_order.observation,
            'created_at', v_order.created_at
        );
    end if;

    select ao.* into v_acai_order
    from public.acai_orders ao
    where ao.id::text = btrim(p_order_id)
      and ao.created_at >= v_today_start
      and ao.created_at < v_today_start + interval '1 day'
    limit 1;

    if not found then
        return null;
    end if;

    v_formatted_acai := public.format_acai_order_for_print(v_acai_order);

    return jsonb_build_object(
        'order_number', v_acai_order.order_number,
        'customer_name', v_acai_order.customer_name,
        'customer_phone', v_acai_order.customer_phone,
        'customer_address', v_formatted_acai->>'customer_address',
        'items', v_formatted_acai->'items',
        'total', v_acai_order.total,
        'status', v_acai_order.status,
        'payment_method', v_formatted_acai->>'payment_method',
        'change_amount', v_acai_order.change_amount,
        'observation', v_acai_order.observation,
        'created_at', v_acai_order.created_at
    );
end;
$$;

revoke all on function public.list_delivery_orders_today() from public;
revoke all on function public.get_today_order_details(text) from public;
grant execute on function public.list_delivery_orders_today() to anon, authenticated;
grant execute on function public.get_today_order_details(text) to anon, authenticated;

notify pgrst, 'reload schema';
