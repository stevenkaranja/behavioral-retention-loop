-- Users and their lifecycle state
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    plan            VARCHAR(50) NOT NULL DEFAULT 'free',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_ends_at   TIMESTAMPTZ,
    churned_at      TIMESTAMPTZ,
    ltv_usd         DECIMAL(10,2) DEFAULT 0
);

-- Raw user interaction events
CREATE TABLE user_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      VARCHAR(100) NOT NULL,
    feature         VARCHAR(100),
    properties      JSONB DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_events_user_id   ON user_events (user_id);
CREATE INDEX idx_user_events_type_ts   ON user_events (event_type, occurred_at DESC);
CREATE INDEX idx_user_events_feature   ON user_events (feature) WHERE feature IS NOT NULL;

-- Computed churn risk scores (refreshed hourly)
CREATE TABLE churn_scores (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    score           DECIMAL(5,4) NOT NULL,  -- 0.0 to 1.0
    risk_tier       VARCHAR(20) NOT NULL,   -- low | medium | high | critical
    features_used   INTEGER DEFAULT 0,
    last_active_at  TIMESTAMPTZ,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intervention log
CREATE TABLE interventions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    trigger_event   VARCHAR(100),
    intervention_type VARCHAR(100) NOT NULL,
    content         TEXT,
    sent_at         TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    converted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
