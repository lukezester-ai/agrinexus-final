-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Основна таблица
CREATE TABLE IF NOT EXISTS academy_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding VECTOR(1024),                    -- 1024 за multilingual-e5-large
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index-и (много важни за производителност)
CREATE INDEX idx_academy_embedding 
    ON academy_documents 
    USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_academy_metadata 
    ON academy_documents 
    USING gin (metadata);

CREATE INDEX idx_academy_content_trgm 
    ON academy_documents 
    USING gin (content gin_trgm_ops);

-- View за по-лесно търсене
CREATE OR REPLACE VIEW academy_tutor_search AS
SELECT 
    id,
    content,
    metadata,
    embedding
FROM academy_documents;
