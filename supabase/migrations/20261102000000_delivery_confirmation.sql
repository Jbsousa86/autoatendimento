alter table public.orders
    add column if not exists delivery_status text not null default 'pending'
        check (delivery_status in ('pending', 'delivered')),
    add column if not exists delivered_at timestamptz,
    add column if not exists delivered_by uuid references public.delivery_drivers(id) on delete set null,
    add column if not exists delivered_by_name text;

alter table public.acai_orders
    add column if not exists delivery_status text not null default 'pending'
        check (delivery_status in ('pending', 'delivered')),
    add column if not exists delivered_at timestamptz,
    add column if not exists delivered_by uuid references public.delivery_drivers(id) on delete set null,
    add column if not exists delivered_by_name text;

create table if not exists public.delivery_driver_sessions (
    token_hash text primary key,
    driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.delivery_driver_sessions enable row level security;
revoke all on public.delivery_driver_sessions from public, anon, authenticated;

create or replace function public.login_delivery_driver(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_driver public.delivery_drivers%rowtype;
    v_session_token text;
begin
    select * into v_driver
    from public.delivery_drivers
    where username = lower(trim(coalesce(p_username, '')))
      and is_active
      and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)
    limit 1;

    if not found then
        return null;
    end if;

    v_session_token := gen_random_uuid()::text;

    insert into public.delivery_driver_sessions (token_hash, driver_id, expires_at)
    values (
        encode(extensions.digest(v_session_token, 'sha256'), 'hex'),
        v_driver.id,
        now() + interval '30 days'
    );

    return jsonb_build_object(
        'id', v_driver.id,
        'name', v_driver.name,
        'username', v_driver.username,
        'session_token', v_session_token
    );
end;
$$;

create or replace function public.get_valid_delivery_driver_id(p_session_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
    select s.driver_id
    from public.delivery_driver_sessions s
    join public.delivery_drivers d on d.id = s.driver_id
    where s.token_hash = encode(extensions.digest(coalesce(p_session_token, ''), 'sha256'), 'hex')
      and s.expires_at > now()
      and d.is_active
    limit 1;
$$;

create or replace function public.logout_delivery_driver(p_session_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
    delete from public.delivery_driver_sessions
    where token_hash = encode(extensions.digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
$$;

revoke all on function public.login_delivery_driver(text, text) from public;
revoke all on function public.get_valid_delivery_driver_id(text) from public;
revoke all on function public.logout_delivery_driver(text) from public;
grant execute on function public.login_delivery_driver(text, text) to anon, authenticated;
grant execute on function public.logout_delivery_driver(text) to anon, authenticated;

drop function if exists public.list_delivery_orders_today();
drop function if exists public.get_today_order_details(text);

create function public.list_delivery_orders_today(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_driver_id uuid;
    v_orders jsonb;
begin
    v_driver_id := public.get_valid_delivery_driver_id(p_session_token);
    if v_driver_id is null then
        raise exception 'Sessão de entregador inválida ou expirada';
    end if;

    v_today_start := date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo';

    with combined as (
        select
            o.id::text as id,
            o.order_number,
            o.status,
            o.total,
            o.created_at,
            o.delivery_status,
            o.delivered_at,
            coalesce(o.delivered_by_name, d.name) as delivered_by_name
        from public.orders o
        left join public.delivery_drivers d on d.id = o.delivered_by
        where o.created_at >= v_today_start
          and o.created_at < v_today_start + interval '1 day'
          and nullif(btrim(coalesce(o.customer_address, '')), '') is not null
          and lower(btrim(o.customer_address)) not in (
              'retirada no local',
              'balcão',
              'balcao',
              'venda de balcão (caixa)',
              'venda de balcao (caixa)'
          )

        union all

        select
            ao.id::text as id,
            ao.order_number,
            ao.status,
            ao.total,
            ao.created_at,
            ao.delivery_status,
            ao.delivered_at,
            coalesce(ao.delivered_by_name, d.name) as delivered_by_name
        from public.acai_orders ao
        left join public.delivery_drivers d on d.id = ao.delivered_by
        where ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
          and ao.delivery_type = 'entrega'
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'order_number', c.order_number,
                'status', c.status,
                'total', c.total,
                'created_at', c.created_at,
                'delivery_status', c.delivery_status,
                'delivered_at', c.delivered_at,
                'delivered_by_name', c.delivered_by_name
            ) order by c.created_at desc
        ),
        '[]'::jsonb
    ) into v_orders
    from combined c;

    return v_orders;
end;
$$;

create function public.get_today_order_details(p_order_id text, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_driver_id uuid;
    v_order jsonb;
    v_acai_order public.acai_orders%rowtype;
    v_formatted_acai jsonb;
begin
    v_driver_id := public.get_valid_delivery_driver_id(p_session_token);
    if v_driver_id is null then
        raise exception 'Sessão de entregador inválida ou expirada';
    end if;

    if p_order_id is null or btrim(p_order_id) = '' then
        return null;
    end if;

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
    where o.id::text = btrim(p_order_id)
      and o.created_at >= v_today_start
      and o.created_at < v_today_start + interval '1 day'
      and nullif(btrim(coalesce(o.customer_address, '')), '') is not null
      and lower(btrim(o.customer_address)) not in (
          'retirada no local',
          'balcão',
          'balcao',
          'venda de balcão (caixa)',
          'venda de balcao (caixa)'
      )
    limit 1;

    if v_order is null then
        select * into v_acai_order
        from public.acai_orders ao
        where ao.id::text = btrim(p_order_id)
          and ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
          and ao.delivery_type = 'entrega'
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

create function public.mark_delivery_order_delivered(p_order_id text, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_today_start timestamptz;
    v_driver_id uuid;
    v_driver_name text;
    v_delivered_at timestamptz := now();
    v_order_number text;
begin
    v_driver_id := public.get_valid_delivery_driver_id(p_session_token);
    if v_driver_id is null then
        raise exception 'Sessão de entregador inválida ou expirada';
    end if;
    select name into v_driver_name
    from public.delivery_drivers
    where id = v_driver_id;

    if p_order_id is null or btrim(p_order_id) = '' then
        raise exception 'Pedido inválido';
    end if;

    v_today_start := date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo';

    update public.orders o
    set delivery_status = 'delivered',
        delivered_at = v_delivered_at,
        delivered_by = v_driver_id,
        delivered_by_name = v_driver_name
    where o.id::text = btrim(p_order_id)
      and o.created_at >= v_today_start
      and o.created_at < v_today_start + interval '1 day'
      and o.status in ('ready', 'finished')
      and o.delivery_status = 'pending'
      and nullif(btrim(coalesce(o.customer_address, '')), '') is not null
      and lower(btrim(o.customer_address)) not in (
          'retirada no local',
          'balcão',
          'balcao',
          'venda de balcão (caixa)',
          'venda de balcao (caixa)'
      )
    returning o.order_number::text into v_order_number;

    if not found then
        update public.acai_orders ao
        set delivery_status = 'delivered',
            delivered_at = v_delivered_at,
            delivered_by = v_driver_id,
            delivered_by_name = v_driver_name
        where ao.id::text = btrim(p_order_id)
          and ao.created_at >= v_today_start
          and ao.created_at < v_today_start + interval '1 day'
          and ao.status in ('ready', 'finished')
          and ao.delivery_status = 'pending'
          and ao.delivery_type = 'entrega'
        returning ao.order_number into v_order_number;
    end if;

    if not found then
        raise exception 'Pedido não está pronto para entrega ou já foi entregue';
    end if;

    return jsonb_build_object(
        'order_number', v_order_number,
        'delivery_status', 'delivered',
        'delivered_at', v_delivered_at,
        'delivered_by_name', v_driver_name
    );
end;
$$;

revoke all on function public.list_delivery_orders_today(text) from public;
revoke all on function public.get_today_order_details(text, text) from public;
revoke all on function public.mark_delivery_order_delivered(text, text) from public;
grant execute on function public.list_delivery_orders_today(text) to anon, authenticated;
grant execute on function public.get_today_order_details(text, text) to anon, authenticated;
grant execute on function public.mark_delivery_order_delivered(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
