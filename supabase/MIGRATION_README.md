# Database Migration Strategy

## For New Deployments (Fresh Install)
Use the consolidated script that contains the complete, up-to-date schema:
```
supabase/RUN_ALL_PENDING_MIGRATIONS.sql
```
This is a single idempotent file that creates all tables, indexes, RLS policies, and functions.

## For Existing Deployments (Incremental Updates)
Apply numbered migrations in order. Only run migrations newer than your current version:
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_allow_anonymous_products.sql
supabase/migrations/003_add_myntra_ajio_westside.sql
supabase/migrations/004_personal_settings_and_variants.sql
supabase/migrations/005_multi_account_and_discord_ntfy.sql
```

## When Adding New Migrations
1. Create `supabase/migrations/NNN_description.sql` for the incremental change.
2. **Also** update `RUN_ALL_PENDING_MIGRATIONS.sql` to include the same changes so it remains the single-file canonical source for fresh installs.
