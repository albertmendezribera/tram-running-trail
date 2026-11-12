-- Checks the schema does what it says. Run with psql -v ON_ERROR_STOP=1 after the migrations.
-- Everything happens in a transaction that is rolled back: it leaves no rows.
begin;

insert into brands (id, slug, name) values ('00000000-0000-0000-0000-000000000001', 'marca-de-prova', 'Marca de prova');
insert into shoes (id, brand_id, slug, model, terrain, category, is_placeholder)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'real', 'Real', 'trail', 'technical', false),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'placeholder', 'Placeholder', 'road', 'daily', true);
insert into shoe_specs (shoe_id, size_ref, stack_heel_mm, stack_forefoot_mm, source)
values
  ('00000000-0000-0000-0000-000000000011', 'EU 42', 32.5, 26.5, 'lab'),
  ('00000000-0000-0000-0000-000000000012', 'EU 42', null, null, 'manufacturer');

insert into routes (id, slug, geom, source)
values ('00000000-0000-0000-0000-000000000021', 'ruta', 'SRID=4326;LINESTRING Z (3.08 41.86 23, 3.09 41.87 120)', 'gpx');
insert into route_pois (route_id, km, kind) values ('00000000-0000-0000-0000-000000000021', 5.2, 'summit');
insert into races (id, slug, name, terrain, country_code, source, is_placeholder)
values
  ('00000000-0000-0000-0000-000000000031', 'cursa', 'Cursa', 'trail', 'ES', 'organizer', false),
  ('00000000-0000-0000-0000-000000000032', 'cursa-de-mostra', 'Cursa de mostra', 'road', 'ES', 'editorial', true);
insert into race_editions (id, race_id, year, start_date, status)
values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031', 2027, '2027-03-14', 'scheduled'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000032', 2027, '2027-04-11', 'scheduled');
insert into race_courses (edition_id, name, distance_m, route_id)
values ('00000000-0000-0000-0000-000000000041', '12 km', 12410, '00000000-0000-0000-0000-000000000021');

do $$
declare
  n int;
begin
  -- The drop is computed, and stays null when a stack is missing: nothing is estimated.
  if (select drop_mm from shoe_specs where shoe_id = '00000000-0000-0000-0000-000000000011') <> 6.0 then raise exception 'drop_mm is not heel minus forefoot'; end if;
  if (select drop_mm from shoe_specs where shoe_id = '00000000-0000-0000-0000-000000000012') is not null then raise exception 'drop_mm was invented for a shoe without stacks'; end if;

  -- Geometry is native: PostGIS measures the route.
  if (select st_length(geom) from routes where slug = 'ruta') not between 1000 and 2000 then raise exception 'route length is off'; end if;

  -- Unknown values are refused.
  begin
    insert into race_editions (race_id, year, start_date, status) values ('00000000-0000-0000-0000-000000000031', 2028, '2028-03-12', 'maybe');
    raise exception 'an unknown status was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into route_pois (route_id, km, kind) values ('00000000-0000-0000-0000-000000000021', 1, 'photo_spot');
    raise exception 'an unknown kind of point was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into race_courses (edition_id, name, distance_m) values ('00000000-0000-0000-0000-000000000041', 'zero', 0);
    raise exception 'a course without distance was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into race_editions (race_id, year, start_date, status) values ('00000000-0000-0000-0000-000000000031', 2027, '2027-03-15', 'scheduled');
    raise exception 'two editions of the same year were accepted';
  exception when unique_violation then null;
  end;

  -- The public role reads real rows only: placeholders cannot reach the site.
  set local role anon;
  select count(*) into n from shoes;
  if n <> 1 then raise exception 'anon sees % shoes, expected the real one only', n; end if;
  select count(*) into n from shoe_specs;
  if n <> 1 then raise exception 'anon sees % spec sheets, expected 1', n; end if;
  select count(*) into n from races;
  if n <> 1 then raise exception 'anon sees % races, expected 1', n; end if;
  select count(*) into n from race_editions;
  if n <> 1 then raise exception 'anon sees % editions, expected 1', n; end if;
  select count(*) into n from race_courses;
  if n <> 1 then raise exception 'anon sees % courses, expected 1', n; end if;
  begin
    insert into brands (slug, name) values ('intrusa', 'Intrusa');
    raise exception 'anon could write';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;
