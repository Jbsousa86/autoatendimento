-- ============================================================================
-- FILA DE IMPRESSÃO AUTOMÁTICA PELO BANCO (JBS PRINT)
-- Unifica e corrige a impressão automática para:
--   1. Cardápio Online Hero's (public.orders -> origin = 'online' -> Impressora Padrão)
--   2. Pedidos de Mesa (public.orders -> origin = 'mesa' -> Impressora Padrão)
--   3. Cardápio Online Açaí (public.acai_orders -> origin = 'online' -> Impressora Padrão)
--   4. Autoatendimento / Totem (public.orders -> origin = 'totem' -> Impressora Totem)
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists cashier_name text;
alter table public.orders add column if not exists origin text;
alter table public.orders add column if not exists printer_target text;

create table if not exists public.jbs_print_agents (
    agent_id text primary key,
    token_hash text not null,
    enabled boolean not null default true
);

create table if not exists public.jbs_print_jobs (
    id uuid primary key default gen_random_uuid(),
    order_id text not null unique,
    status text not null default 'queued',
    claimed_by text,
    lease_until timestamptz,
    attempts integer not null default 0,
    error_message text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

alter table public.jbs_print_jobs drop constraint if exists jbs_print_jobs_status_check;
alter table public.jbs_print_jobs
    add constraint jbs_print_jobs_status_check
    check (status in ('queued', 'processing', 'printed', 'failed', 'ignored'));

create index if not exists jbs_print_jobs_claim_idx
    on public.jbs_print_jobs (status, lease_until, created_at);

alter table public.jbs_print_agents enable row level security;
alter table public.jbs_print_jobs enable row level security;
revoke all on public.jbs_print_agents, public.jbs_print_jobs from anon, authenticated;

-- Limpa trabalhos antigos/travados na fila (como tentativas de Bluetooth do Totem que travaram a fila)
update public.jbs_print_jobs
set status = 'ignored',
    completed_at = now(),
    lease_until = null,
    error_message = 'Fila destravada pela atualizacao'
where status in ('queued', 'processing');

-- ============================================================================
-- 1. IDENTIFICAÇÃO DE ORIGEM E GATILHOS PARA PUBLIC.ORDERS (HERO'S / MESAS / TOTEM)
-- ============================================================================
create or replace function public.jbs_tag_totem_origin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    v_payment text := lower(btrim(coalesce(new.payment_method, '')));
    v_cashier text := btrim(coalesce(new.cashier_name, ''));
    v_origin text := lower(btrim(coalesce(new.origin, '')));
    v_name text := lower(btrim(coalesce(new.customer_name, '')));
    v_address text := btrim(coalesce(new.customer_address, ''));
begin
    -- Pedidos lançados pelo operador no Caixa permanecem sem origin de fila automática
    if v_cashier <> '' and v_origin <> 'totem' then
        return new;
    end if;

    if v_origin = '' then
        if left(v_payment, 7) = 'online_' or v_address <> '' then
            new.origin := 'online';
        elsif v_payment = 'mesa' or left(v_name, 5) = 'mesa ' then
            new.origin := 'mesa';
        elsif v_cashier = '' then
            new.origin := 'totem';
        end if;
    end if;

    if lower(btrim(coalesce(new.origin, ''))) = 'totem' then
        new.printer_target := coalesce(nullif(btrim(new.printer_target), ''), 'totem_01');
    elsif lower(btrim(coalesce(new.printer_target, ''))) = 'totem_01' then
        new.printer_target := null;
    end if;

    return new;
end;
$$;

drop trigger if exists jbs_tag_totem_origin_before_insert on public.orders;
create trigger jbs_tag_totem_origin_before_insert
    before insert on public.orders
    for each row execute function public.jbs_tag_totem_origin();

create or replace function public.jbs_enqueue_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_payment_method text := lower(btrim(coalesce(to_jsonb(new)->>'payment_method', '')));
    v_cashier_name text := btrim(coalesce(to_jsonb(new)->>'cashier_name', ''));
    v_origin text := lower(btrim(coalesce(to_jsonb(new)->>'origin', '')));
    v_customer_name text := lower(btrim(coalesce(to_jsonb(new)->>'customer_name', '')));
begin
    -- Vendas do Caixa (com operador) não entram na fila automática (exceto se explicitamente totem)
    if v_cashier_name <> '' and v_origin <> 'totem' then
        return new;
    end if;

    -- Enfileira automaticamente: Cardápio Online, Mesas e Totem
    if left(v_payment_method, 7) <> 'online_'
       and v_payment_method not in ('mesa', 'totem')
       and left(v_customer_name, 5) <> 'mesa '
       and v_origin not in ('totem', 'mesa', 'online', 'cardapio_online') then
        return new;
    end if;

    insert into public.jbs_print_jobs (order_id)
    values (new.id::text)
    on conflict (order_id) do nothing;

    return new;
end;
$$;

drop trigger if exists jbs_enqueue_order_after_insert on public.orders;
create trigger jbs_enqueue_order_after_insert
    after insert on public.orders
    for each row execute function public.jbs_enqueue_order();

-- ============================================================================
-- 2. FORMATAÇÃO E GATILHO PARA PUBLIC.ACAI_ORDERS (CARDÁPIO ONLINE AÇAÍ)
-- ============================================================================
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
        'payment_method', coalesce(nullif(v_payment, ''), 'online_pix'),
        'origin', 'online',
        'change_amount', p_order.change_amount,
        'observation', p_order.observation,
        'status', p_order.status,
        'total', p_order.total,
        'items', v_items,
        'source', 'acai'
    );
end;
$$;

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

-- ============================================================================
-- 3. CONSUMO DA FILA PELO JBS PRINT (PRIORIZA ONLINE/MESA/AÇAÍ E NÃO TRAVA NO BLUETOOTH)
-- ============================================================================
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
    v_payment text;
    v_origin text;
    v_name text;
    v_addr text;
begin
    if not exists (
        select 1 from public.jbs_print_agents a
        where a.agent_id = p_agent_id
          and a.enabled
          and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    ) then
        raise exception 'invalid agent credentials' using errcode = '42501';
    end if;

    -- 1) Se algum trabalho ficou preso em 'processing' além do tempo limite (ex: falha de Bluetooth no Totem),
    -- encerra como 'failed' para nunca bloquear os novos pedidos de Cardápio Online, Mesa e Açaí.
    update public.jbs_print_jobs
    set status = 'failed',
        error_message = coalesce(error_message, 'Tempo limite de conexao com a impressora excedido.'),
        completed_at = now(),
        lease_until = null
    where status = 'processing'
      and lease_until < now();

    -- 2) Busca o próximo trabalho válido na fila, priorizando Online, Mesa e Açaí antes de Totem
    loop
        select j.* into v_job
        from public.jbs_print_jobs j
        left join public.orders o on o.id::text = j.order_id
        left join public.acai_orders ao on ao.id::text = j.order_id
        where j.status = 'queued'
        order by
            case
                when ao.id is not null then 0
                when lower(coalesce(o.payment_method, '')) like 'online_%' then 0
                when lower(coalesce(o.payment_method, '')) = 'mesa' then 0
                when lower(coalesce(o.origin, '')) in ('online', 'cardapio_online', 'mesa') then 0
                when lower(coalesce(o.customer_name, '')) like 'mesa %' then 0
                else 1
            end asc,
            j.created_at asc
        limit 1
        for update of j skip locked;

        if not found then
            return null;
        end if;

        v_order := null;

        select to_jsonb(o) into v_order
        from public.orders o
        where o.id::text = v_job.order_id;

        if v_order is not null then
            -- Garante que origin esteja sempre normalizado para o JBS Print saber a impressora correta:
            -- 'online' e 'mesa' -> Impressora Padrão (loja); 'totem' -> Impressora Totem
            v_payment := lower(btrim(coalesce(v_order->>'payment_method', '')));
            v_origin := lower(btrim(coalesce(v_order->>'origin', '')));
            v_name := lower(btrim(coalesce(v_order->>'customer_name', '')));
            v_addr := btrim(coalesce(v_order->>'customer_address', ''));

            if left(v_payment, 7) = 'online_' or v_origin in ('online', 'cardapio_online') or (btrim(coalesce(v_order->>'cashier_name', '')) = '' and v_addr <> '') then
                v_order := (v_order - 'printer_target') || jsonb_build_object(
                    'origin', 'online',
                    'printer_target', case
                        when lower(btrim(coalesce(v_order->>'printer_target', ''))) in ('', 'totem_01') then null
                        else btrim(v_order->>'printer_target')
                    end
                );
            elsif v_payment = 'mesa' or v_origin = 'mesa' or left(v_name, 5) = 'mesa ' then
                v_order := (v_order - 'printer_target') || jsonb_build_object(
                    'origin', 'mesa',
                    'printer_target', case
                        when lower(btrim(coalesce(v_order->>'printer_target', ''))) in ('', 'totem_01') then null
                        else btrim(v_order->>'printer_target')
                    end
                );
            elsif btrim(coalesce(v_order->>'cashier_name', '')) = '' then
                v_order := v_order || jsonb_build_object(
                    'origin', 'totem',
                    'printer_target', coalesce(nullif(btrim(v_order->>'printer_target'), ''), 'totem_01')
                );
            end if;
        else
            select * into v_acai_order
            from public.acai_orders ao
            where ao.id::text = v_job.order_id;

            if found then
                v_order := public.format_acai_order_for_print(v_acai_order);
            end if;
        end if;

        -- Se o pedido foi excluído do banco, marca como ignorado e passa imediatamente para o próximo da fila
        if v_order is null then
            update public.jbs_print_jobs
            set status = 'ignored',
                completed_at = now(),
                lease_until = null,
                error_message = 'Pedido removido antes da impressao'
            where id = v_job.id;
        else
            update public.jbs_print_jobs
            set status = 'processing',
                claimed_by = p_agent_id,
                lease_until = now() + interval '3 minutes',
                attempts = attempts + 1,
                error_message = null
            where id = v_job.id
            returning * into v_job;

            return jsonb_build_object('job_id', v_job.id, 'order', v_order);
        end if;
    end loop;
end;
$$;

create or replace function public.jbs_complete_print_job(
    p_agent_id text, p_token text, p_job_id uuid, p_status text, p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if p_status is null or p_status not in ('printed', 'failed') then
        raise exception 'invalid status';
    end if;
    if not exists (
        select 1 from public.jbs_print_agents a
        where a.agent_id = p_agent_id
          and a.enabled
          and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    ) then
        raise exception 'invalid agent credentials' using errcode = '42501';
    end if;

    update public.jbs_print_jobs
    set status = p_status,
        error_message = case when p_status = 'failed' then left(p_error, 1000) else null end,
        completed_at = now(),
        lease_until = null
    where id = p_job_id
      and claimed_by = p_agent_id
      and status in ('processing', 'failed');

    return found;
end;
$$;

create or replace function public.jbs_skip_queued_print_jobs(p_agent_id text, p_token text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_count integer;
begin
    if not exists (
        select 1 from public.jbs_print_agents a
        where a.agent_id = p_agent_id
          and a.enabled
          and a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    ) then
        raise exception 'invalid agent credentials' using errcode = '42501';
    end if;

    update public.jbs_print_jobs
    set status = 'ignored',
        completed_at = now(),
        lease_until = null
    where status in ('queued', 'processing');

    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.jbs_claim_print_job(text, text) from public;
revoke all on function public.jbs_complete_print_job(text, text, uuid, text, text) from public;
revoke all on function public.jbs_skip_queued_print_jobs(text, text) from public;
grant execute on function public.jbs_claim_print_job(text, text) to anon, authenticated;
grant execute on function public.jbs_complete_print_job(text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.jbs_skip_queued_print_jobs(text, text) to anon, authenticated;

-- ============================================================================
-- 4. RECIBOS DO DIA (/entregas): INCLUI CARDÁPIO HERO'S, MESAS E AÇAÍ
-- ============================================================================
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

    with combined as (
        select
            o.id::text as id,
            o.order_number,
            o.status,
            o.total,
            o.created_at
        from public.orders o
        where o.created_at >= v_today_start
          and o.created_at < v_today_start + interval '1 day'

        union all

        select
            ao.id::text as id,
            ao.order_number,
            ao.status,
            ao.total,
            ao.created_at
        from public.acai_orders ao
        where ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'order_number', c.order_number,
                'status', c.status,
                'total', c.total,
                'created_at', c.created_at
            ) order by c.created_at desc
        ),
        '[]'::jsonb
    ) into v_orders
    from combined c;

    return v_orders;
end;
$$;

revoke all on function public.list_delivery_orders_today() from public;
grant execute on function public.list_delivery_orders_today() to anon, authenticated;

create or replace function public.get_today_order_details(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_order jsonb;
    v_acai_order public.acai_orders%rowtype;
    v_formatted_acai jsonb;
begin
    v_today_start := date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo';

    select jsonb_build_object(
        'order_number', o.order_number,
        'status', o.status,
        'total', o.total,
        'created_at', o.created_at,
        'customer_name', o.customer_name,
        'customer_phone', o.customer_phone,
        'customer_address', o.customer_address,
        'payment_method', o.payment_method,
        'change_amount', o.change_amount,
        'observation', o.observation,
        'items', coalesce(o.items, '[]'::jsonb)
    ) into v_order
    from public.orders o
    where o.id::text = btrim(coalesce(p_order_id, ''))
      and o.created_at >= v_today_start
      and o.created_at < v_today_start + interval '1 day'
    limit 1;

    if v_order is null then
        select * into v_acai_order
        from public.acai_orders ao
        where ao.id::text = btrim(coalesce(p_order_id, ''))
          and ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
        limit 1;

        if found then
            v_formatted_acai := public.format_acai_order_for_print(v_acai_order);
            v_order := jsonb_build_object(
                'order_number', v_formatted_acai->>'order_number',
                'status', v_formatted_acai->>'status',
                'total', v_acai_order.total,
                'created_at', v_acai_order.created_at,
                'customer_name', v_formatted_acai->>'customer_name',
                'customer_phone', v_formatted_acai->>'customer_phone',
                'customer_address', v_formatted_acai->>'customer_address',
                'payment_method', v_formatted_acai->>'payment_method',
                'change_amount', v_acai_order.change_amount,
                'observation', v_formatted_acai->>'observation',
                'items', coalesce(v_formatted_acai->'items', '[]'::jsonb)
            );
        end if;
    end if;

    return v_order;
end;
$$;

revoke all on function public.get_today_order_details(text) from public;
grant execute on function public.get_today_order_details(text) to anon, authenticated;

notify pgrst, 'reload schema';

