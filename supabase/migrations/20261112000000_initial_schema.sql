-- TRAM · initial schema (CLAUDE.md section 5).
--
-- Principles kept from the sketch:
--   · every figure says where it comes from (`source`);
--   · geometry is native (PostGIS geography), not coordinates in text;
--   · development placeholders are marked (`is_placeholder`) and the public
--     role cannot read them: they cannot reach production by accident.
--
-- Not decided here: how names and descriptions are translated (E12). Tables
-- carry the original name only.

create extension if not exists postgis;

create type terrain as enum ('road', 'trail', 'mixed');

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Routes and tracks
-- ---------------------------------------------------------------------------

create table routes (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  geom geography(LineStringZ, 4326) not null,
  terrain_asset_url text,             -- terrain built by packages/terrain-pipeline, on R2
  poster_url text,                    -- static image for the LCP
  stats jsonb,                        -- grades per stretch, highest point, climbs
  source text not null,               -- gpx | organizer | editorial
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_source_known check (source in ('gpx', 'organizer', 'editorial'))
);

create table route_pois (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes on delete cascade,
  km numeric(6, 3) not null,
  kind text not null,
  name text,
  geom geography(Point, 4326),
  constraint route_pois_km_not_negative check (km >= 0),
  constraint route_pois_kind_known check (kind in ('aid_station', 'summit', 'checkpoint', 'km_marker', 'landmark'))
);

-- ---------------------------------------------------------------------------
-- Races
-- ---------------------------------------------------------------------------

create table races (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,                 -- original name; translations wait for E12
  terrain terrain not null,
  country_code char(2) not null,
  region text,
  location geography(Point, 4326),
  organizer text,
  source text not null,               -- organizer | federation | editorial
  source_url text,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint races_country_code_upper check (country_code = upper(country_code)),
  constraint races_source_known check (source in ('organizer', 'federation', 'editorial'))
);

create table race_editions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races on delete cascade,
  year int not null,
  start_date date not null,
  status text not null,
  registration_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_editions_one_per_year unique (race_id, year),
  constraint race_editions_year_sane check (year between 1900 and 2100),
  constraint race_editions_status_known check (status in ('scheduled', 'cancelled', 'postponed', 'finished'))
);

-- One edition can have several distances.
create table race_courses (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references race_editions on delete cascade,
  name text not null,
  distance_m int not null,
  elevation_gain_m int,               -- null when unknown: never estimated
  elevation_loss_m int,
  time_limit interval,
  route_id uuid references routes on delete set null,
  constraint race_courses_distance_positive check (distance_m > 0),
  constraint race_courses_gain_not_negative check (elevation_gain_m is null or elevation_gain_m >= 0),
  constraint race_courses_loss_not_negative check (elevation_loss_m is null or elevation_loss_m >= 0)
);

-- ---------------------------------------------------------------------------
-- Shoes
-- ---------------------------------------------------------------------------

create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table shoes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete restrict,
  slug text unique not null,
  model text not null,
  version text,
  terrain terrain not null,
  category text not null,             -- daily | tempo | race | technical | ultra …
  release_date date,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The minimum packages/shoe-geometry needs to draw the parametric silhouette (E05).
-- Every measure is nullable: a missing figure is shown as absent, never estimated.
create table shoe_specs (
  shoe_id uuid primary key references shoes on delete cascade,
  size_ref text not null,             -- size the measures were taken on, e.g. 'EU 42'
  weight_g int,
  stack_heel_mm numeric(4, 1),
  stack_forefoot_mm numeric(4, 1),
  drop_mm numeric(4, 1) generated always as (stack_heel_mm - stack_forefoot_mm) stored,
  plate text,                         -- none | carbon | nylon | pebax | rock_plate …
  rocker_apex_pct numeric(4, 1),      -- where the rocker apex sits, % of the length
  toe_spring_deg numeric(4, 1),
  heel_bevel_deg numeric(4, 1),
  width_forefoot_mm numeric(4, 1),
  width_heel_mm numeric(4, 1),
  midsole_layers jsonb,               -- [{compound, thickness_mm, position}]
  outsole_compound text,
  lug_depth_mm numeric(3, 1),         -- null on road shoes
  source text not null,
  measured_at date,
  updated_at timestamptz not null default now(),
  constraint shoe_specs_source_known check (source in ('lab', 'manufacturer', 'mixed')),
  constraint shoe_specs_weight_positive check (weight_g is null or weight_g > 0),
  constraint shoe_specs_stacks_not_negative check (coalesce(stack_heel_mm, 0) >= 0 and coalesce(stack_forefoot_mm, 0) >= 0),
  constraint shoe_specs_rocker_is_a_share check (rocker_apex_pct is null or rocker_apex_pct between 0 and 100)
);

-- ---------------------------------------------------------------------------
-- Indexes: the queries the calendar and the viewer will make
-- ---------------------------------------------------------------------------

create index race_editions_start_date_idx on race_editions (start_date);
create index races_terrain_country_idx on races (terrain, country_code);
create index races_location_idx on races using gist (location);
create index race_courses_edition_idx on race_courses (edition_id);
create index race_courses_route_idx on race_courses (route_id);
create index routes_geom_idx on routes using gist (geom);
create index route_pois_route_km_idx on route_pois (route_id, km);
create index shoes_brand_idx on shoes (brand_id);
create index shoes_terrain_category_idx on shoes (terrain, category);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger routes_updated_at before update on routes for each row execute function set_updated_at();
create trigger races_updated_at before update on races for each row execute function set_updated_at();
create trigger race_editions_updated_at before update on race_editions for each row execute function set_updated_at();
create trigger shoes_updated_at before update on shoes for each row execute function set_updated_at();
create trigger shoe_specs_updated_at before update on shoe_specs for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: the site only reads, and never a placeholder.
-- Writes go through the service role, which bypasses RLS.
-- ---------------------------------------------------------------------------

alter table routes enable row level security;
alter table route_pois enable row level security;
alter table races enable row level security;
alter table race_editions enable row level security;
alter table race_courses enable row level security;
alter table brands enable row level security;
alter table shoes enable row level security;
alter table shoe_specs enable row level security;

create policy "public reads real routes" on routes for select to anon, authenticated using (not is_placeholder);
create policy "public reads pois of real routes" on route_pois for select to anon, authenticated
  using (exists (select 1 from routes r where r.id = route_pois.route_id and not r.is_placeholder));
create policy "public reads real races" on races for select to anon, authenticated using (not is_placeholder);
create policy "public reads editions of real races" on race_editions for select to anon, authenticated
  using (exists (select 1 from races r where r.id = race_editions.race_id and not r.is_placeholder));
create policy "public reads courses of real races" on race_courses for select to anon, authenticated
  using (exists (select 1 from race_editions e join races r on r.id = e.race_id where e.id = race_courses.edition_id and not r.is_placeholder));
create policy "public reads brands" on brands for select to anon, authenticated using (true);
create policy "public reads real shoes" on shoes for select to anon, authenticated using (not is_placeholder);
create policy "public reads specs of real shoes" on shoe_specs for select to anon, authenticated
  using (exists (select 1 from shoes s where s.id = shoe_specs.shoe_id and not s.is_placeholder));

grant usage on schema public to anon, authenticated;
grant select on routes, route_pois, races, race_editions, race_courses, brands, shoes, shoe_specs to anon, authenticated;
