-- Fix PostgreSQL collation version mismatch
-- Run this script to fix the template database issue

-- Connect to postgres database first
\c postgres

-- Fix template1 collation
ALTER DATABASE template1 REFRESH COLLATION VERSION;

-- Create shadow database for Prisma migrations
DROP DATABASE IF EXISTS metaverse_shadow;
CREATE DATABASE metaverse_shadow;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE metaverse_shadow TO postgres;

-- Verify databases
\l
