CREATE EXTENSION IF NOT EXISTS vector;

SELECT 'CREATE DATABASE aia_insight_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'aia_insight_test'
)\gexec

\connect aia_insight_test
CREATE EXTENSION IF NOT EXISTS vector;
