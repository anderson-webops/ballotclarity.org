import type {
	AdminRepository,
	AdminRepositoryOptions,
} from "./admin-store.js";
import type {
	AdminActivityItem,
	AdminContentItem,
	AdminCorrectionRequest,
	AdminEntityType,
	AdminSourceMonitorItem,
	AdminUser,
	AdminUserRole,
} from "./types/civic.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
	defaultContentSeed,
	hashPassword,
	verifyPassword,
} from "./admin-store.js";
import {
	demoAdminCorrections,
	demoAdminOverview,
	demoAdminSourceMonitor,
} from "./coverage-data.js";

interface CountRow {
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
	status: AdminContentItem["status"];
	priority: AdminContentItem["priority"];
	updated_at: string;
	assigned_to: string;
	blocker: string | null;
	summary: string;
	public_summary: string | null;
	ballot_summary: string | null;
	source_coverage: string;
	published: boolean;
	published_at: string | null;
}

interface CorrectionRow {
	id: string;
	submission_type: AdminCorrectionRequest["submissionType"];
	subject: string;
	entity_type: AdminCorrectionRequest["entityType"];
	entity_label: string;
	status: AdminCorrectionRequest["status"];
	priority: AdminCorrectionRequest["priority"];
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
	health: AdminSourceMonitorItem["health"];
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

const packagedSchemaPath = new URL("./admin-schema.postgres.sql", import.meta.url);
const sourceSchemaPath = new URL("../admin-schema.postgres.sql", import.meta.url);

function resolvePostgresSchemaPath() {
	const packagedPathname = fileURLToPath(packagedSchemaPath);

	if (existsSync(packagedPathname))
		return packagedPathname;

	return fileURLToPath(sourceSchemaPath);
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
		published: row.published,
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

async function seedPostgresDatabase(pool: Pool, options: AdminRepositoryOptions) {
	const schema = readFileSync(resolvePostgresSchemaPath(), "utf8");
	await pool.query(schema);
	await pool.query("ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS public_summary TEXT");
	await pool.query("ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS ballot_summary TEXT");

	const usersCount = Number((await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_users")).rows[0]?.count ?? 0);
	const contentCount = Number((await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_content")).rows[0]?.count ?? 0);
	const correctionsCount = Number((await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_corrections")).rows[0]?.count ?? 0);
	const sourcesCount = Number((await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_source_monitors")).rows[0]?.count ?? 0);
	const activityCount = Number((await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_activity")).rows[0]?.count ?? 0);

	if (!contentCount) {
		for (const item of defaultContentSeed()) {
			await pool.query(`
				INSERT INTO admin_content (
					id, entity_type, entity_slug, title, status, priority, assigned_to, blocker, summary,
					public_summary, ballot_summary, source_coverage, published, published_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			`, [
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
				item.published,
				item.publishedAt || null,
				item.updatedAt
			]);
		}
	}

	for (const item of defaultContentSeed()) {
		await pool.query(`
			UPDATE admin_content
			SET public_summary = CASE
					WHEN public_summary IS NULL OR btrim(public_summary) = '' THEN $1
					ELSE public_summary
				END,
				ballot_summary = CASE
					WHEN ballot_summary IS NULL OR btrim(ballot_summary) = '' THEN $2
					ELSE ballot_summary
				END,
				published = CASE
					WHEN public_summary IS NULL OR btrim(public_summary) = '' THEN $3
					ELSE published
				END,
				published_at = CASE
					WHEN public_summary IS NULL OR btrim(public_summary) = '' THEN COALESCE(published_at, $4)
					ELSE published_at
				END
			WHERE entity_type = $5 AND entity_slug = $6
		`, [
			item.publicSummary,
			item.publicBallotSummary || null,
			item.published,
			item.publishedAt || null,
			item.entityType,
			item.entitySlug
		]);
	}

	if (!correctionsCount) {
		for (const item of demoAdminCorrections.corrections) {
			await pool.query(`
				INSERT INTO admin_corrections (
					id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at,
					reported_by, summary, next_step, source_count, page_url
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			`, [
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
			]);
		}
	}

	if (!sourcesCount) {
		for (const item of demoAdminSourceMonitor.sources) {
			await pool.query(`
				INSERT INTO admin_source_monitors (
					id, label, authority, health, last_checked_at, next_check_at, owner, note
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, [
				item.id,
				item.label,
				item.authority,
				item.health,
				item.lastCheckedAt,
				item.nextCheckAt,
				item.owner,
				item.note
			]);
		}
	}

	if (!activityCount) {
		for (const item of demoAdminOverview.recentActivity) {
			await pool.query(`
				INSERT INTO admin_activity (id, label, type, timestamp, summary)
				VALUES ($1, $2, $3, $4, $5)
			`, [item.id, item.label, item.type, item.timestamp, item.summary]);
		}
	}

	const bootstrapUsername = options.bootstrapUsername || process.env.ADMIN_BOOTSTRAP_USERNAME || process.env.ADMIN_USERNAME || null;
	const bootstrapPassword = options.bootstrapPassword || process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD || null;
	const bootstrapDisplayName = options.bootstrapDisplayName || process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || "Ballot Clarity Admin";
	const bootstrapRole = options.bootstrapRole || (process.env.ADMIN_BOOTSTRAP_ROLE as AdminUserRole | undefined) || "admin";

	if (!usersCount && bootstrapUsername && bootstrapPassword) {
		const now = new Date().toISOString();

		await pool.query(`
			INSERT INTO admin_users (
				id, username, display_name, role, password_hash, created_at, updated_at, last_login_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, [
			`user-${bootstrapUsername}`,
			bootstrapUsername.trim(),
			bootstrapDisplayName,
			bootstrapRole,
			hashPassword(bootstrapPassword),
			now,
			now,
			null
		]);
	}
}

export async function createPostgresAdminRepository(options: AdminRepositoryOptions = {}): Promise<AdminRepository> {
	const connectionString = options.databaseUrl || process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;

	if (!connectionString)
		throw new Error("Postgres admin store requires ADMIN_DATABASE_URL or DATABASE_URL.");

	const pool = new Pool({
		connectionString
	});

	await seedPostgresDatabase(pool, options);

	async function logActivity(type: AdminActivityItem["type"], label: string, summary: string) {
		const timestamp = new Date().toISOString();
		await pool.query(`
			INSERT INTO admin_activity (id, label, type, timestamp, summary)
			VALUES ($1, $2, $3, $4, $5)
		`, [`activity-${randomUUID()}`, label, type, timestamp, summary]);
	}

	async function listActivity(limit = 8) {
		const result = await pool.query<ActivityRow>(`
			SELECT id, label, type, timestamp, summary
			FROM admin_activity
			ORDER BY timestamp DESC
			LIMIT $1
		`, [limit]);

		return result.rows.map(rowToActivity);
	}

	const repository: AdminRepository = {
		driver: "postgres",
		async authenticateUser(username, password) {
			const normalized = username.trim().toLowerCase();
			const result = await pool.query<UserRow>(`
				SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
				FROM admin_users
				WHERE username = $1
			`, [normalized]);
			const row = result.rows[0];

			if (!row || !verifyPassword(password, row.password_hash))
				return null;

			const now = new Date().toISOString();
			await pool.query("UPDATE admin_users SET last_login_at = $1, updated_at = $1 WHERE id = $2", [now, row.id]);

			return {
				...rowToUser({ ...row, last_login_at: now }),
				lastLoginAt: now
			};
		},
		async createCorrectionSubmission(input) {
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

			await pool.query(`
				INSERT INTO admin_corrections (
					id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at,
					reported_by, summary, next_step, source_count, page_url
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			`, [
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
			]);

			await logActivity(
				"correction",
				input.submissionType === "correction" ? "Received correction submission" : "Received public feedback",
				`${subject} was submitted through the public contact form.`
			);

			return { ok: true, submittedAt: now };
		},
		async createUser(input) {
			const username = input.username.trim().toLowerCase();
			const displayName = input.displayName.trim();

			if (!username || !displayName || !input.password.trim())
				throw new Error("Display name, username, role, and password are required.");

			const existing = await pool.query<UserRow>(`
				SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
				FROM admin_users
				WHERE username = $1
			`, [username]);

			if (existing.rows[0])
				throw new Error("An admin user with that username already exists.");

			const now = new Date().toISOString();
			const id = `user-${randomUUID()}`;

			await pool.query(`
				INSERT INTO admin_users (
					id, username, display_name, role, password_hash, created_at, updated_at, last_login_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, [
				id,
				username,
				displayName,
				input.role,
				hashPassword(input.password),
				now,
				now,
				null
			]);

			await logActivity("review", `Created ${input.role} user`, `${displayName} can now access the internal editorial workspace.`);

			return {
				createdAt: now,
				displayName,
				id,
				role: input.role,
				username
			};
		},
		async getContentRecord(entityType, entitySlug) {
			const result = await pool.query<ContentRow>(`
				SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
				FROM admin_content
				WHERE entity_type = $1 AND entity_slug = $2
			`, [entityType, entitySlug]);

			return result.rows[0] ? rowToContent(result.rows[0]) : null;
		},
		async getHealth() {
			await pool.query("SELECT 1");
			return { ok: true };
		},
		async getOverview() {
			const content = (await repository.listContent()).items;
			const corrections = (await repository.listCorrections()).corrections;
			const sources = (await repository.listSourceMonitor()).sources;
			const healthySourceCount = sources.filter(item => item.health === "healthy").length;
			const openCorrections = corrections.filter(item => item.status !== "resolved");
			const reviewQueue = content.filter(item => item.status !== "published" || !item.published);
			const dueChecks = sources.filter(item => new Date(item.nextCheckAt).getTime() <= Date.now());
			const needsAttention = [
				...openCorrections.filter(item => item.priority === "high").slice(0, 2).map(item => `${item.subject}: ${item.nextStep}`),
				...content.filter(item => item.status === "needs-sources").slice(0, 2).map(item => `${item.title}: ${item.blocker || "Waiting on source coverage."}`),
				...sources.filter(item => item.health === "incident" || item.health === "stale").slice(0, 2).map(item => `${item.label}: ${item.note}`)
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
				recentActivity: await listActivity()
			};
		},
		async hasUsers() {
			const result = await pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM admin_users");
			return Number(result.rows[0]?.count ?? 0) > 0;
		},
		async listContent() {
			const result = await pool.query<ContentRow>(`
				SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
				FROM admin_content
				ORDER BY published ASC, priority DESC, updated_at DESC
			`);

			return { items: result.rows.map(rowToContent) };
		},
		async listCorrections() {
			const result = await pool.query<CorrectionRow>(`
				SELECT id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at, reported_by, summary, next_step, source_count, page_url
				FROM admin_corrections
				ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'triaged' THEN 1 WHEN 'researching' THEN 2 ELSE 3 END, submitted_at DESC
			`);

			return { corrections: result.rows.map(rowToCorrection) };
		},
		async listReview() {
			return {
				items: (await repository.listContent()).items.map(item => ({
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
		},
		async listSourceMonitor() {
			const result = await pool.query<SourceRow>(`
				SELECT id, label, authority, health, last_checked_at, next_check_at, owner, note
				FROM admin_source_monitors
				ORDER BY CASE health WHEN 'incident' THEN 0 WHEN 'stale' THEN 1 WHEN 'review-soon' THEN 2 ELSE 3 END, next_check_at ASC
			`);

			return { sources: result.rows.map(rowToSource) };
		},
		async listUsers() {
			const result = await pool.query<UserRow>(`
				SELECT id, username, display_name, role, created_at, last_login_at, password_hash, updated_at
				FROM admin_users
				ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, username
			`);

			return { users: result.rows.map(rowToUser) };
		},
		async updateContent(id, patch) {
			const currentResult = await pool.query<ContentRow>(`
				SELECT id, title, entity_type, entity_slug, status, priority, updated_at, assigned_to, blocker, summary, public_summary, ballot_summary, source_coverage, published, published_at
				FROM admin_content
				WHERE id = $1
			`, [id]);
			const current = currentResult.rows[0];

			if (!current)
				throw new Error("Content record not found.");

			const now = new Date().toISOString();
			const nextPublished = patch.published ?? current.published;
			const nextStatus = patch.status || (nextPublished ? "published" : current.status === "published" ? "in-review" : current.status);
			const nextPublishedAt = nextPublished ? current.published_at || now : null;
			const nextPublicSummary = patch.publicSummary === undefined ? current.public_summary || "" : patch.publicSummary.trim();

			if (!nextPublicSummary)
				throw new Error("Public page summary is required.");

			const nextBallotSummary = patch.publicBallotSummary === undefined
				? current.ballot_summary
				: patch.publicBallotSummary?.trim() || null;

			await pool.query(`
				UPDATE admin_content
				SET status = $1,
					priority = $2,
					assigned_to = $3,
					blocker = $4,
					public_summary = $5,
					ballot_summary = $6,
					published = $7,
					published_at = $8,
					updated_at = $9
				WHERE id = $10
			`, [
				nextStatus,
				patch.priority ?? current.priority,
				patch.assignedTo?.trim() || current.assigned_to,
				patch.blocker === undefined ? current.blocker : patch.blocker?.trim() || null,
				nextPublicSummary,
				nextBallotSummary,
				nextPublished,
				nextPublishedAt,
				now,
				id
			]);

			await logActivity(
				nextPublished ? "publish" : "review",
				`${current.title} updated`,
				nextPublished
					? `${current.title} is marked published and available for the public site.`
					: `${current.title} moved to ${nextStatus}.`
			);

			return await repository.listContent();
		},
		async updateCorrection(id, patch) {
			const currentResult = await pool.query<CorrectionRow>(`
				SELECT id, submission_type, subject, entity_type, entity_label, status, priority, submitted_at, reported_by, summary, next_step, source_count, page_url
				FROM admin_corrections
				WHERE id = $1
			`, [id]);
			const current = currentResult.rows[0];

			if (!current)
				throw new Error("Correction record not found.");

			await pool.query(`
				UPDATE admin_corrections
				SET status = $1, priority = $2, next_step = $3
				WHERE id = $4
			`, [
				patch.status ?? current.status,
				patch.priority ?? current.priority,
				patch.nextStep?.trim() || current.next_step,
				id
			]);

			await logActivity("correction", `${current.subject} updated`, `Correction item moved to ${patch.status ?? current.status}.`);

			return await repository.listCorrections();
		},
		async updateSource(id, patch) {
			const currentResult = await pool.query<SourceRow>(`
				SELECT id, label, authority, health, last_checked_at, next_check_at, owner, note
				FROM admin_source_monitors
				WHERE id = $1
			`, [id]);
			const current = currentResult.rows[0];

			if (!current)
				throw new Error("Source monitor record not found.");

			const now = new Date().toISOString();

			await pool.query(`
				UPDATE admin_source_monitors
				SET health = $1, last_checked_at = $2, next_check_at = $3, owner = $4, note = $5
				WHERE id = $6
			`, [
				patch.health ?? current.health,
				now,
				patch.nextCheckAt?.trim() || current.next_check_at,
				patch.owner?.trim() || current.owner,
				patch.note?.trim() || current.note,
				id
			]);

			await logActivity("source-check", `${current.label} updated`, `Source monitor status is now ${patch.health ?? current.health}.`);

			return await repository.listSourceMonitor();
		}
	};

	return repository;
}
