import type {
	AdminActivityItem,
	AdminContentItem,
	AdminContentResponse,
	AdminCorrectionRequest,
	AdminCorrectionsResponse,
	AdminCorrectionStatus,
	AdminEntityType,
	AdminOverviewResponse,
	AdminPriority,
	AdminReviewResponse,
	AdminReviewStatus,
	AdminSourceHealth,
	AdminSourceMonitorItem,
	AdminSourceMonitorResponse,
	AdminSubmissionType,
	AdminUser,
	AdminUserRole,
	AdminUsersResponse,
} from "./types/civic.js";
import { Buffer } from "node:buffer";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
	demoAdminCorrections,
	demoAdminOverview,
	demoAdminSourceMonitor,
	demoCandidates,
	demoElection,
	demoMeasures
} from "./coverage-data.js";

export interface AdminRepositoryOptions {
	dbPath?: string | null;
	databaseUrl?: string | null;
	bootstrapDisplayName?: string | null;
	bootstrapPassword?: string | null;
	bootstrapRole?: AdminUserRole | null;
	bootstrapUsername?: string | null;
}

export interface CorrectionSubmissionInput {
	email: string;
	message: string;
	name?: string;
	pageUrl?: string;
	sourceLinks?: string;
	subject: string;
	submissionType: AdminSubmissionType;
}

export interface ContentPatch {
	assignedTo?: string;
	blocker?: string | null;
	priority?: AdminPriority;
	publicBallotSummary?: string | null;
	publicSummary?: string;
	published?: boolean;
	status?: AdminReviewStatus;
}

export interface CorrectionPatch {
	nextStep?: string;
	priority?: AdminPriority;
	status?: AdminCorrectionStatus;
}

export interface SourcePatch {
	health?: AdminSourceHealth;
	nextCheckAt?: string;
	note?: string;
	owner?: string;
}

export interface CreateUserInput {
	displayName: string;
	password: string;
	role: AdminUserRole;
	username: string;
}

export interface AdminRepository {
	driver: "postgres" | "sqlite";
	authenticateUser: (username: string, password: string) => AdminUser | null | Promise<AdminUser | null>;
	createCorrectionSubmission: (input: CorrectionSubmissionInput) => { ok: true; submittedAt: string } | Promise<{ ok: true; submittedAt: string }>;
	createUser: (input: CreateUserInput) => AdminUser | Promise<AdminUser>;
	getContentRecord: (entityType: AdminEntityType, entitySlug: string) => AdminContentItem | null | Promise<AdminContentItem | null>;
	getOverview: () => AdminOverviewResponse | Promise<AdminOverviewResponse>;
	getHealth: () => { ok: true } | Promise<{ ok: true }>;
	hasUsers: () => boolean | Promise<boolean>;
	listContent: () => AdminContentResponse | Promise<AdminContentResponse>;
	listCorrections: () => AdminCorrectionsResponse | Promise<AdminCorrectionsResponse>;
	listReview: () => AdminReviewResponse | Promise<AdminReviewResponse>;
	listSourceMonitor: () => AdminSourceMonitorResponse | Promise<AdminSourceMonitorResponse>;
	listUsers: () => AdminUsersResponse | Promise<AdminUsersResponse>;
	updateContent: (id: string, patch: ContentPatch) => AdminContentResponse | Promise<AdminContentResponse>;
	updateCorrection: (id: string, patch: CorrectionPatch) => AdminCorrectionsResponse | Promise<AdminCorrectionsResponse>;
	updateSource: (id: string, patch: SourcePatch) => AdminSourceMonitorResponse | Promise<AdminSourceMonitorResponse>;
}

interface DatabaseCountRow {
	count: number;
}

interface UserRow {
	id: string;
	username: string;
	display_name: string;
	role: AdminUserRole;
	created_at: string;
	last_login_at: string | null;
	password_hash: string;
	updated_at: string;
}

interface ContentRow {
	id: string;
	title: string;
	entity_type: AdminEntityType;
	entity_slug: string;
	status: AdminReviewStatus;
	priority: AdminPriority;
	updated_at: string;
	assigned_to: string;
	blocker: string | null;
	summary: string;
	public_summary: string | null;
	ballot_summary: string | null;
	source_coverage: string;
	published: number;
	published_at: string | null;
}

interface CorrectionRow {
	id: string;
	submission_type: AdminSubmissionType;
	subject: string;
	entity_type: AdminEntityType;
	entity_label: string;
	status: AdminCorrectionStatus;
	priority: AdminPriority;
	submitted_at: string;
	reported_by: string;
	summary: string;
	next_step: string;
	source_count: number;
	page_url: string | null;
}

interface SourceRow {
	id: string;
	label: string;
	authority: AdminSourceMonitorItem["authority"];
	health: AdminSourceHealth;
	last_checked_at: string;
	next_check_at: string;
	owner: string;
	note: string;
}

interface ActivityRow {
	id: string;
	label: string;
	type: AdminActivityItem["type"];
	timestamp: string;
	summary: string;
}

export const defaultDbPath = fileURLToPath(new URL("../data/ballot-clarity.sqlite", import.meta.url));
const packagedSchemaPath = new URL("./admin-schema.sql", import.meta.url);
const sourceSchemaPath = new URL("../admin-schema.sql", import.meta.url);

export function resolveSqliteSchemaPath() {
	const packagedPathname = fileURLToPath(packagedSchemaPath);

	if (existsSync(packagedPathname))
		return packagedPathname;

	return fileURLToPath(sourceSchemaPath);
}

export function hashPassword(password: string) {
	const salt = randomUUID().replaceAll("-", "");
	const derived = scryptSync(password, salt, 64).toString("hex");

	return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string) {
	const [algorithm, salt, digest] = storedHash.split(":");

	if (algorithm !== "scrypt" || !salt || !digest)
		return false;

	const computed = scryptSync(password, salt, 64);
	const stored = Buffer.from(digest, "hex");

	if (computed.length !== stored.length)
		return false;

	return timingSafeEqual(computed, stored);
}

function rowToUser(row: UserRow): AdminUser {
	return {
		createdAt: row.created_at,
		displayName: row.display_name,
		id: row.id,
		lastLoginAt: row.last_login_at || undefined,
		role: row.role,
		username: row.username
	};
}

function rowToContent(row: ContentRow): AdminContentItem {
	return {
		assignedTo: row.assigned_to,
		blocker: row.blocker || undefined,
		entitySlug: row.entity_slug,
		entityType: row.entity_type,
		id: row.id,
		priority: row.priority,
		publicBallotSummary: row.ballot_summary || undefined,
		publicSummary: row.public_summary || "",
		published: Boolean(row.published),
		publishedAt: row.published_at || undefined,
		sourceCoverage: row.source_coverage,
		status: row.status,
		summary: row.summary,
		title: row.title,
		updatedAt: row.updated_at
	};
}

function rowToCorrection(row: CorrectionRow): AdminCorrectionRequest {
	return {
		entityLabel: row.entity_label,
		entityType: row.entity_type,
		id: row.id,
		nextStep: row.next_step,
		pageUrl: row.page_url || undefined,
		priority: row.priority,
		reportedBy: row.reported_by,
		sourceCount: row.source_count,
		status: row.status,
		subject: row.subject,
		submissionType: row.submission_type,
		submittedAt: row.submitted_at,
		summary: row.summary
	};
}

function rowToSource(row: SourceRow): AdminSourceMonitorItem {
	return {
		authority: row.authority,
		health: row.health,
		id: row.id,
		label: row.label,
		lastCheckedAt: row.last_checked_at,
		nextCheckAt: row.next_check_at,
		note: row.note,
		owner: row.owner
	};
}

function rowToActivity(row: ActivityRow): AdminActivityItem {
	return {
		id: row.id,
		label: row.label,
		summary: row.summary,
		timestamp: row.timestamp,
		type: row.type
	};
}

export function defaultContentSeed(): AdminContentItem[] {
	const candidateItems = demoCandidates.map((candidate) => {
		const sourceCoverage = `${candidate.sources.length} attached source${candidate.sources.length === 1 ? "" : "s"} with ${candidate.whatWeKnow.length} documented knowledge checks.`;
		const priority: AdminPriority = candidate.slug === "sandra-patel" ? "medium" : "low";
		const status: AdminReviewStatus = candidate.slug === "sandra-patel" ? "needs-sources" : "published";

		return {
			assignedTo: candidate.slug === "sandra-patel" ? "Research queue" : "Editorial review",
			blocker: candidate.slug === "sandra-patel"
				? "Waiting on a source-backed Georgia legislative district crosswalk note."
				: undefined,
			entitySlug: candidate.slug,
			entityType: "candidate" as const,
			id: `content-${candidate.slug}`,
			priority,
			publicBallotSummary: candidate.ballotSummary,
			publicSummary: candidate.summary,
			published: true,
			publishedAt: candidate.updatedAt,
			sourceCoverage,
			status,
			summary: candidate.summary,
			title: `${candidate.name} profile`,
			updatedAt: candidate.updatedAt
		};
	});

	const measureItems = demoMeasures.map((measure, index) => ({
		assignedTo: index === 0 ? "Managing editor" : "Editorial review",
		blocker: undefined,
		entitySlug: measure.slug,
		entityType: "measure" as const,
		id: `content-${measure.slug}`,
		priority: index === 0 ? "medium" as const : "low" as const,
		publicBallotSummary: measure.ballotSummary,
		publicSummary: measure.summary,
		published: true,
		publishedAt: measure.updatedAt,
		sourceCoverage: `${measure.sources.length} attached source${measure.sources.length === 1 ? "" : "s"} with yes/no impact sections and fiscal notes.`,
		status: index === 0 ? "in-review" as const : "published" as const,
		summary: measure.summary,
		title: measure.title,
		updatedAt: measure.updatedAt
	}));

	return [
		{
			assignedTo: "Editorial review",
			blocker: undefined,
			entitySlug: demoElection.slug,
			entityType: "election",
			id: `content-${demoElection.slug}`,
			priority: "high",
			publicSummary: demoElection.description,
			published: true,
			publishedAt: demoElection.updatedAt,
			sourceCoverage: `${demoElection.contests.length} contest sections with official notices and guide freshness metadata attached.`,
			status: "in-review",
			summary: "Cross-checking the Fulton County launch profile, official office links, and public-status language before the next public refresh.",
			title: "Fulton County launch coverage profile",
			updatedAt: demoElection.updatedAt
		},
		...candidateItems,
		...measureItems
	];
}

function ensureDatabasePath(pathname: string) {
	if (pathname === ":memory:")
		return pathname;

	mkdirSync(dirname(pathname), { recursive: true });
	return pathname;
}

function hasColumn(database: DatabaseSync, table: string, column: string) {
	const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
	return rows.some(row => row.name === column);
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string) {
	if (hasColumn(database, table, column))
		return;

	database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function createSqliteAdminRepository(options: AdminRepositoryOptions = {}): AdminRepository {
	const resolvedPath = ensureDatabasePath(options.dbPath || process.env.ADMIN_DB_PATH || defaultDbPath);
	const database = new DatabaseSync(resolvedPath);
	const schema = readFileSync(resolveSqliteSchemaPath(), "utf8");

	database.exec(schema);
	ensureColumn(database, "admin_content", "public_summary", "TEXT");
	ensureColumn(database, "admin_content", "ballot_summary", "TEXT");

	const countStatement = (table: string) => database.prepare(`SELECT COUNT(*) AS count FROM ${table}`);

	const usersCount = Number((countStatement("admin_users").get() as unknown as DatabaseCountRow).count);
	const contentCount = Number((countStatement("admin_content").get() as unknown as DatabaseCountRow).count);
	const correctionsCount = Number((countStatement("admin_corrections").get() as unknown as DatabaseCountRow).count);
	const sourcesCount = Number((countStatement("admin_source_monitors").get() as unknown as DatabaseCountRow).count);
	const activityCount = Number((countStatement("admin_activity").get() as unknown as DatabaseCountRow).count);

	if (!contentCount) {
		const insertContent = database.prepare(`
			INSERT INTO admin_content (
				id,
				entity_type,
				entity_slug,
				title,
				status,
				priority,
				assigned_to,
				blocker,
				summary,
				public_summary,
				ballot_summary,
				source_coverage,
				published,
				published_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		for (const item of defaultContentSeed()) {
			insertContent.run(
				item.id,
				item.entityType,
				item.entitySlug,
				item.title,
				item.status,
				item.priority,
				item.assignedTo,
				item.blocker || null,
				item.summary,
				item.publicSummary,
				item.publicBallotSummary || null,
				item.sourceCoverage,
				item.published ? 1 : 0,
				item.publishedAt || null,
				item.updatedAt
			);
		}
	}

	const backfillContentFields = database.prepare(`
		UPDATE admin_content
		SET public_summary = CASE
				WHEN public_summary IS NULL OR trim(public_summary) = '' THEN ?
				ELSE public_summary
			END,
			ballot_summary = CASE
				WHEN ballot_summary IS NULL OR trim(ballot_summary) = '' THEN ?
				ELSE ballot_summary
			END,
			published = CASE
				WHEN public_summary IS NULL OR trim(public_summary) = '' THEN ?
				ELSE published
			END,
			published_at = CASE
				WHEN public_summary IS NULL OR trim(public_summary) = '' THEN COALESCE(published_at, ?)
				ELSE published_at
			END
		WHERE entity_type = ? AND entity_slug = ?
	`);

	for (const item of defaultContentSeed()) {
		backfillContentFields.run(
			item.publicSummary,
			item.publicBallotSummary || null,
			item.published ? 1 : 0,
			item.publishedAt || null,
			item.entityType,
			item.entitySlug
		);
	}

	if (!correctionsCount) {
		const insertCorrection = database.prepare(`
			INSERT INTO admin_corrections (
				id,
				submission_type,
				subject,
				entity_type,
				entity_label,
				status,
				priority,
				submitted_at,
				reported_by,
				summary,
				next_step,
				source_count,
				page_url
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		for (const item of demoAdminCorrections.corrections) {
			insertCorrection.run(
				item.id,
				item.submissionType ?? "correction",
				item.subject,
				item.entityType,
				item.entityLabel,
				item.status,
				item.priority,
				item.submittedAt,
				item.reportedBy,
				item.summary,
				item.nextStep,
				item.sourceCount,
				item.pageUrl || null
			);
		}
	}

	if (!sourcesCount) {
		const insertSource = database.prepare(`
			INSERT INTO admin_source_monitors (
				id,
				label,
				authority,
				health,
				last_checked_at,
				next_check_at,
				owner,
				note
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`);

		for (const item of demoAdminSourceMonitor.sources) {
			insertSource.run(
				item.id,
				item.label,
				item.authority,
				item.health,
				item.lastCheckedAt,
				item.nextCheckAt,
				item.owner,
				item.note
			);
		}
	}

	if (!activityCount) {
		const insertActivity = database.prepare(`
			INSERT INTO admin_activity (
				id,
				label,
				type,
				timestamp,
				summary
			) VALUES (?, ?, ?, ?, ?)
		`);

		for (const item of demoAdminOverview.recentActivity) {
			insertActivity.run(item.id, item.label, item.type, item.timestamp, item.summary);
		}
	}

	const bootstrapUsername = options.bootstrapUsername || process.env.ADMIN_BOOTSTRAP_USERNAME || process.env.ADMIN_USERNAME || null;
	const bootstrapPassword = options.bootstrapPassword || process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD || null;
	const bootstrapDisplayName = options.bootstrapDisplayName || process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "Ballot Clarity Admin";
	const bootstrapRole = options.bootstrapRole || (process.env.ADMIN_BOOTSTRAP_ROLE as AdminUserRole | undefined) || "admin";

	if (!usersCount && bootstrapUsername && bootstrapPassword) {
		const now = new Date().toISOString();
		database.prepare(`
			INSERT INTO admin_users (
				id,
				username,
				display_name,
				role,
				password_hash,
				created_at,
				updated_at,
				last_login_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			`user-${bootstrapUsername}`,
			bootstrapUsername.trim(),
			bootstrapDisplayName,
			bootstrapRole,
			hashPassword(bootstrapPassword),
			now,
			now,
			null
		);
	}

	function listUsers(): AdminUsersResponse {
		const rows = database.prepare(`
			SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
			FROM admin_users
			ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, username
		`).all() as unknown as UserRow[];

		return {
			users: rows.map(rowToUser)
		};
	}

	function createUser(input: CreateUserInput): AdminUser {
		const username = input.username.trim().toLowerCase();
		const displayName = input.displayName.trim();

		if (!username || !displayName || !input.password.trim())
			throw new Error("Display name, username, role, and password are required.");

		const existing = database.prepare(`
			SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
			FROM admin_users
			WHERE username = ?
		`).get(username) as UserRow | undefined;

		if (existing)
			throw new Error("An admin user with that username already exists.");

		const now = new Date().toISOString();
		const id = `user-${randomUUID()}`;

		database.prepare(`
			INSERT INTO admin_users (
				id,
				username,
				display_name,
				role,
				password_hash,
				created_at,
				updated_at,
				last_login_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			id,
			username,
			displayName,
			input.role,
			hashPassword(input.password),
			now,
			now,
			null
		);

		logActivity("review", `Created ${input.role} user`, `${displayName} can now access the internal editorial workspace.`);

		return {
			createdAt: now,
			displayName,
			id,
			role: input.role,
			username
		};
	}

	function authenticateUser(username: string, password: string) {
		const normalized = username.trim().toLowerCase();
		const row = database.prepare(`
			SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
			FROM admin_users
			WHERE username = ?
		`).get(normalized) as UserRow | undefined;

		if (!row || !verifyPassword(password, row.password_hash))
			return null;

		const now = new Date().toISOString();
		database.prepare("UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(now, now, row.id);

		return {
			...rowToUser({ ...row, last_login_at: now }),
			lastLoginAt: now
		};
	}

	function logActivity(type: AdminActivityItem["type"], label: string, summary: string) {
		const timestamp = new Date().toISOString();

		database.prepare(`
			INSERT INTO admin_activity (id, label, type, timestamp, summary)
			VALUES (?, ?, ?, ?, ?)
		`).run(`activity-${randomUUID()}`, label, type, timestamp, summary);
	}

	function listActivity(limit = 8) {
		const rows = database.prepare(`
			SELECT id, label, type, timestamp, summary
			FROM admin_activity
			ORDER BY timestamp DESC
			LIMIT ?
		`).all(limit) as unknown as ActivityRow[];

		return rows.map(rowToActivity);
	}

	function listContent(): AdminContentResponse {
		const rows = database.prepare(`
			SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
			FROM admin_content
			ORDER BY published ASC, priority DESC, updated_at DESC
		`).all() as unknown as ContentRow[];

		return {
			items: rows.map(rowToContent)
		};
	}

	function getContentRecord(entityType: AdminEntityType, entitySlug: string) {
		const row = database.prepare(`
			SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
			FROM admin_content
			WHERE entity_type = ? AND entity_slug = ?
		`).get(entityType, entitySlug) as ContentRow | undefined;

		return row ? rowToContent(row) : null;
	}

	function updateContent(id: string, patch: ContentPatch) {
		const current = database.prepare(`
			SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
			FROM admin_content
			WHERE id = ?
		`).get(id) as ContentRow | undefined;

		if (!current)
			throw new Error("Content record not found.");

		const now = new Date().toISOString();
		const nextPublished = patch.published ?? Boolean(current.published);
		const nextStatus = patch.status
			|| (nextPublished ? "published" : current.status === "published" ? "in-review" : current.status);
		const nextPublishedAt = nextPublished ? current.published_at || now : null;
		const nextPublicSummary = patch.publicSummary === undefined
			? current.public_summary || ""
			: patch.publicSummary.trim();

		if (!nextPublicSummary)
			throw new Error("Public page summary is required.");

		const nextBallotSummary = patch.publicBallotSummary === undefined
			? current.ballot_summary
			: patch.publicBallotSummary?.trim() || null;

		database.prepare(`
			UPDATE admin_content
			SET status = ?,
				priority = ?,
				assigned_to = ?,
				blocker = ?,
				public_summary = ?,
				ballot_summary = ?,
				published = ?,
				published_at = ?,
				updated_at = ?
			WHERE id = ?
		`).run(
			nextStatus,
			patch.priority ?? current.priority,
			patch.assignedTo?.trim() || current.assigned_to,
			patch.blocker === undefined ? current.blocker : patch.blocker?.trim() || null,
			nextPublicSummary,
			nextBallotSummary,
			nextPublished ? 1 : 0,
			nextPublishedAt,
			now,
			id
		);

		logActivity(
			nextPublished ? "publish" : "review",
			`${current.title} updated`,
			nextPublished
				? `${current.title} is marked published and available for the public site.`
				: `${current.title} moved to ${nextStatus}.`
		);

		return listContent();
	}

	function listReview(): AdminReviewResponse {
		return {
			items: listContent().items.map(item => ({
				assignedTo: item.assignedTo,
				blocker: item.blocker,
				entityType: item.entityType,
				id: item.id,
				priority: item.priority,
				sourceCoverage: item.sourceCoverage,
				status: item.status,
				summary: item.summary,
				title: item.title,
				updatedAt: item.updatedAt
			}))
		};
	}

	function listCorrections(): AdminCorrectionsResponse {
		const rows = database.prepare(`
			SELECT id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at, reported_by, summary, next_step, source_count, page_url
			FROM admin_corrections
			ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'triaged' THEN 1 WHEN 'researching' THEN 2 ELSE 3 END, submitted_at DESC
		`).all() as unknown as CorrectionRow[];

		return {
			corrections: rows.map(rowToCorrection)
		};
	}

	function createCorrectionSubmission(input: CorrectionSubmissionInput) {
		const subject = input.subject.trim();
		const message = input.message.trim();
		const email = input.email.trim();

		if (!subject || !message || !email)
			throw new Error("Subject, message, and email are required.");

		const now = new Date().toISOString();
		const id = `correction-${randomUUID()}`;
		const reportedBy = input.name?.trim() ? `${input.name.trim()} <${email}>` : email;
		const summary = input.sourceLinks?.trim()
			? `${message}\n\nSupporting links:\n${input.sourceLinks.trim()}`
			: message;

		database.prepare(`
			INSERT INTO admin_corrections (
				id,
				submission_type,
				subject,
				entity_type,
				entity_label,
				status,
				priority,
				submitted_at,
				reported_by,
				summary,
				next_step,
				source_count,
				page_url
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			id,
			input.submissionType,
			subject,
			"policy",
			input.pageUrl?.trim() || "General site feedback",
			"new",
			input.submissionType === "correction" ? "high" : "medium",
			now,
			reportedBy,
			summary,
			input.submissionType === "correction"
				? "Verify the cited claim, source trail, and page framing."
				: "Triage the feedback and determine whether it belongs in product, content, or operations review.",
			input.sourceLinks?.trim() ? input.sourceLinks.split("\n").filter(Boolean).length : 0,
			input.pageUrl?.trim() || null
		);

		logActivity(
			"correction",
			input.submissionType === "correction" ? "Received correction submission" : "Received public feedback",
			`${subject} was submitted through the public contact form.`
		);

		return {
			ok: true,
			submittedAt: now
		} as const;
	}

	function updateCorrection(id: string, patch: CorrectionPatch) {
		const current = database.prepare(`
			SELECT id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at, reported_by, summary, next_step, source_count, page_url
			FROM admin_corrections
			WHERE id = ?
		`).get(id) as CorrectionRow | undefined;

		if (!current)
			throw new Error("Correction record not found.");

		database.prepare(`
			UPDATE admin_corrections
			SET status = ?, priority = ?, next_step = ?
			WHERE id = ?
		`).run(
			patch.status ?? current.status,
			patch.priority ?? current.priority,
			patch.nextStep?.trim() || current.next_step,
			id
		);

		logActivity("correction", `${current.subject} updated`, `Correction item moved to ${patch.status ?? current.status}.`);

		return listCorrections();
	}

	function listSourceMonitor(): AdminSourceMonitorResponse {
		const rows = database.prepare(`
			SELECT id, label, authority, health, last_checked_at, next_check_at, owner, note
			FROM admin_source_monitors
			ORDER BY CASE health WHEN 'incident' THEN 0 WHEN 'stale' THEN 1 WHEN 'review-soon' THEN 2 ELSE 3 END, next_check_at ASC
		`).all() as unknown as SourceRow[];

		return {
			sources: rows.map(rowToSource)
		};
	}

	function updateSource(id: string, patch: SourcePatch) {
		const current = database.prepare(`
			SELECT id, label, authority, health, last_checked_at, next_check_at, owner, note
			FROM admin_source_monitors
			WHERE id = ?
		`).get(id) as SourceRow | undefined;

		if (!current)
			throw new Error("Source monitor record not found.");

		const now = new Date().toISOString();

		database.prepare(`
			UPDATE admin_source_monitors
			SET health = ?, last_checked_at = ?, next_check_at = ?, owner = ?, note = ?
			WHERE id = ?
		`).run(
			patch.health ?? current.health,
			now,
			patch.nextCheckAt?.trim() || current.next_check_at,
			patch.owner?.trim() || current.owner,
			patch.note?.trim() || current.note,
			id
		);

		logActivity("source-check", `${current.label} updated`, `Source monitor status is now ${patch.health ?? current.health}.`);

		return listSourceMonitor();
	}

	function getOverview(): AdminOverviewResponse {
		const content = listContent().items;
		const corrections = listCorrections().corrections;
		const sources = listSourceMonitor().sources;

		const healthySourceCount = sources.filter(item => item.health === "healthy").length;
		const openCorrections = corrections.filter(item => item.status !== "resolved");
		const reviewQueue = content.filter(item => item.status !== "published" || !item.published);
		const dueChecks = sources.filter(item => new Date(item.nextCheckAt).getTime() <= Date.now());
		const needsAttention = [
			...openCorrections
				.filter(item => item.priority === "high")
				.slice(0, 2)
				.map(item => `${item.subject}: ${item.nextStep}`),
			...content
				.filter(item => item.status === "needs-sources")
				.slice(0, 2)
				.map(item => `${item.title}: ${item.blocker || "Waiting on source coverage."}`),
			...sources
				.filter(item => item.health === "incident" || item.health === "stale")
				.slice(0, 2)
				.map(item => `${item.label}: ${item.note}`)
		].slice(0, 6);

		return {
			metrics: [
				{
					helpText: "Reader reports and internal issues that still need a documented resolution.",
					id: "open-corrections",
					label: "Open corrections",
					tone: openCorrections.length ? "attention" : "healthy",
					value: String(openCorrections.length)
				},
				{
					helpText: "Candidate, measure, and election records not yet marked published.",
					id: "review-queue",
					label: "Awaiting publish",
					tone: reviewQueue.length ? "review" : "healthy",
					value: String(reviewQueue.length)
				},
				{
					helpText: "Tracked source systems passing the latest check cycle.",
					id: "healthy-sources",
					label: "Healthy sources",
					tone: healthySourceCount === sources.length ? "healthy" : "review",
					value: `${healthySourceCount}/${sources.length}`
				},
				{
					helpText: "Source monitors due now or already past their next scheduled check.",
					id: "due-checks",
					label: "Checks due",
					tone: dueChecks.length ? "attention" : "healthy",
					value: String(dueChecks.length)
				}
			],
			needsAttention: needsAttention.length ? needsAttention : ["No urgent blockers are currently open."],
			recentActivity: listActivity()
		};
	}

	function hasUsers() {
		const count = database.prepare("SELECT COUNT(*) AS count FROM admin_users").get() as unknown as DatabaseCountRow;
		return Number(count.count) > 0;
	}

	return {
		driver: "sqlite",
		authenticateUser,
		createCorrectionSubmission,
		createUser,
		getContentRecord,
		getHealth: () => ({ ok: true }),
		getOverview,
		hasUsers,
		listContent,
		listCorrections,
		listReview,
		listSourceMonitor,
		listUsers,
		updateContent,
		updateCorrection,
		updateSource
	};
}
