const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('chords.db');

function initialize() {
    const schema = fs.readFileSync('./server/schema.sql', 'utf-8');
    const seed = fs.readFileSync('./server/seed.sql', 'utf-8');

    db.exec(schema);
    db.exec(seed);
}

module.exports = { db, initialize };