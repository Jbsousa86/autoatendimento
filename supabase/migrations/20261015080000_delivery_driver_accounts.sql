create table if not exists public.delivery_drivers (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) > 0),
    username text not null unique check (username = lower(trim(username)) and length(username) >= 3),
    password_hash text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.delivery_drivers enable row level security;
revoke all on public.delivery_drivers from anon, authenticated;

create or replace function public.list_delivery_drivers()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
    select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'name', name, 'username', username, 'is_active', is_active) order by name),
        '[]'::jsonb
    )
    from public.delivery_drivers;
$$;

create or replace function public.create_delivery_driver(p_name text, p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    normalized_username text := lower(trim(coalesce(p_username, '')));
begin
    if length(trim(coalesce(p_name, ''))) = 0 then
        raise exception 'Nome é obrigatório';
    end if;
    if length(normalized_username) < 3 or normalized_username !~ '^[a-z0-9._-]+$' then
        raise exception 'Usuário inválido';
    end if;
    if length(coalesce(p_password, '')) < 6 then
        raise exception 'A senha deve ter pelo menos 6 caracteres';
    end if;

    insert into public.delivery_drivers (name, username, password_hash)
    values (trim(p_name), normalized_username, extensions.crypt(p_password, extensions.gen_salt('bf')));
end;
$$;

create or replace function public.delete_delivery_driver(p_driver_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    deleted_count integer;
begin
    delete from public.delivery_drivers where id = p_driver_id;
    get diagnostics deleted_count = row_count;
    return deleted_count > 0;
end;
$$;

create or replace function public.login_delivery_driver(p_username text, p_password text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
    select jsonb_build_object('id', id, 'name', name, 'username', username)
    from public.delivery_drivers
    where username = lower(trim(coalesce(p_username, '')))
      and is_active
      and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)
    limit 1;
$$;

revoke all on function public.list_delivery_drivers() from public;
revoke all on function public.create_delivery_driver(text, text, text) from public;
revoke all on function public.delete_delivery_driver(uuid) from public;
revoke all on function public.login_delivery_driver(text, text) from public;

grant execute on function public.list_delivery_drivers() to anon, authenticated;
grant execute on function public.create_delivery_driver(text, text, text) to anon, authenticated;
grant execute on function public.delete_delivery_driver(uuid) to anon, authenticated;
grant execute on function public.login_delivery_driver(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
