-- Run in the SQL editor for the Supabase project dedicated to this app.
create table public.saved_translations (
  id uuid primary key default gen_random_uuid(),
  source_text text not null check (char_length(source_text) between 1 and 4000),
  translated_text text not null check (char_length(translated_text) between 1 and 12000),
  target_language text not null,
  created_at timestamptz not null default now()
);
alter table public.saved_translations enable row level security;
revoke all on public.saved_translations from anon, authenticated;
grant insert on public.saved_translations to service_role;
