create table if not exists booking_days (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  day_number  int  not null,
  label       text,
  event_date  date not null,
  start_time  time,
  end_time    time,
  created_at  timestamptz not null default now()
);

create index on booking_days (booking_id, day_number);

alter table booking_days enable row level security;

create policy "auth access booking_days"
  on booking_days for all
  to authenticated
  using (true)
  with check (true);
