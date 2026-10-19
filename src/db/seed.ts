import "./load-env";
import { readFileSync } from "node:fs";

// Idempotent: running the seed twice must not create duplicates (AC-22).
// Creates the user «Демо» and imports docs/source/voice_assistant_events.csv for it (ADR-006).
const { db } = await import("./client");
const { importCsv, parseCsv } = await import("./csv-import");
const { backfillNameKeys, getOrCreateUser } = await import("./users");

const now = new Date();
await backfillNameKeys(db);
const demo = await getOrCreateUser(db, "Демо", now);
const rows = parseCsv(readFileSync("docs/source/voice_assistant_events.csv", "utf8"));
const inserted = await importCsv(db, demo.id, rows, now);
console.log(`Seed applied: user «Демо» (id ${demo.id}), ${inserted} of ${rows.length} CSV rows inserted`);
