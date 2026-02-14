const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('chords.db');

function initialize() {
    const schema = fs.readFileSync('./schema.sql', 'utf-8');
    const seed = fs.readFileSync('./seed.sql', 'utf-8');

    db.exec(schema);
    db.exec(seed);
}

module.exports = { db, initialize };