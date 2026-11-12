-- E05: what the parametric profile of a shoe needs beyond the first schema.
-- `length_mm` is the one new figure a profile cannot be drawn without; the other
-- three sharpen it (layers of the sole, front of the upper) and may stay null.
alter table shoe_specs
  add column length_mm numeric(5, 1),              -- inside length of the size measured; the nominal length of the size when no lab gives it
  add column outsole_thickness_mm numeric(3, 1),   -- rubber only, lugs apart
  add column insole_thickness_mm numeric(3, 1),
  add column toebox_height_mm numeric(4, 1),       -- inside height of the toe box
  add constraint shoe_specs_length_positive check (length_mm is null or length_mm > 0),
  add constraint shoe_specs_layers_not_negative check (coalesce(outsole_thickness_mm, 0) >= 0 and coalesce(insole_thickness_mm, 0) >= 0 and coalesce(toebox_height_mm, 0) >= 0);

-- Scores given by independent reviewers, each on its own scale: never converted, never averaged.
create table shoe_review_scores (
  id uuid primary key default gen_random_uuid(),
  shoe_id uuid not null references shoes on delete cascade,
  source_name text not null,
  source_url text not null,
  score numeric(5, 2) not null,
  scale numeric(5, 2) not null,
  reviewed_on date,                                -- as the review's page gives it
  accessed_on date not null,                       -- the day it was read
  note text,
  constraint shoe_review_scores_within_scale check (score >= 0 and scale > 0 and score <= scale),
  constraint shoe_review_scores_one_per_source unique (shoe_id, source_url)
);
create index shoe_review_scores_shoe on shoe_review_scores (shoe_id);
alter table shoe_review_scores enable row level security;
create policy "public reads scores of real shoes" on shoe_review_scores for select to anon, authenticated
  using (exists (select 1 from shoes s where s.id = shoe_review_scores.shoe_id and not s.is_placeholder));
grant select on shoe_review_scores to anon, authenticated;
