const express = require('express');
const { run, get, all } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/policies', authenticate, (req, res) => {
  const policies = all(`
    SELECT sp.*, tp.name as priority_name, tp.color as priority_color
    FROM sla_policies sp LEFT JOIN ticket_priorities tp ON sp.priority_id = tp.id
    ORDER BY tp.level ASC
  `);
  res.json(policies);
});

router.post('/policies', authenticate, authorize('admin'), (req, res) => {
  const { name, priority_id, requester_role, ticket_type_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, business_hours_only } = req.body;
  if (!name || !priority_id || !response_time_minutes || !resolution_time_minutes) {
    return res.status(400).json({ error: 'Name, priority, response time, and resolution time are required' });
  }

  const result = run(`INSERT INTO sla_policies (name, priority_id, requester_role, ticket_type_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, business_hours_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, priority_id, requester_role || '', ticket_type_id || null, response_time_minutes, resolution_time_minutes, escalation_time_minutes || 0, business_hours_only !== undefined ? (business_hours_only ? 1 : 0) : 1]);

  const policy = get('SELECT * FROM sla_policies WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(policy);
});

router.put('/policies/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, priority_id, requester_role, ticket_type_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, business_hours_only, is_active } = req.body;
  const sets = []; const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (priority_id !== undefined) { sets.push('priority_id = ?'); params.push(priority_id); }
  if (requester_role !== undefined) { sets.push('requester_role = ?'); params.push(requester_role); }
  if (ticket_type_id !== undefined) { sets.push('ticket_type_id = ?'); params.push(ticket_type_id || null); }
  if (response_time_minutes !== undefined) { sets.push('response_time_minutes = ?'); params.push(response_time_minutes); }
  if (resolution_time_minutes !== undefined) { sets.push('resolution_time_minutes = ?'); params.push(resolution_time_minutes); }
  if (escalation_time_minutes !== undefined) { sets.push('escalation_time_minutes = ?'); params.push(escalation_time_minutes); }
  if (business_hours_only !== undefined) { sets.push('business_hours_only = ?'); params.push(business_hours_only ? 1 : 0); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  sets.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  run(`UPDATE sla_policies SET ${sets.join(', ')} WHERE id = ?`, params);
  const policy = get('SELECT * FROM sla_policies WHERE id = ?', [req.params.id]);
  res.json(policy);
});

router.delete('/policies/:id', authenticate, authorize('admin'), (req, res) => {
  run('UPDATE sla_policies SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
  res.json({ message: 'SLA policy deactivated' });
});

router.get('/priorities', authenticate, (req, res) => {
  res.json(all('SELECT * FROM ticket_priorities WHERE is_active = 1 ORDER BY level ASC'));
});

router.post('/priorities', authenticate, authorize('admin'), (req, res) => {
  const { name, level, color, sla_response_minutes, sla_resolution_minutes } = req.body;
  if (!name || level === undefined) return res.status(400).json({ error: 'Name and level are required' });

  const result = run('INSERT INTO ticket_priorities (name, level, color, sla_response_minutes, sla_resolution_minutes) VALUES (?, ?, ?, ?, ?)',
    [name, level, color || '#6c757d', sla_response_minutes || 60, sla_resolution_minutes || 480]);
  res.status(201).json(get('SELECT * FROM ticket_priorities WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/priorities/:id', authenticate, authorize('admin'), (req, res) => {
  const { name, level, color, sla_response_minutes, sla_resolution_minutes, is_active } = req.body;
  const sets = []; const params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name); }
  if (level !== undefined) { sets.push('level = ?'); params.push(level); }
  if (color !== undefined) { sets.push('color = ?'); params.push(color); }
  if (sla_response_minutes !== undefined) { sets.push('sla_response_minutes = ?'); params.push(sla_response_minutes); }
  if (sla_resolution_minutes !== undefined) { sets.push('sla_resolution_minutes = ?'); params.push(sla_resolution_minutes); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields' });
  params.push(req.params.id);
  run(`UPDATE ticket_priorities SET ${sets.join(', ')} WHERE id = ?`, params);
  res.json(get('SELECT * FROM ticket_priorities WHERE id = ?', [req.params.id]));
});

router.delete('/priorities/:id', authenticate, authorize('admin'), (req, res) => {
  run('UPDATE ticket_priorities SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Priority deactivated' });
});

module.exports = router;
