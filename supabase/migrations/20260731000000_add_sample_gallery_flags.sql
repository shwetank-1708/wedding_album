alter table public.events
add column if not exists is_sample_gallery boolean not null default false,
add column if not exists sample_gallery_order integer;

create index if not exists idx_events_sample_gallery
on public.events (is_sample_gallery, sample_gallery_order, title)
where is_sample_gallery = true;
