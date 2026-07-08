const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../database');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (config.adminDisabled && username === 'admin') {
    return res.status(403).json({ error: 'Admin account is disabled. Contact system administrator.' });
  }

  const user = get('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.username = ? AND u.is_active = 1', [username]);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'login', 'user', ?, ?)", [user.id, user.id, JSON.stringify({ username: user.username })]);

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role, department_id: user.department_id, department_name: user.department_name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );

  res.json({
    token,
    user: {
      id: user.id, username: user.username, full_name: user.full_name, email: user.email,
      role: user.role, department_id: user.department_id, department_name: user.department_name,
      avatar: user.avatar, phone: user.phone, job_title: user.job_title,
      signature: user.signature, last_login: user.last_login
    }
  });
});

router.get('/me', authenticate, (req, res) => {
  const user = get('SELECT u.*, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id, username: user.username, full_name: user.full_name, email: user.email,
    role: user.role, department_id: user.department_id, department_name: user.department_name,
    avatar: user.avatar, phone: user.phone, job_title: user.job_title,
    signature: user.signature, last_login: user.last_login, is_active: user.is_active
  });
});

router.put('/me', authenticate, (req, res) => {
  const { full_name, email, phone, signature, job_title } = req.body;
  run(`UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),
    phone = COALESCE(?, phone), signature = COALESCE(?, signature), job_title = COALESCE(?, job_title), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [full_name || null, email || null, phone || null, signature || null, job_title || null, req.user.id]);

  const user = get('SELECT id, username, full_name, email, phone, role, avatar, signature, job_title FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

router.put('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const user = get('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id]);
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'change_password', 'user', ?, ?)", [req.user.id, req.user.id, JSON.stringify({})]);

  res.json({ message: 'Password updated successfully' });
});

router.post('/avatar', authenticate, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarPath = `/uploads/${req.file.filename}`;
  run('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [avatarPath, req.user.id]);
  res.json({ avatar: avatarPath });
});

router.delete('/avatar', authenticate, (req, res) => {
  run('UPDATE users SET avatar = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id]);
  res.json({ message: 'Avatar removed' });
});

module.exports = router;
