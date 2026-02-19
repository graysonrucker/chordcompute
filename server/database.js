const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Store DB inside /server/data (Docker volume mounts here)
const dbPath = path.join(dataDir, 'chords.db');
const db = new sqlite3.Database(dbPath);

function initialize() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const seedPath   = path.join(__dirname, 'seed.sql');

    const schema = fs.readFileSync(schemaPath, 'utf8');
    const seed   = fs.readFileSync(seedPath, 'utf8');

    db.serialize(() => {
        db.exec(schema);

        // Only seed if tables are empty
        db.get("SELECT COUNT(*) AS count FROM notes", (err, row) => {
            if (err) {
                console.error("Seed check failed:", err.message);
                return;
            }

            if (row.count === 0) {
                db.exec(seed);
                console.log("Database seeded.");
            }
        });
    });
}

module.exports = { db, initialize };