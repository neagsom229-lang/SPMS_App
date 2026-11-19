-- database/local/001_app_role.sql
--
-- LOCAL POSTGRESQL ONLY. Run once as the postgres superuser:
--
--   psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f database/local/001_app_role.sql
--
-- It creates spms_db if missing and a least-privilege login role `spms_app`
-- that owns the database and its schema. The application must connect as
-- spms_app; it must never use the postgres superuser.
--
-- Password: replace CHANGE_ME_STRONG_PASSWORD below with a locally generated
-- value, run the script, then put the same value in DATABASE_URL in
-- backend/.env. Never commit the real value. Preferred alternative: leave the
-- placeholder, run the script, then set it interactively with:
--   psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\password spms_app"
-- (\password hides the value; a literal passed on the command line does not.)
--
-- This file is intentionally NOT in database/migrations: it is provisioning,
-- not schema, and must never run automatically against production.

\set ON_ERROR_STOP on
\set app_db spms_db
\set app_role spms_app
\set app_password 'CHANGE_ME_STRONG_PASSWORD'

-- 1. Database (owned by the app role, created only if absent).
SELECT format('CREATE DATABASE %I OWNER %I', :'app_db', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db')
\gexec

-- 2. Login role. No superuser, no CREATEDB, no CREATEROLE, no replication.
SELECT format('CREATE ROLE %I LOGIN', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

ALTER ROLE :"app_role" WITH LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- 3. History compatibility: migrations 022 and 025 name Supabase's `anon` and
-- `authenticated` roles. Plain PostgreSQL does not ship them. NOLOGIN
-- placeholders with no privileges let those guarded revokes run; the app never
-- connects as either role. No `service_role`/`supabase_admin` is created.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- 4. Ownership and connection rights inside this database only.
ALTER DATABASE :"app_db" OWNER TO :"app_role";
REVOKE ALL ON DATABASE :"app_db" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"app_db" TO :"app_role";

\connect :app_db
ALTER SCHEMA public OWNER TO :"app_role";
GRANT ALL ON SCHEMA public TO :"app_role";
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- 5. Read-back (never prints the password).
SELECT current_database() AS database, current_user AS connected_as;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = :'app_role';
