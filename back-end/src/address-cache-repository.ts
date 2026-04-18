import type { CensusAddressLookupResult } from "./census-geocoder.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

export interface CachedAddressLookup extends CensusAddressLookupResult {
	fromCache: true;
}

export interface AddressCacheRepository {
	driver: "none" | "postgres";
	getByInput: (input: string) => Promise<CachedAddressLookup | null>;
	save: (input: string, lookup: CensusAddressLookupResult) => Promise<void>;
}

interface AddressLookupRow {
	id: string;
	normalized_address: string;
	zip5: string;
	state: string | null;
	county_fips: string | null;
	latitude: number | null;
	longitude: number | null;
	census_benchmark: string;
	census_vintage: string;
}

interface DistrictAssignmentRow {
	district_type: string;
	district_code: string;
	district_label: string;
	source_system: string;
}

const packagedSchemaPath = new URL("./live-data-schema.sql", import.meta.url);
const sourceSchemaPath = new URL("../live-data-schema.sql", import.meta.url);

function normalizeLookupInput(input: string) {
	return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function hashLookupInput(input: string) {
	return createHash("sha256").update(normalizeLookupInput(input)).digest("hex");
}

function resolveSchemaPath() {
	const packagedPathname = fileURLToPath(packagedSchemaPath);

	if (existsSync(packagedPathname))
		return packagedPathname;

	return fileURLToPath(sourceSchemaPath);
}

function mapCachedLookup(row: AddressLookupRow, districtRows: DistrictAssignmentRow[]): CachedAddressLookup {
	const districtMatches = districtRows.map(item => ({
		districtCode: item.district_code,
		districtType: item.district_type,
		id: `${item.district_type}:${item.district_code}`,
		label: item.district_label,
		sourceSystem: item.source_system
	})).sort((left, right) => left.districtType.localeCompare(right.districtType) || left.label.localeCompare(right.label));

	return {
		benchmark: row.census_benchmark,
		countyFips: row.county_fips || undefined,
		districtMatches,
		fromCache: true,
		latitude: row.latitude ?? undefined,
		longitude: row.longitude ?? undefined,
		normalizedAddress: row.normalized_address,
		state: row.state || undefined,
		vintage: row.census_vintage,
		zip5: row.zip5
	};
}

async function createPostgresAddressCacheRepository(databaseUrl: string): Promise<AddressCacheRepository> {
	const pool = new Pool({
		connectionString: databaseUrl
	});

	await pool.query(readFileSync(resolveSchemaPath(), "utf8"));
	await pool.query("ALTER TABLE district_assignments ADD COLUMN IF NOT EXISTS district_label TEXT");
	await pool.query("UPDATE district_assignments SET district_label = COALESCE(NULLIF(district_label, ''), district_code)");
	await pool.query("ALTER TABLE district_assignments ALTER COLUMN district_label SET NOT NULL");

	return {
		driver: "postgres",
		async getByInput(input) {
			const inputHash = hashLookupInput(input);
			const lookupResult = await pool.query<AddressLookupRow>(`
				SELECT id, normalized_address, zip5, state, county_fips, latitude, longitude, census_benchmark, census_vintage
				FROM address_lookups
				WHERE input_hash = $1
			`, [inputHash]);
			const row = lookupResult.rows[0];

			if (!row)
				return null;

			const districtResult = await pool.query<DistrictAssignmentRow>(`
				SELECT district_type, district_code, district_label, source_system
				FROM district_assignments
				WHERE address_lookup_id = $1
				ORDER BY district_type ASC, district_code ASC
			`, [row.id]);

			return mapCachedLookup(row, districtResult.rows);
		},
		async save(input, lookup) {
			const inputHash = hashLookupInput(input);
			const connection = await pool.connect();

			try {
				await connection.query("BEGIN");

				const lookupResult = await connection.query<{ id: string }>(`
					INSERT INTO address_lookups (
						input_hash, normalized_address, zip5, state, county_fips, latitude, longitude, census_benchmark, census_vintage, updated_at
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
					ON CONFLICT (input_hash) DO UPDATE
					SET normalized_address = EXCLUDED.normalized_address,
						zip5 = EXCLUDED.zip5,
						state = EXCLUDED.state,
						county_fips = EXCLUDED.county_fips,
						latitude = EXCLUDED.latitude,
						longitude = EXCLUDED.longitude,
						census_benchmark = EXCLUDED.census_benchmark,
						census_vintage = EXCLUDED.census_vintage,
						updated_at = NOW()
					RETURNING id
				`, [
					inputHash,
					lookup.normalizedAddress,
					lookup.zip5 || "",
					lookup.state || null,
					lookup.countyFips || null,
					lookup.latitude ?? null,
					lookup.longitude ?? null,
					lookup.benchmark,
					lookup.vintage
				]);

				const lookupId = lookupResult.rows[0]?.id;

				if (!lookupId)
					throw new Error("Unable to persist address lookup cache record.");

				await connection.query(`
					DELETE FROM district_assignments
					WHERE address_lookup_id = $1
				`, [lookupId]);

				for (const district of lookup.districtMatches) {
					await connection.query(`
						INSERT INTO district_assignments (
							address_lookup_id, district_type, district_code, district_label, source_system, effective_date
						) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
					`, [
						lookupId,
						district.districtType,
						district.districtCode,
						district.label,
						district.sourceSystem
					]);
				}

				await connection.query("COMMIT");
			}
			catch (error) {
				await connection.query("ROLLBACK");
				throw error;
			}
			finally {
				connection.release();
			}
		}
	};
}

export async function createAddressCacheRepository(databaseUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || ""): Promise<AddressCacheRepository> {
	const resolvedDatabaseUrl = databaseUrl.trim();

	if (!resolvedDatabaseUrl) {
		return {
			driver: "none",
			async getByInput() {
				return null;
			},
			async save() {}
		};
	}

	return await createPostgresAddressCacheRepository(resolvedDatabaseUrl);
}
