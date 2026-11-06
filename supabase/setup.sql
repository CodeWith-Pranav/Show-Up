-- Run in the SQL editor of the Supabase project dedicated to Show Up.
begin;

create schema if not exists show_up_private;
revoke all on schema show_up_private from public;
grant usage on schema show_up_private to anon, authenticated;

create table public.show_up_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('habit','log','checkin','plan','quest','review','prefs')),
  id text not null check (id ~ '^[A-Za-z0-9_.-]{1,150}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 12000),
  updated_at timestamptz not null check (updated_at <= statement_timestamp() + interval '10 minutes'),
  deleted boolean not null default false,
  primary key(user_id, kind, id)
);
revoke all on public.show_up_records from public, anon, authenticated;
grant select, insert, update on public.show_up_records to authenticated;
alter table public.show_up_records enable row level security;
create policy show_up_select on public.show_up_records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy show_up_insert on public.show_up_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy show_up_update on public.show_up_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function show_up_private.accept_latest()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.updated_at < old.updated_at
    or (new.updated_at = old.updated_at and old.deleted and not new.deleted) then
    return old;
  end if;
  return new;
end;
$$;
create trigger accept_latest before update on public.show_up_records
  for each row execute function show_up_private.accept_latest();

-- A capability link is a UUID. Shared queries expose only these plan fields.
create unique index show_up_invite_idx on public.show_up_records ((data->>'invite'))
  where kind = 'plan' and not deleted and coalesce(data->>'invite','') <> '';

create table show_up_private.rsvps (
  token uuid not null,
  occurrence date not null,
  guest uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  response text not null check (response in ('going','maybe','no')),
  primary key(token, occurrence, guest)
);
alter table show_up_private.rsvps enable row level security;
revoke all on show_up_private.rsvps from public, anon, authenticated;

create function show_up_private.find_invite(token uuid, occurrence date)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  plan jsonb;
  plan_date date;
begin
  select data into plan from public.show_up_records
    where kind = 'plan' and not deleted and coalesce(data->>'invite','') <> ''
      and data->>'invite' = token::text;
  if plan is null or occurrence is null then return null; end if;
  begin
    plan_date := (plan->>'date')::date;
    if plan_date is null or (plan->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or plan->>'time' is null then return null; end if;
  exception when datetime_field_overflow or invalid_datetime_format then
    return null;
  end;
  if occurrence = plan_date or
      (plan->>'repeat' = 'true' and occurrence > plan_date and (occurrence - plan_date) % 7 = 0) then
    return plan;
  end if;
  return null;
end;
$$;

create function show_up_private.invite_details(token uuid, occurrence date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare plan jsonb := show_up_private.find_invite(token, occurrence);
begin
  if plan is null then return null; end if;
  return jsonb_build_object('title',plan->>'title','place',plan->>'place',
    'time',plan->>'time','note',plan->>'note','responses',
    coalesce((select jsonb_agg(jsonb_build_object('name',r.name,'response',r.response)
        order by r.name, r.guest)
      from show_up_private.rsvps r
      where r.token = invite_details.token and r.occurrence = invite_details.occurrence),
      '[]'::jsonb));
end;
$$;

create function show_up_private.save_rsvp(token uuid, occurrence date, guest uuid, display_name text, answer text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if token is null or occurrence is null or guest is null or display_name is null or answer is null
      or char_length(trim(display_name)) not between 1 and 60
      or answer not in ('going','maybe','no') then raise exception 'Invalid RSVP'; end if;
  perform pg_advisory_xact_lock(hashtextextended(token::text || occurrence::text, 0));
  if show_up_private.find_invite(token, occurrence) is null then raise exception 'Invite not found'; end if;
  if (select count(*) from show_up_private.rsvps r
      where r.token = save_rsvp.token and r.occurrence = save_rsvp.occurrence and r.guest <> save_rsvp.guest) >= 100
    then raise exception 'This RSVP list is full'; end if;
  insert into show_up_private.rsvps(token, occurrence, guest, name, response)
    values (save_rsvp.token, save_rsvp.occurrence, save_rsvp.guest, trim(display_name), answer)
    on conflict on constraint rsvps_pkey do update set name = excluded.name, response = excluded.response;
  return true;
end;
$$;

revoke all on all functions in schema show_up_private from public, anon, authenticated;
grant execute on function show_up_private.invite_details(uuid,date) to anon, authenticated;
grant execute on function show_up_private.save_rsvp(uuid,date,uuid,text,text) to anon, authenticated;

create function public.show_up_get_invite(token uuid, occurrence date)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select show_up_private.invite_details(token, occurrence) $$;
create function public.show_up_submit_rsvp(token uuid, occurrence date, guest uuid, display_name text, answer text)
returns boolean language sql security invoker set search_path = ''
as $$ select show_up_private.save_rsvp(token, occurrence, guest, display_name, answer) $$;
revoke all on function public.show_up_get_invite(uuid,date) from public, anon, authenticated;
revoke all on function public.show_up_submit_rsvp(uuid,date,uuid,text,text) from public, anon, authenticated;
grant execute on function public.show_up_get_invite(uuid,date) to anon, authenticated;
grant execute on function public.show_up_submit_rsvp(uuid,date,uuid,text,text) to anon, authenticated;

commit;
