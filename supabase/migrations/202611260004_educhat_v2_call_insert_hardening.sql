-- Harden call inserts: enforce Auth participant identity and server-owned timestamps.
-- Apply after the three call-signaling migrations.
begin;

create or replace function public.educhat_v2_validate_call_insert()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  server_now timestamptz := now();
begin
  if actor is null or new.caller_id is distinct from actor then
    raise exception 'Only the authenticated caller may create a call';
  end if;
  if new.callee_id is null or new.callee_id = actor then
    raise exception 'Invalid call recipient';
  end if;
  if new.call_type not in ('audio','video') then
    raise exception 'Invalid call type';
  end if;
  if new.status is distinct from 'invited' then
    raise exception 'Calls must start as invited';
  end if;
  if new.expires_at is null or new.expires_at <= server_now
    or new.expires_at > server_now + interval '60 seconds' then
    raise exception 'Call expiry must be within 60 seconds';
  end if;
  if not exists (
    select 1 from public.educhat_v2_friendships f
    where f.user_low=least(actor,new.callee_id)
      and f.user_high=greatest(actor,new.callee_id)
  ) then
    raise exception 'Calls are allowed only between friends';
  end if;

  -- Ignore any client-supplied timestamps; these are server-controlled.
  new.created_at := server_now;
  new.updated_at := server_now;
  new.answered_at := null;
  new.ended_at := null;
  return new;
end;
$$;

drop trigger if exists educhat_v2_calls_validate_insert on public.educhat_v2_calls;
create trigger educhat_v2_calls_validate_insert
before insert on public.educhat_v2_calls
for each row execute function public.educhat_v2_validate_call_insert();

commit;
