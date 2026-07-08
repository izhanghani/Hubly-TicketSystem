const express = require('express');
const bcrypt = require('bcryptjs');
const { run, get, all } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const role = req.query.role || '';
  const department = req.query.department || '';
  const is_active = req.query.is_active;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role) { where += ' AND u.role = ?'; params.push(role); }
  if (department) { where += ' AND u.department_id = ?'; params.push(parseInt(department)); }
  if (is_active !== undefined && is_active !== '') { where += ' AND u.is_active = ?'; params.push(parseInt(is_active)); }

  const total = get(`SELECT COUNT(*) as c FROM users u ${where}`, params).c;
  const users = all(`SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.job_title, u.is_active, u.avatar, u.last_login, u.created_at, d.name as department_name, d.id as department_id
    FROM users u LEFT JOIN departments d ON u.department_id = d.id ${where} ORDER BY u.full_name ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);

  res.json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
});

router.get('/:id', authenticate, (req, res) => {
  const user = get('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  delete user.password;
  res.json(user);
});

router.post('/', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  const { username, password, full_name, email, phone, role, department_id, job_title } = req.body;
  if (!username || !password || !full_name || !email) {
    return res.status(400).json({ error: 'Username, password, full name, and email are required' });
  }

  const existing = get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) return res.status(409).json({ error: 'Username or email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = run(`INSERT INTO users (username, password, full_name, email, phone, role, department_id, job_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, hash, full_name, email, phone || '', role || 'user', department_id || null, job_title || '']);

  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'create_user', 'user', ?, ?)", [req.user.id, result.lastInsertRowid, JSON.stringify({ username })]);

  const user = get('SELECT id, username, full_name, email, role, is_active FROM users WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(user);
});

router.put('/:id', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  const { full_name, email, phone, role, department_id, job_title, is_active, password } = req.body;
  const sets = []; const params = [];

  if (full_name !== undefined) { sets.push('full_name = ?'); params.push(full_name); }
  if (email !== undefined) { sets.push('email = ?'); params.push(email); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
  if (role !== undefined) { sets.push('role = ?'); params.push(role); }
  if (department_id !== undefined) { sets.push('department_id = ?'); params.push(department_id || null); }
  if (job_title !== undefined) { sets.push('job_title = ?'); params.push(job_title); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (password) { sets.push('password = ?'); params.push(bcrypt.hashSync(password, 10)); }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'update_user', 'user', ?, ?)", [req.user.id, req.params.id, JSON.stringify(req.body)]);

  const user = get('SELECT id, username, full_name, email, phone, role, department_id, job_title, is_active, avatar FROM users WHERE id = ?', [req.params.id]);
  res.json(user);
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  run('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'deactivate_user', 'user', ?, ?)", [req.user.id, req.params.id, JSON.stringify({})]);
  res.json({ message: 'User deactivated' });
});

router.post('/ad-sync', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { default_role } = req.body;
    const { syncUsers } = require('../utils/ad-sync');
    const result = await syncUsers(default_role || 'user');
    run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'ad_sync', 'users', ?)", [req.user.id, JSON.stringify(result)]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', authenticate, authorize('admin'), (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Users array required' });
  const results = { created: 0, skipped: 0, errors: [] };
  users.forEach(u => {
    if (!u.username || !u.full_name || !u.email) { results.errors.push({ username: u.username, error: 'Missing required fields' }); return; }
    const existing = get('SELECT id FROM users WHERE username = ? OR email = ?', [u.username, u.email]);
    if (existing) { results.skipped++; return; }
    const hash = bcrypt.hashSync(u.password || 'Welcome123', 10);
    run('INSERT INTO users (username, password, full_name, email, phone, role, job_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [u.username, hash, u.full_name, u.email, u.phone || '', u.role || 'user', u.job_title || '']);
    results.created++;
  });
  run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'bulk_import', 'users', ?)", [req.user.id, JSON.stringify(results)]);
  res.json(results);
});

router.get('/stats/summary', authenticate, (req, res) => {
  const stats = {
    total: get('SELECT COUNT(*) as c FROM users').c,
    active: get("SELECT COUNT(*) as c FROM users WHERE is_active = 1").c,
    agents: get("SELECT COUNT(*) as c FROM users WHERE role IN ('agent','admin','supervisor') AND is_active = 1").c,
    admins: get("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND is_active = 1").c
  };
  res.json(stats);
});

module.exports = router;
