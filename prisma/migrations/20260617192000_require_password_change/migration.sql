alter table public.app_users
add column if not exists "passwordMustChange" boolean not null default false;
