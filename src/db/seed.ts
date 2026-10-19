import "./load-env";

// Idempotent: running the seed twice must not create duplicates (AC-22).
// The CSV import of docs/source/voice_assistant_events.csv for "Демо" is added by the db task.
const { db } = await import("./client");
const { users } = await import("./schema");

await db.insert(users).values({ name: "Демо" }).onConflictDoNothing({ target: users.name });
console.log("Seed applied");
