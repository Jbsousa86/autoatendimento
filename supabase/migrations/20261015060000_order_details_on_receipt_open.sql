-- Include an opaque row id in the summary so a receipt can open exact order details.
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
        'id', o.id::text,
        'order_number', o.order_number,
        'status', o.status,
        'total', o.total,
        'created_at', o.created_at
      ) order by o.created_at desc
    ),
    '[]'::jsonb
  ) into v_orders
  from public.orders o
  where o.created_at >= v_today_start
    and o.created_at < v_today_start + interval '1 day';

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

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'customer_address', v_order.customer_address,
    'items', v_order.items,
    'total', v_order.total,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'observation', v_order.observation,
    'created_at', v_order.created_at
  );
end;
$$;

revoke all on function public.list_delivery_orders_today() from public;
revoke all on function public.get_today_order_details(text) from public;
grant execute on function public.list_delivery_orders_today() to anon, authenticated;
grant execute on function public.get_today_order_details(text) to anon, authenticated;
