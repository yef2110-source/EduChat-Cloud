-- EduChat V2 call signaling (client Supabase Auth + Realtime)
-- Apply AFTER EduChatCloud_v2_secure_foundation.sql. No service_role in browser.
begin;

create table if not exists public.educhat_v2_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio','video')),
  status text not null default 'invited'
    check (status in ('invited','ringing','answered','declined','busy','no_answer','failed','ended')),
  room_name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  check (caller_id <> callee_id),
  check (char_length(room_name) between 12 and 128)
);
create index if not exists educhat_v2_calls_callee_live_idx
  on public.educhat_v2_calls(callee_id,status,created_at desc);
create index if not exists educhat_v2_calls_caller_live_idx
  on public.educhat_v2_calls(caller_id,status,created_at desc);

alter table public.educhat_v2_calls enable row level security;
drop policy if exists "v2 call participants read" on public.educhat_v2_calls;
create policy "v2 call participants read" on public.educhat_v2_calls
  for select to authenticated using (caller_id=auth.uid() or callee_id=auth.uid());

drop policy if exists "v2 caller create call" on public.educhat_v2_calls;
create policy "v2 caller create call" on public.educhat_v2_calls
  for insert to authenticated with check (
    caller_id=auth.uid() and callee_id<>auth.uid() and status='invited'
    and expires_at > now() and expires_at <= now()+interval '60 seconds'
    and exists (
      select 1 from public.educhat_v2_friendships f
      where f.user_low=least(caller_id,callee_id) and f.user_high=greatest(caller_id,callee_id)
    )
  );

drop policy if exists "v2 callee and caller update call status" on public.educhat_v2_calls;
create policy "v2 callee and caller update call status" on public.educhat_v2_calls
  for update to authenticated
  using (caller_id=auth.uid() or callee_id=auth.uid())
  with check (caller_id=auth.uid() or callee_id=auth.uid());

create or replace function public.educhat_v2_validate_call_update()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.caller_id is distinct from old.caller_id
    or new.callee_id is distinct from old.callee_id
    or new.call_type is distinct from old.call_type
    or new.room_name is distinct from old.room_name
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'Call identity fields are immutable';
  end if;

  if old.status <> 'invited' and old.status <> 'ringing' and new.status <> old.status then
    raise exception 'Call is already resolved';
  end if;
  if old.status='invited' and new.status='ringing' and auth.uid() <> old.callee_id then
    raise exception 'Only recipient device can acknowledge ringing';
  end if;
  if old.status in ('invited','ringing') and new.status in ('answered','declined','busy','no_answer','failed') and auth.uid() <> old.callee_id and new.status not in ('no_answer','failed') then
    raise exception 'Only recipient can respond to an incoming call';
  end if;
  if new.status='ended' and auth.uid() not in (old.caller_id,old.callee_id) then
    raise exception 'Only participants can end a call';
  end if;
  if new.status='answered' and old.status in ('invited','ringing') and new.answered_at is null then
    new.answered_at=now();
  end if;
  if new.status in ('declined','busy','no_answer','failed','ended') and new.ended_at is null then
    new.ended_at=now();
  end if;
  new.updated_at=now();
  return new;
end; $$;
drop trigger if exists educhat_v2_calls_validate on public.educhat_v2_calls;
create trigger educhat_v2_calls_validate before update on public.educhat_v2_calls
for each row execute function public.educhat_v2_validate_call_update();

-- Add calls to Supabase Realtime publication if it exists and the table is not already present.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='educhat_v2_calls') then
    alter publication supabase_realtime add table public.educhat_v2_calls;
  end if;
end $$;

commit;
