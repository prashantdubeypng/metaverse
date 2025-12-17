-- Initialize database schema extensions and optimizations

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Optimize PostgreSQL settings for metaverse workload
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Connection pooling settings
ALTER SYSTEM SET max_connections = 200;

-- Create indexes for performance (will be created by Prisma migrations, but here for reference)
-- These are examples - actual indexes are managed by Prisma

-- Index for username lookups (used by Bloom filter validation)
-- CREATE INDEX IF NOT EXISTS idx_users_username ON "User"(LOWER(username));

-- Index for space membership queries
-- CREATE INDEX IF NOT EXISTS idx_space_members_space_id ON "SpaceMember"(space_id);
-- CREATE INDEX IF NOT EXISTS idx_space_members_user_id ON "SpaceMember"(user_id);

-- Index for chat message queries
-- CREATE INDEX IF NOT EXISTS idx_messages_space_id_created ON "Message"(space_id, created_at DESC);

-- Create materialized view for user statistics (optional optimization)
-- This can be refreshed periodically to avoid expensive joins
CREATE MATERIALIZED VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id,
    u.username,
    COUNT(DISTINCT sm.space_id) as spaces_joined,
    COUNT(DISTINCT m.id) as messages_sent,
    MAX(u."updatedAt") as last_active
FROM "User" u
LEFT JOIN "SpaceMember" sm ON u.id = sm.user_id
LEFT JOIN "Message" m ON u.id = m."authorId"
GROUP BY u.id, u.username;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stats_id ON user_stats(id);

-- Function to refresh user stats (call this periodically via cron or trigger)
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE metaverse TO metaverse;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metaverse;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metaverse;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully for metaverse';
    RAISE NOTICE 'Optimized for: High connection count, spatial queries, chat workload';
END $$;
