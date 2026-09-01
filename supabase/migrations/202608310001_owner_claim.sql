create or replace function public.claim_owner_token(
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
    raise exception 'invalid owner claim input';
  end if;

  update public.participant_claim_tokens
  set consumed_at = request_created_at
  where participant_claim_tokens.participant_id = 'daekyeom'
    and participant_claim_tokens.token_hash = request_token_hash
    and participant_claim_tokens.consumed_at is null
    and exists (
      select 1 from public.participants
      where participants.id = 'daekyeom' and participants.role = 'admin'
    )
  returning participant_claim_tokens.participant_id into claimed_participant_id;

  if claimed_participant_id is null then return; end if;

  delete from public.sessions where sessions.participant_id = claimed_participant_id;
  insert into public.sessions (id, participant_id, token_hash, created_at, expires_at)
  values (request_session_id, claimed_participant_id, request_session_token_hash, request_created_at, request_expires_at);

  return query
    select participants.id, participants.role
    from public.participants
    where participants.id = claimed_participant_id;
end;
$$;

revoke all on function public.claim_owner_token(text, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_owner_token(text, uuid, text, timestamptz, timestamptz) to service_role;
