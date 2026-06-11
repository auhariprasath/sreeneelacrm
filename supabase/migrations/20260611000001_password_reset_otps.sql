create table if not exists password_reset_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  otp_hash    text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on password_reset_otps (email, used, expires_at);
