import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const app = express();
const port = process.env.PORT || 3001;
const secret = process.env.JWT_SECRET || 'daymark-local-development-secret';
const here = path.dirname(fileURLToPath(import.meta.url));
const dataFolder = path.join(here, 'data');
fs.mkdirSync(dataFolder, { recursive: true });

const db = new DatabaseSync(path.join(dataFolder, 'daymark.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    due_date TEXT,
    type TEXT NOT NULL DEFAULT 'Task',
    priority TEXT NOT NULL DEFAULT 'Medium',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(cors());
app.use(express.json());

function sendError(res, error, status = 400) {
  return res.status(status).json({ error });
}

function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return sendError(res, 'Please sign in to continue.', 401);
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return sendError(res, 'Your session has expired. Please sign in again.', 401);
  }
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 6) {
    return sendError(res, 'Add your name, a valid email, and a password with at least 6 characters.');
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);
    const user = { id: result.lastInsertRowid, name, email };
    return res.status(201).json({ user, token: jwt.sign(user, secret, { expiresIn: '7d' }) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return sendError(res, 'An account with this email already exists.');
    return sendError(res, 'Could not create your account. Please try again.', 500);
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const savedUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!savedUser || !(await bcrypt.compare(password, savedUser.password))) {
    return sendError(res, 'Email or password is incorrect.', 401);
  }
  const user = publicUser(savedUser);
  return res.json({ user, token: jwt.sign(user, secret, { expiresIn: '7d' }) });
});

app.get('/api/auth/me', requireUser, (req, res) => {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  if (!user) return sendError(res, 'Account not found.', 404);
  return res.json({ user });
});

app.put('/api/auth/account', requireUser, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email) return sendError(res, 'Name and email are required.');
  try {
    if (password) {
      if (password.length < 6) return sendError(res, 'Password must have at least 6 characters.');
      const hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(name, email, hash, req.user.id);
    } else {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
    }
    const user = { id: req.user.id, name, email };
    return res.json({ user, token: jwt.sign(user, secret, { expiresIn: '7d' }) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return sendError(res, 'That email is already in use.');
    return sendError(res, 'Could not update your account.', 500);
  }
});

app.delete('/api/auth/account', requireUser, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  return res.json({ message: 'Account deleted.' });
});

app.get('/api/tasks', requireUser, (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY completed ASC, due_date IS NULL, due_date ASC, id DESC').all(req.user.id);
  return res.json({ tasks });
});

app.post('/api/tasks', requireUser, (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return sendError(res, 'A task needs a title.');
  const result = db.prepare(`INSERT INTO tasks (user_id, title, notes, due_date, type, priority)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    req.user.id, title, String(req.body.notes || '').trim(), req.body.dueDate || null,
    req.body.type === 'Habit' ? 'Habit' : 'Task', ['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : 'Medium',
  );
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
  return res.status(201).json({ task });
});

app.put('/api/tasks/:id', requireUser, (req, res) => {
  const current = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!current) return sendError(res, 'Task not found.', 404);
  const title = String(req.body.title ?? current.title).trim();
  if (!title) return sendError(res, 'A task needs a title.');
  db.prepare(`UPDATE tasks SET title = ?, notes = ?, due_date = ?, type = ?, priority = ?, completed = ?
    WHERE id = ? AND user_id = ?`).run(
    title, String(req.body.notes ?? current.notes).trim(), req.body.dueDate === undefined ? current.due_date : req.body.dueDate || null,
    req.body.type === 'Habit' ? 'Habit' : req.body.type === 'Task' ? 'Task' : current.type,
    ['Low', 'Medium', 'High'].includes(req.body.priority) ? req.body.priority : current.priority,
    req.body.completed === undefined ? current.completed : (req.body.completed ? 1 : 0), current.id, req.user.id,
  );
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(current.id, req.user.id);
  return res.json({ task });
});

app.delete('/api/tasks/:id', requireUser, (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!result.changes) return sendError(res, 'Task not found.', 404);
  return res.json({ message: 'Task deleted.' });
});

app.use(express.static(path.join(here, '..', 'dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(here, '..', 'dist', 'index.html'));
});

app.listen(port, () => console.log(`Daymark API running at http://localhost:${port}`));
