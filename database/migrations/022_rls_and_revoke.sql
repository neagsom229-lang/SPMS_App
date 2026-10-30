-- Migration 022: Enable RLS and revoke all on tables/sequences from anon and authenticated
-- NOTE: Do NOT run on any remote/production DB. Idempotent.

DO $$
DECLARE
    tbl RECORD;
    seq RECORD;
BEGIN
    -- Enable RLS on all tables in public schema
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    END LOOP;

    -- Revoke all privileges on all tables and sequences from anon and authenticated roles if they exist
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;';
    END IF;

    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;';
    END IF;
END $$;
