-- Create Creator Submissions table for UGC
CREATE TABLE IF NOT EXISTS creator_submissions (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    link TEXT NOT NULL,
    platform TEXT DEFAULT 'instagram',
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    points_awarded INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_creator_submissions_status ON creator_submissions(status);
CREATE INDEX IF NOT EXISTS idx_creator_submissions_phone ON creator_submissions(phone);

-- Policies (Allow all for simplicity, matching existing patterns)
ALTER TABLE creator_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON creator_submissions FOR ALL USING (true);
