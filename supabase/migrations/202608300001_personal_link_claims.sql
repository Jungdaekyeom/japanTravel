alter table public.participants alter column code_salt drop not null;
alter table public.participants alter column code_hash drop not null;

create table public.participant_claim_tokens (
  participant_id text primary key references public.participants(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  consumed_at timestamptz,
  check (consumed_at is null or consumed_at >= issued_at)
);

alter table public.participant_claim_tokens enable row level security;

revoke all on table public.participant_claim_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.participant_claim_tokens to service_role;

create or replace function public.claim_participant_token(
  request_token_hash text,
  request_session_id uuid,
  request_session_token_hash text,
  request_created_at timestamptz,
  request_expires_at timestamptz
)
returns table(participant_id text, participant_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_participant_id text;
begin
  if request_token_hash !~ '^[0-9a-f]{64}$'
    or request_session_token_hash !~ '^[0-9a-f]{64}$'
    or request_expires_at <= request_created_at then
    raise exception 'invalid claim input';
  end if;

  update public.participant_claim_tokens
  set consumed_at = request_created_at
  where token_hash = request_token_hash and consumed_at is null
  returning participant_claim_tokens.participant_id into claimed_participant_id;

  if claimed_participant_id is null then return; end if;

  insert into public.sessions (id, participant_id, token_hash, created_at, expires_at)
  values (request_session_id, claimed_participant_id, request_session_token_hash, request_created_at, request_expires_at);

  return query
    select participants.id, participants.role
    from public.participants
    where participants.id = claimed_participant_id;
end;
$$;

revoke all on function public.claim_participant_token(text, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_participant_token(text, uuid, text, timestamptz, timestamptz) to service_role;
