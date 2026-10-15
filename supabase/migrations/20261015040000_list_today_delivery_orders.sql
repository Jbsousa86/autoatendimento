-- List today's deliveries for the driver without exposing customer contact details.
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
    and o.created_at < v_today_start + interval '1 day'
    and o.customer_address is not null;

  return v_orders;
end;
$$;

revoke all on function public.list_delivery_orders_today() from public;
grant execute on function public.list_delivery_orders_today() to anon, authenticated;
