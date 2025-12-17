#!/bin/bash
set -e

# This script runs when PostgreSQL container starts for the first time
# It creates the metaverse_db database if it doesn't exist

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create metaverse_db if it doesn't exist
    SELECT 'CREATE DATABASE metaverse_db'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metaverse_db')\gexec

    -- Grant all privileges
    GRANT ALL PRIVILEGES ON DATABASE metaverse_db TO postgres;

    -- Log success
    \echo 'Database metaverse_db created successfully'
EOSQL
