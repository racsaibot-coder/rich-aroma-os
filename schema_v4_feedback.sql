CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    phone TEXT,
    food_rating INTEGER,
    service_rating INTEGER,
    cleanliness_rating INTEGER,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
