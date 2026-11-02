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
            ao.created_at
        from public.acai_orders ao
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
                'created_at', c.created_at
            ) order by c.created_at desc
        ),
        '[]'::jsonb
    ) into v_orders
    from combined c;

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
    v_order jsonb;
    v_acai_order public.acai_orders%rowtype;
    v_formatted_acai jsonb;
begin
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

revoke all on function public.list_delivery_orders_today() from public;
revoke all on function public.get_today_order_details(text) from public;
grant execute on function public.list_delivery_orders_today() to anon, authenticated;
grant execute on function public.get_today_order_details(text) to anon, authenticated;

notify pgrst, 'reload schema';
