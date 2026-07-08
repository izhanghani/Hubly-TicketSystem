const express = require('express');
const { run, get, all } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/rules', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  const rules = all(`
    SELECT wr.*,
      mt.name as match_type_name, mc.name as match_category_name,
      mp.name as match_priority_name, md.name as match_department_name,
      ad.name as assign_department_name, ag.full_name as assign_agent_name
    FROM workflow_rules wr
    LEFT JOIN ticket_types mt ON wr.match_type_id = mt.id
    LEFT JOIN ticket_categories mc ON wr.match_category_id = mc.id
    LEFT JOIN ticket_priorities mp ON wr.match_priority_id = mp.id
    LEFT JOIN departments md ON wr.match_department_id = md.id
    LEFT JOIN departments ad ON wr.assign_department_id = ad.id
    LEFT JOIN users ag ON wr.assign_agent_id = ag.id
    ORDER BY wr.priority ASC, wr.created_at DESC
  `);
  res.json(rules);
});

router.post('/rules', authenticate, authorize('admin'), (req, res) => {
  const { name, description, match_type_id, match_category_id, match_priority_id, match_department_id, match_requester_role, assign_type, assign_department_id, assign_agent_id, assign_role, priority } = req.body;
  if (!name || !assign_type) return res.status(400).json({ error: 'Name and assign type are required' });

  const result = run(`INSERT INTO workflow_rules 
    (name, description, match_type_id, match_category_id, match_priority_id, match_department_id, match_requester_role, assign_type, assign_department_id, assign_agent_id, assign_role, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', match_type_id || null, match_category_id || null, match_priority_id || null, match_department_id || null, match_requester_role || '', assign_type, assign_department_id || null, assign_agent_id || null, assign_role || '', priority || 0]);

  res.status(201).json(get('SELECT * FROM workflow_rules WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/rules/:id', authenticate, authorize('admin'), (req, res) => {
  const existing = get('SELECT * FROM workflow_rules WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Rule not found' });

  const fields = []; const params = [];
  const { name, description, match_type_id, match_category_id, match_priority_id, match_department_id, match_requester_role, assign_type, assign_department_id, assign_agent_id, assign_role, priority, is_active } = req.body;

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (match_type_id !== undefined) { fields.push('match_type_id = ?'); params.push(match_type_id || null); }
  if (match_category_id !== undefined) { fields.push('match_category_id = ?'); params.push(match_category_id || null); }
  if (match_priority_id !== undefined) { fields.push('match_priority_id = ?'); params.push(match_priority_id || null); }
  if (match_department_id !== undefined) { fields.push('match_department_id = ?'); params.push(match_department_id || null); }
  if (match_requester_role !== undefined) { fields.push('match_requester_role = ?'); params.push(match_requester_role); }
  if (assign_type !== undefined) { fields.push('assign_type = ?'); params.push(assign_type); }
  if (assign_department_id !== undefined) { fields.push('assign_department_id = ?'); params.push(assign_department_id || null); }
  if (assign_agent_id !== undefined) { fields.push('assign_agent_id = ?'); params.push(assign_agent_id || null); }
  if (assign_role !== undefined) { fields.push('assign_role = ?'); params.push(assign_role); }
  if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  run(`UPDATE workflow_rules SET ${fields.join(', ')} WHERE id = ?`, params);
  res.json(get('SELECT * FROM workflow_rules WHERE id = ?', [req.params.id]));
});

router.delete('/rules/:id', authenticate, authorize('admin'), (req, res) => {
  run('DELETE FROM workflow_rules WHERE id = ?', [req.params.id]);
  res.json({ message: 'Rule deleted' });
});

router.post('/evaluate', authenticate, (req, res) => {
  const { type_id, category_id, priority_id, department_id, requester_role } = req.body;
  const rules = all(`
    SELECT wr.*, ad.name as assign_department_name, ag.full_name as assign_agent_name
    FROM workflow_rules wr
    LEFT JOIN departments ad ON wr.assign_department_id = ad.id
    LEFT JOIN users ag ON wr.assign_agent_id = ag.id
    WHERE wr.is_active = 1
    ORDER BY wr.priority ASC, wr.created_at ASC
  `);

  for (const rule of rules) {
    if (rule.match_type_id && rule.match_type_id !== type_id) continue;
    if (rule.match_category_id && rule.match_category_id !== category_id) continue;
    if (rule.match_priority_id && rule.match_priority_id !== priority_id) continue;
    if (rule.match_department_id && rule.match_department_id !== department_id) continue;
    if (rule.match_requester_role && rule.match_requester_role !== requester_role) continue;

    let assignee_id = null;
    let department_id_to_set = null;

    if (rule.assign_type === 'department' && rule.assign_department_id) {
      department_id_to_set = rule.assign_department_id;
      const firstAgent = get("SELECT id FROM users WHERE department_id = ? AND role IN ('agent','admin','supervisor') AND is_active = 1 ORDER BY last_login ASC LIMIT 1", [rule.assign_department_id]);
      if (firstAgent) assignee_id = firstAgent.id;
    } else if (rule.assign_type === 'agent' && rule.assign_agent_id) {
      assignee_id = rule.assign_agent_id;
      const agentUser = get("SELECT department_id FROM users WHERE id = ?", [rule.assign_agent_id]);
      if (agentUser) department_id_to_set = agentUser.department_id;
    } else if (rule.assign_type === 'role' && rule.assign_role) {
      const availableAgent = get("SELECT id, department_id FROM users WHERE role = ? AND is_active = 1 ORDER BY last_login ASC LIMIT 1", [rule.assign_role]);
      if (availableAgent) { assignee_id = availableAgent.id; department_id_to_set = availableAgent.department_id; }
    }

    return res.json({ matched: true, rule, assignee_id, department_id: department_id_to_set });
  }

  res.json({ matched: false });
});

module.exports = router;
