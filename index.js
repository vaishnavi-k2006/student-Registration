// backend/index.js

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');

/* Table "habits" stores all created habits with creation timestamp */
db.prepare(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`).run();

/* Table "checkins" stores daily habit completion records with unique (habit_id, date) */
db.prepare(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`).run();

/* 
This function calculates a streak by checking consecutive days of check-ins.
If today has no check-in, it still counts from yesterday. If neither today nor
yesterday has a check-in, streak is 0. Then it continues backward day by day.
*/
function calculateStreak(habitId) {
  const rows = db.prepare(
    `SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC`
  ).all(habitId);

  const dateSet = new Set(rows.map(r => r.date));

  const today = new Date();
  const format = (d) => d.toISOString().split('T')[0];

  let current = new Date(today);
  let streak = 0;

  const todayStr = format(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = format(yesterday);

  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
    return 0;
  }

  if (!dateSet.has(todayStr)) {
    current = yesterday;
  }

  while (true) {
    const dateStr = format(current);
    if (dateSet.has(dateStr)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/* ROUTE A — Create a new habit */
app.post('/habits', (req, res) => {
  const name = req.body.name;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const created_at = new Date().toISOString();

  const stmt = db.prepare(
    `INSERT INTO habits (name, created_at) VALUES (?, ?)`
  );

  const result = stmt.run(name.trim(), created_at);

  const habit = {
    id: result.lastInsertRowid,
    name: name.trim(),
    created_at,
    streak: 0
  };

  res.status(201).json(habit);
});

/* ROUTE B — Get all habits with streaks */
app.get('/habits', (req, res) => {
  const habits = db.prepare(
    `SELECT * FROM habits ORDER BY created_at ASC`
  ).all();

  const enriched = habits.map(h => ({
    ...h,
    streak: calculateStreak(h.id)
  }));

  res.status(200).json(enriched);
});

/* ROUTE C — Check in a habit for a date */
app.post('/habits/:id/checkin', (req, res) => {
  const habitId = Number(req.params.id);

  const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`).get(habitId);

  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const date =
    req.body.date ||
    new Date().toISOString().split('T')[0];

  try {
    const stmt = db.prepare(
      `INSERT INTO checkins (habit_id, date, checked_at)
       VALUES (?, ?, ?)`
    );

    const result = stmt.run(habitId, date, new Date().toISOString());

    const streak = calculateStreak(habitId);

    res.status(201).json({
      id: result.lastInsertRowid,
      habit_id: habitId,
      date,
      checked_at: new Date().toISOString(),
      streak
    });
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({
        error: 'Already checked in for this date'
      });
    }
    throw err;
  }
});

/* ROUTE D — Get all checkin dates for a habit */
app.get('/habits/:id/checkins', (req, res) => {
  const habitId = Number(req.params.id);

  const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`).get(habitId);

  if (!habit) {
    return res.status(404).json({ error: 'Habit not found' });
  }

  const rows = db.prepare(
    `SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC`
  ).all(habitId);

  res.status(200).json(rows.map(r => r.date));
});

/* ROUTE E — Delete a specific checkin */
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const habitId = Number(req.params.id);
  const date = req.params.date;

  db.prepare(
    `DELETE FROM checkins WHERE habit_id = ? AND date = ?`
  ).run(habitId, date);

  res.status(200).json({ message: 'Checkin removed' });
});

/* ROUTE F — Delete a habit and all its data */
app.delete('/habits/:id', (req, res) => {
  const habitId = Number(req.params.id);

  db.prepare(`DELETE FROM checkins WHERE habit_id = ?`).run(habitId);
  db.prepare(`DELETE FROM habits WHERE id = ?`).run(habitId);

  res.status(200).json({
    message: `Habit ${habitId} and its checkins deleted`
  });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});