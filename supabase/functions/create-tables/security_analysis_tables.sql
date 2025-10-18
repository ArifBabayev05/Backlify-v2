-- Create SecurityLogAnalysis table for storing AI-analyzed security logs
CREATE TABLE IF NOT EXISTS SecurityLogAnalysis (
    id VARCHAR(255) PRIMARY KEY,
    detected_user VARCHAR(255),
    machine_name VARCHAR(255),
    time_from TIMESTAMP WITH TIME ZONE,
    time_to TIMESTAMP WITH TIME ZONE,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_likelihood VARCHAR(10) NOT NULL CHECK (risk_likelihood IN ('Low', 'Medium', 'High')),
    risk_justification TEXT,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    summary_bullets JSONB NOT NULL,
    top_indicators JSONB NOT NULL,
    recommendations JSONB NOT NULL,
    behavior_breakdown JSONB NOT NULL,
    chart_risk_history JSONB,
    chart_event_dist JSONB,
    alert_flags JSONB NOT NULL,
    timestamp_created TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_input JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_security_analysis_risk_score ON SecurityLogAnalysis(risk_score);
CREATE INDEX IF NOT EXISTS idx_security_analysis_risk_likelihood ON SecurityLogAnalysis(risk_likelihood);
CREATE INDEX IF NOT EXISTS idx_security_analysis_detected_user ON SecurityLogAnalysis(detected_user);
CREATE INDEX IF NOT EXISTS idx_security_analysis_machine_name ON SecurityLogAnalysis(machine_name);
CREATE INDEX IF NOT EXISTS idx_security_analysis_timestamp_created ON SecurityLogAnalysis(timestamp_created);
CREATE INDEX IF NOT EXISTS idx_security_analysis_time_from ON SecurityLogAnalysis(time_from);
CREATE INDEX IF NOT EXISTS idx_security_analysis_time_to ON SecurityLogAnalysis(time_to);

-- Create GIN indexes for JSONB columns for better search performance
CREATE INDEX IF NOT EXISTS idx_security_analysis_summary_gin ON SecurityLogAnalysis USING GIN (summary_bullets);
CREATE INDEX IF NOT EXISTS idx_security_analysis_indicators_gin ON SecurityLogAnalysis USING GIN (top_indicators);
CREATE INDEX IF NOT EXISTS idx_security_analysis_recommendations_gin ON SecurityLogAnalysis USING GIN (recommendations);
CREATE INDEX IF NOT EXISTS idx_security_analysis_behavior_gin ON SecurityLogAnalysis USING GIN (behavior_breakdown);
CREATE INDEX IF NOT EXISTS idx_security_analysis_alerts_gin ON SecurityLogAnalysis USING GIN (alert_flags);
CREATE INDEX IF NOT EXISTS idx_security_analysis_raw_input_gin ON SecurityLogAnalysis USING GIN (raw_input);

-- Add comments for documentation
COMMENT ON TABLE SecurityLogAnalysis IS 'Stores AI-analyzed Windows Security log entries with structured threat assessment data';
COMMENT ON COLUMN SecurityLogAnalysis.id IS 'Unique identifier for the analysis (from AI unique_id)';
COMMENT ON COLUMN SecurityLogAnalysis.detected_user IS 'Username detected from the logs (can be null)';
COMMENT ON COLUMN SecurityLogAnalysis.machine_name IS 'Host machine name detected from the logs (can be null)';
COMMENT ON COLUMN SecurityLogAnalysis.time_from IS 'Earliest time of analyzed logs (ISO8601)';
COMMENT ON COLUMN SecurityLogAnalysis.time_to IS 'Latest time of analyzed logs (ISO8601)';
COMMENT ON COLUMN SecurityLogAnalysis.risk_score IS 'Threat assessment score from 0-100';
COMMENT ON COLUMN SecurityLogAnalysis.risk_likelihood IS 'Categorical threat level (Low/Medium/High)';
COMMENT ON COLUMN SecurityLogAnalysis.risk_justification IS '1-2 sentence justification for the risk assessment';
COMMENT ON COLUMN SecurityLogAnalysis.confidence IS 'AI model confidence in the assessment (0.0-1.0)';
COMMENT ON COLUMN SecurityLogAnalysis.summary_bullets IS '2-4 short bullets describing notable behaviors (JSON array)';
COMMENT ON COLUMN SecurityLogAnalysis.top_indicators IS 'Top 3 indicators influencing the risk (JSON array)';
COMMENT ON COLUMN SecurityLogAnalysis.recommendations IS '3 prioritized actions for the Blue Team (JSON array)';
COMMENT ON COLUMN SecurityLogAnalysis.behavior_breakdown IS 'Counts of events by category (JSON object)';
COMMENT ON COLUMN SecurityLogAnalysis.chart_risk_history IS 'Risk score over time data for charts (JSON array)';
COMMENT ON COLUMN SecurityLogAnalysis.chart_event_dist IS 'Distribution by event type for charts (JSON object)';
COMMENT ON COLUMN SecurityLogAnalysis.alert_flags IS 'Boolean flags for dashboard badges (JSON object)';
COMMENT ON COLUMN SecurityLogAnalysis.timestamp_created IS 'When this analysis record was created';
COMMENT ON COLUMN SecurityLogAnalysis.raw_input IS 'Original raw JSON logs used for the analysis (JSON array)';
