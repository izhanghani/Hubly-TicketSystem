const express = require('express');
const path = require('path');
const { run, get, all } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const settings = all('SELECT * FROM settings ORDER BY category, key');
  const grouped = {};
  settings.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    let val = s.value;
    if (s.type === 'boolean') val = val === 'true';
    else if (s.type === 'number') val = parseFloat(val);
    else if (s.type === 'json') { try { val = JSON.parse(val); } catch {} }
    grouped[s.category].push({ id: s.id, key: s.key, value: val, type: s.type, description: s.description });
  });
  res.json(grouped);
});

router.put('/', authenticate, authorize('admin'), (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Settings object required' });

  const flatten = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}_${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key);
      } else {
        const val = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
        const existing = get('SELECT id FROM settings WHERE key = ?', [key]);
        if (existing) {
          run('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [val, key]);
        } else {
          const type = typeof v === 'boolean' ? 'boolean' : 'text';
          run('INSERT INTO settings (key, value, type) VALUES (?, ?, ?)', [key, val, type]);
        }
      }
    }
  };
  flatten(settings, '');

  run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'update_settings', 'settings', ?)", [req.user.id, JSON.stringify({ keys: Object.keys(settings) })]);

  res.json(all('SELECT * FROM settings ORDER BY category, key'));
});

router.get('/departments', authenticate, (req, res) => {
  res.json(all('SELECT * FROM departments ORDER BY name ASC'));
});

router.post('/departments', authenticate, authorize('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });
  const result = run('INSERT INTO departments (name, description) VALUES (?, ?)', [name, description || '']);
  res.status(201).json(get('SELECT * FROM departments WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/departments/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, description } = req.body;
  if (name) run('UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, req.params.id]);
  if (description !== undefined) run('UPDATE departments SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [description, req.params.id]);
  res.json(get('SELECT * FROM departments WHERE id = ?', [req.params.id]));
});

router.delete('/departments/:id', authenticate, authorize('admin'), (req, res) => {
  const count = get('SELECT COUNT(*) as c FROM users WHERE department_id = ?', [req.params.id]).c;
  if (count > 0) return res.status(400).json({ error: `Department has ${count} users. Reassign them first.` });
  run('DELETE FROM departments WHERE id = ?', [req.params.id]);
  res.json({ message: 'Department deleted' });
});

router.get('/types', authenticate, (req, res) => {
  const types = all('SELECT * FROM ticket_types WHERE is_active = 1 ORDER BY name ASC');
  const categories = all('SELECT * FROM ticket_categories WHERE is_active = 1 ORDER BY name ASC');
  res.json({ types, categories });
});

router.post('/types', authenticate, authorize('admin'), (req, res) => {
  const { name, description, icon, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Type name required' });
  const result = run('INSERT INTO ticket_types (name, description, icon, color) VALUES (?, ?, ?, ?)', [name, description || '', icon || 'ticket', color || '#6c757d']);
  res.status(201).json(get('SELECT * FROM ticket_types WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/types/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, description, icon, color, is_active } = req.body;
  const sets = []; const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description); }
  if (icon !== undefined) { sets.push('icon = ?'); params.push(icon); }
  if (color !== undefined) { sets.push('color = ?'); params.push(color); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields' });
  params.push(req.params.id);
  run(`UPDATE ticket_types SET ${sets.join(', ')} WHERE id = ?`, params);
  res.json(get('SELECT * FROM ticket_types WHERE id = ?', [req.params.id]));
});

router.post('/categories', authenticate, authorize('admin'), (req, res) => {
  const { type_id, name, description } = req.body;
  if (!type_id || !name) return res.status(400).json({ error: 'Type ID and name required' });
  const result = run('INSERT INTO ticket_categories (type_id, name, description) VALUES (?, ?, ?)', [type_id, name, description || '']);
  res.status(201).json(get('SELECT * FROM ticket_categories WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/categories/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, description, is_active } = req.body;
  if (name) run('UPDATE ticket_categories SET name = ? WHERE id = ?', [name, req.params.id]);
  if (description !== undefined) run('UPDATE ticket_categories SET description = ? WHERE id = ?', [description, req.params.id]);
  if (is_active !== undefined) run('UPDATE ticket_categories SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
  res.json(get('SELECT * FROM ticket_categories WHERE id = ?', [req.params.id]));
});

router.post('/logo', authenticate, authorize('admin'), upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const logoPath = `/uploads/${req.file.filename}`;
  run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'app_logo'", [logoPath]);
  res.json({ logo: logoPath });
});

router.post('/favicon', authenticate, authorize('admin'), upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const faviconPath = `/uploads/${req.file.filename}`;
  run("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'app_favicon'", [faviconPath]);
  res.json({ favicon: faviconPath });
});

router.get('/audit-logs', authenticate, authorize('admin'), (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = (page - 1) * limit;
  const action = req.query.action || '';

  let where = ''; const params = [];
  if (action) { where = 'WHERE al.action = ?'; params.push(action); }

  const total = get(`SELECT COUNT(*) as c FROM audit_logs al ${where}`, params).c;
  const logs = all(`
    SELECT al.*, u.full_name as user_name, u.username
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${where}
    ORDER BY al.created_at DESC LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
});

module.exports = router;
