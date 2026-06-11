-- Key features to track for onboarding completion
CREATE TABLE feature_definitions (
    slug            VARCHAR(100) PRIMARY KEY,
    display_name    VARCHAR(255) NOT NULL,
    is_key_feature  BOOLEAN DEFAULT FALSE,
    onboarding_day  INTEGER  -- expected discovery day (1-14)
);

INSERT INTO feature_definitions VALUES
  ('dashboard',       'Analytics Dashboard',    TRUE,  1),
  ('automation',      'Workflow Automation',     TRUE,  3),
  ('integrations',    'Third-party Integrations',TRUE,  5),
  ('team-invite',     'Team Collaboration',      TRUE,  7),
  ('api-access',      'API Access',              FALSE, 10),
  ('custom-reports',  'Custom Reports',          TRUE,  14);

-- User feature discovery progress
CREATE TABLE feature_discovery (
    user_id         UUID NOT NULL REFERENCES users(id),
    feature_slug    VARCHAR(100) NOT NULL REFERENCES feature_definitions(slug),
    first_used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    use_count       INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, feature_slug)
);
