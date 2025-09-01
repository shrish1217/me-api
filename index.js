const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new sqlite3.Database("./meapi.db", (err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to SQLite database.");
  }
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      bio TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      level TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      link TEXT
    )
  `);
});

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
// POST: create profile
app.post("/profile", (req, res) => {
  const { name, email, bio } = req.body;
  const sql = "INSERT INTO profile (name, email, bio) VALUES (?, ?, ?)";
  db.run(sql, [name, email, bio], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      id: this.lastID,
      name,
      email,
      bio
    });
  });
});
// GET: fetch profile by id
app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM profile WHERE id = ?";
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(row);
  });
});
// PUT: update profile by id
app.put("/profile/:id", (req, res) => {
  const { id } = req.params;
  const { name, email, bio } = req.body;
  const sql = "UPDATE profile SET name = ?, email = ?, bio = ? WHERE id = ?";
  db.run(sql, [name, email, bio, id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({
      id,
      name,
      email,
      bio
    });
  });
});
// DELETE: remove profile by id
app.delete("/profile/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM profile WHERE id = ?";
  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json({ message: `Profile with id ${id} deleted successfully` });
  });
});
// GET: fetch all profiles
app.get("/profiles", (req, res) => {
  const sql = "SELECT * FROM profile";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});



app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
