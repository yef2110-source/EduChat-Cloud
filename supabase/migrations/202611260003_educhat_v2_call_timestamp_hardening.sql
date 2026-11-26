-- Server-owned call timestamps and reject same-status mutations.
-- Apply after 202611260002_educhat_v2_call_transition_guard.sql.
begin;

create or replace function public.educhat_v2_validate_call_update()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or actor not in (old.caller_id, old.callee_id) then
    raise exception 'Only authenticated call participants may update a call';
  end if;

  if new.caller_id is distinct from old.caller_id
    or new.callee_id is distinct from old.callee_id
    or new.call_type is distinct from old.call_type
    or new.room_name is distinct from old.room_name
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'Call identity fields are immutable';
  end if;

  -- Clients may not write server-maintained timestamps directly.
  if new.answered_at is distinct from old.answered_at
    or new.ended_at is distinct from old.ended_at then
    raise exception 'Call timestamps are server-controlled';
  end if;

  if new.status is not distinct from old.status then
    raise exception 'Call updates must perform a valid status transition';
  end if;

  if old.status='invited' then
    if actor=old.callee_id and new.status not in ('ringing','declined','busy','failed') then
      raise exception 'Invalid recipient transition';
    elsif actor=old.caller_id and new.status not in ('no_answer','failed','ended') then
      raise exception 'Invalid caller transition';
    end if;
  elsif old.status='ringing' then
    if actor=old.callee_id and new.status not in ('answered','declined','busy','failed') then
      raise exception 'Invalid recipient transition';
    elsif actor=old.caller_id and new.status not in ('no_answer','failed','ended') then
      raise exception 'Invalid caller transition';
    end if;
  elsif old.status='answered' then
    if new.status <> 'ended' then
      raise exception 'Answered call may only be ended';
    end if;
  else
    raise exception 'Call already resolved';
  end if;

  if new.status='no_answer' and (actor<>old.caller_id or now()<old.expires_at) then
    raise exception 'No-answer may only be set by caller after expiry';
  end if;

  if new.status='answered' then
    new.answered_at=now();
  end if;
  if new.status in ('declined','busy','no_answer','failed','ended') then
    new.ended_at=now();
  end if;
  new.updated_at=now();
  return new;
end;
$$;

commit;
