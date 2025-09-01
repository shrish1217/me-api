const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.resolve(__dirname, 'meapi.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
    } else {
        console.log("✅ Connected to SQLite database.");
        // Create tables and seed data upon successful connection
        createTablesAndSeedData();
    }
});

function createTablesAndSeedData() {
    db.serialize(() => {
        // Drop tables if they exist to start fresh
        db.run("DROP TABLE IF EXISTS links");
        db.run("DROP TABLE IF EXISTS project_skills");
        db.run("DROP TABLE IF EXISTS projects");
        db.run("DROP TABLE IF EXISTS skills");
        db.run("DROP TABLE IF EXISTS profile");

        // Profile table
        db.run(`
            CREATE TABLE profile (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                education TEXT,
                work TEXT
            )
        `);

        // Skills table
        db.run(`
            CREATE TABLE skills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )
        `);

        // Projects table
        db.run(`
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                links TEXT -- JSON string
            )
        `);

        // Project_Skills join table for many-to-many relationship
        db.run(`
            CREATE TABLE project_skills (
                project_id INTEGER,
                skill_id INTEGER,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (skill_id) REFERENCES skills(id),
                PRIMARY KEY (project_id, skill_id)
            )
        `);

        // Links table
        db.run(`
            CREATE TABLE links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github TEXT,
                linkedin TEXT,
                portfolio TEXT
            )
        `);

        // Seed the database with your real data (you)
        const profileStmt = db.prepare("INSERT INTO profile (id, name, email, education, work) VALUES (?, ?, ?, ?, ?)");
        profileStmt.run(1, 'Your Name', 'your.email@example.com', 'B.S. in Computer Science, University of XYZ', 'Software Engineer at Company ABC');
        profileStmt.finalize();

        const skillsStmt = db.prepare("INSERT INTO skills (name) VALUES (?)");
        ['JavaScript', 'Node.js', 'Express', 'React', 'SQLite', 'Python', 'Machine Learning'].forEach(skill => skillsStmt.run(skill));
        skillsStmt.finalize();

        const projectsStmt = db.prepare("INSERT INTO projects (title, description, links) VALUES (?, ?, ?)");
        projectsStmt.run('Project 1: Me-API Playground', 'A backend API for managing a candidate\'s profile.', JSON.stringify(['http://project1.com', 'http://github.com/project1']));
        projectsStmt.run('Data Analysis Project', 'A project using Python for data analysis.', JSON.stringify(['http://data-project.com']));
        projectsStmt.finalize();

        const projectSkillsStmt = db.prepare("INSERT INTO project_skills (project_id, skill_id) VALUES (?, ?)");
        projectSkillsStmt.run(1, 1); // Project 1, JavaScript
        projectSkillsStmt.run(1, 2); // Project 1, Node.js
        projectSkillsStmt.run(1, 3); // Project 1, Express
        projectSkillsStmt.run(1, 5); // Project 1, SQLite
        projectSkillsStmt.run(2, 6); // Data Analysis Project, Python
        projectSkillsStmt.finalize();

        const linksStmt = db.prepare("INSERT INTO links (github, linkedin, portfolio) VALUES (?, ?, ?)");
        linksStmt.run('https://github.com/shrish1217'
, 'https://linkedin.com/in/shrish-vats-855678313', 'https://your-portfolio.com');
        linksStmt.finalize();

        console.log("Database seeded with sample data.");
    });
}

// Routes
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Profile endpoints
app.get("/profile", (req, res) => {
    const profileSql = "SELECT * FROM profile WHERE id = 1";
    const skillsSql = "SELECT name FROM skills";
    const linksSql = "SELECT github, linkedin, portfolio FROM links WHERE id = 1";

    db.get(profileSql, [], (err, profileRow) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!profileRow) return res.status(404).json({ error: "Profile not found" });

        db.all(skillsSql, [], (err, skillsRows) => {
            if (err) return res.status(500).json({ error: err.message });
            const skills = skillsRows.map(row => row.name);

            db.get(linksSql, [], (err, linksRow) => {
                if (err) return res.status(500).json({ error: err.message });
                const links = linksRow || {};

                const fullProfile = {
                    name: profileRow.name,
                    email: profileRow.email,
                    education: profileRow.education,
                    work: profileRow.work,
                    skills,
                    links
                };
                res.json(fullProfile);
            });
        });
    });
});

app.put("/profile", (req, res) => {
    const { name, email, education, work } = req.body;
    const sql = "UPDATE profile SET name = ?, email = ?, education = ?, work = ? WHERE id = 1";
    db.run(sql, [name, email, education, work], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profile updated successfully" });
    });
});

// Projects endpoints
app.get("/projects", (req, res) => {
    const { skill } = req.query;
    let sql = "SELECT p.*, s.name as skill_name FROM projects p JOIN project_skills ps ON p.id = ps.project_id JOIN skills s ON ps.skill_id = s.id";
    let params = [];

    if (skill) {
        sql += " WHERE s.name LIKE ?";
        params.push(`%${skill}%`);
    }

    sql += " GROUP BY p.id";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const projects = rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            links: JSON.parse(row.links)
        }));
        res.json(projects);
    });
});

// Other endpoints (optional but good practice)
app.post("/projects", (req, res) => {
    const { title, description, links, skills } = req.body;
    const linksJson = JSON.stringify(links);
    db.run("INSERT INTO projects (title, description, links) VALUES (?, ?, ?)", [title, description, linksJson], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const projectId = this.lastID;

        if (skills && skills.length > 0) {
            const stmt = db.prepare("INSERT INTO project_skills (project_id, skill_id) VALUES (?, (SELECT id FROM skills WHERE name = ?))");
            skills.forEach(skillName => {
                stmt.run(projectId, skillName);
            });
            stmt.finalize(() => {
                res.status(201).json({ id: projectId, title, description, links, skills });
            });
        } else {
            res.status(201).json({ id: projectId, title, description, links });
        }
    });
});

app.get("/search", (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: "Query parameter 'q' is required." });
    }
    const searchTerm = `%${q}%`;
    const sql = `
        SELECT 'profile' AS type, name, email FROM profile WHERE name LIKE ? OR email LIKE ?
        UNION ALL
        SELECT 'projects' AS type, title, description FROM projects WHERE title LIKE ? OR description LIKE ?
        UNION ALL
        SELECT 'skills' AS type, name, '' AS description FROM skills WHERE name LIKE ?
    `;
    db.all(sql, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get("/skills/top", (req, res) => {
    const sql = `
        SELECT s.name, COUNT(ps.project_id) as project_count
        FROM skills s
        JOIN project_skills ps ON s.id = ps.skill_id
        GROUP BY s.name
        ORDER BY project_count DESC
        LIMIT 5;
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});