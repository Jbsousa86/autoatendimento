-- The receipt details RPC reads this optional field.
alter table public.orders add column if not exists observation text;

notify pgrst, 'reload schema';
