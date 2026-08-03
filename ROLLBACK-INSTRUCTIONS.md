# Rollback instructions

## Preferred rollback

Use the verified pre-change backup and restore into a separate test Supabase project first. Do not overwrite the live project without a reviewed restore plan.

## Application rollback

1. Put the website in maintenance mode.
2. Redeploy the previous server and client build.
3. Keep the new tables and audit data; they are non-destructive.
4. If the previous server cannot create sessions because of the new trigger, review and run `supabase/migrations/009_security_roles_mentors.rollback.sql`.
5. Do not restore broad authenticated `profiles` update privileges.

## Full database rollback

A full rollback requires the verified backup because migration 009 backfills and normalizes legacy mentor identity fields. Validate the restore on a disposable database before touching the connected Supabase project.
