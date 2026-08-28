do $migration$
declare
  encoded_column_type text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_geometry_cache'
      and column_name = 'geometry'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_geometry_cache'
      and column_name = 'encoded_polyline'
  ) then
    alter table public.route_geometry_cache rename column geometry to encoded_polyline;
  end if;

  alter table public.route_geometry_cache
    drop constraint if exists route_geometry_cache_geometry_check;
  alter table public.route_geometry_cache
    drop constraint if exists route_geometry_cache_encoded_polyline_check;

  select data_type
  into encoded_column_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'route_geometry_cache'
    and column_name = 'encoded_polyline';

  if encoded_column_type = 'jsonb' then
    -- The legacy JSON array cache predates verified Google rail polylines, so it is safely invalidated.
    delete from public.route_geometry_cache;
    alter table public.route_geometry_cache alter column encoded_polyline drop default;
    alter table public.route_geometry_cache
      alter column encoded_polyline type text using encoded_polyline::text;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.route_geometry_cache'::regclass
      and conname = 'route_geometry_cache_encoded_polyline_length'
  ) then
    alter table public.route_geometry_cache
      add constraint route_geometry_cache_encoded_polyline_length
      check (char_length(encoded_polyline) between 1 and 100000) not valid;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.route_geometry_cache'::regclass
      and conname = 'route_geometry_cache_encoded_polyline_length'
      and not convalidated
  ) then
    alter table public.route_geometry_cache
      validate constraint route_geometry_cache_encoded_polyline_length;
  end if;
end;
$migration$;
