-- Allows a delivery driver to look up only a matching delivery order.
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_address text;

create or replace function public.track_delivery_order(
  p_order_number text,
  p_phone_last4 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_order_number is null or btrim(p_order_number) = ''
     or p_phone_last4 is null or p_phone_last4 !~ '^\d{4}$' then
    return null;
  end if;

  select o.* into v_order
  from public.orders o
  where o.order_number::text = btrim(p_order_number)
    and o.customer_address is not null
    and right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 4) = p_phone_last4
  order by o.created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', v_order.status,
    'customer_name', v_order.customer_name,
    'customer_address', v_order.customer_address,
    'customer_phone', v_order.customer_phone,
    'items', v_order.items,
    'created_at', v_order.created_at
  );
end;
$$;

revoke all on function public.track_delivery_order(text, text) from public;
grant execute on function public.track_delivery_order(text, text) to anon, authenticated;
