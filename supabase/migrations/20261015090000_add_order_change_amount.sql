-- Store the amount tendered for cash orders so cashier reprints can show the change.
alter table public.orders
  add column if not exists change_amount numeric(10, 2);
