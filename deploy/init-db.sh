#!/bin/sh
set -eu
# Executed once by the official PostgreSQL entrypoint, never by the application.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=owner_password="$MIGRATOR_PASSWORD" --set=app_password="$APP_DB_PASSWORD" --set=backup_password="$BACKUP_DB_PASSWORD" <<'SQL'
CREATE ROLE smartuni_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'owner_password';
CREATE ROLE smartuni_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 24 PASSWORD :'app_password';
CREATE ROLE smartuni_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 4 PASSWORD :'backup_password';
ALTER DATABASE smartuniplanner OWNER TO smartuni_migrator;
REVOKE ALL ON DATABASE smartuniplanner FROM PUBLIC;
GRANT CONNECT ON DATABASE smartuniplanner TO smartuni_app, smartuni_backup;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO smartuni_migrator;
GRANT USAGE ON SCHEMA public TO smartuni_app;
ALTER DEFAULT PRIVILEGES FOR ROLE smartuni_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO smartuni_app;
GRANT pg_read_all_data TO smartuni_backup;
ALTER ROLE smartuni_app SET statement_timeout = '20s';
ALTER ROLE smartuni_app SET idle_in_transaction_session_timeout = '20s';
ALTER ROLE smartuni_backup SET default_transaction_read_only = on;
SQL
