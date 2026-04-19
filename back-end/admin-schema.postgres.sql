CREATE TABLE IF NOT EXISTS admin_users (
	id TEXT PRIMARY KEY,
	username TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_content (
	id TEXT PRIMARY KEY,
	entity_type TEXT NOT NULL,
	entity_slug TEXT NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL,
	priority TEXT NOT NULL,
	assigned_to TEXT NOT NULL,
	blocker TEXT,
	summary TEXT NOT NULL,
	public_summary TEXT NOT NULL DEFAULT '',
	ballot_summary TEXT,
	source_coverage TEXT NOT NULL,
	published BOOLEAN NOT NULL DEFAULT FALSE,
	published_at TEXT,
	updated_at TEXT NOT NULL,
	UNIQUE (entity_type, entity_slug)
);

CREATE TABLE IF NOT EXISTS admin_guide_packages (
	id TEXT PRIMARY KEY,
	election_slug TEXT NOT NULL UNIQUE,
	jurisdiction_slug TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'ready_to_publish', 'published')),
	reviewer TEXT,
	review_notes TEXT,
	coverage_notes TEXT NOT NULL DEFAULT '[]',
	coverage_limits TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	drafted_at TEXT NOT NULL,
	reviewed_at TEXT,
	published_at TEXT,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_corrections (
	id TEXT PRIMARY KEY,
	submission_type TEXT NOT NULL CHECK (submission_type IN ('correction', 'feedback')),
	subject TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	entity_label TEXT NOT NULL,
	status TEXT NOT NULL,
	priority TEXT NOT NULL,
	submitted_at TEXT NOT NULL,
	reported_by TEXT NOT NULL,
	summary TEXT NOT NULL,
	next_step TEXT NOT NULL,
	source_count INTEGER NOT NULL DEFAULT 0,
	page_url TEXT
);

CREATE TABLE IF NOT EXISTS admin_source_monitors (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	authority TEXT NOT NULL,
	health TEXT NOT NULL,
	last_checked_at TEXT NOT NULL,
	next_check_at TEXT NOT NULL,
	owner TEXT NOT NULL,
	note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_activity (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	type TEXT NOT NULL,
	timestamp TEXT NOT NULL,
	summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_content_status ON admin_content (status, published);
CREATE INDEX IF NOT EXISTS idx_admin_guide_packages_status ON admin_guide_packages (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_corrections_status ON admin_corrections (status, priority);
CREATE INDEX IF NOT EXISTS idx_admin_sources_health ON admin_source_monitors (health);
CREATE INDEX IF NOT EXISTS idx_admin_activity_timestamp ON admin_activity (timestamp DESC);
