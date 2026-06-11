create table if not exists lead_files (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  name       text not null,
  path       text not null,
  type       text not null,
  size       bigint not null default 0,
  created_at timestamptz not null default now()
);

create index on lead_files (lead_id, created_at desc);

alter table lead_files enable row level security;

create policy "auth access lead_files"
  on lead_files for all
  to authenticated
  using (true)
  with check (true);
