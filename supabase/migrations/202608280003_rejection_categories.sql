alter table public.opinions
  drop constraint if exists opinions_rejection_category_check;

update public.opinions
set rejection_category = case rejection_category
  when 'schedule' then 'schedule_impossible'
  when 'budget' then 'other'
  when 'feasibility' then 'schedule_impossible'
  else rejection_category
end
where rejection_category in ('schedule', 'budget', 'feasibility');

alter table public.opinions
  add constraint opinions_rejection_category_check
  check (rejection_category in ('distance_over_50km', 'schedule_impossible', 'unsafe_or_illegal', 'purpose_conflict', 'other'));
