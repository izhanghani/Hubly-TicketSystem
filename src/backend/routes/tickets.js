const express = require('express');
const { run, get, all, getSetting } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { createSLA, checkSLA, markFirstResponse, markResolved, getSLAByTicketId } = require('../utils/sla-engine');
const { sendTicketNotification } = require('../utils/email');
const upload = require('../middleware/upload');

const router = express.Router();

function generateTicketNumber() {
  const prefix = get("SELECT value FROM settings WHERE key = 'ticket_prefix'").value || 'TKT';
  const last = get("SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
  let num = 1;
  if (last) {
    const parts = last.ticket_number.split('-');
    num = parseInt(parts[1], 10) + 1;
  }
  return `${prefix}-${String(num).padStart(6, '0')}`;
}

function getTicketDetail(id) {
  return get(`
    SELECT t.*, 
      tp.name as priority_name, tp.color as priority_color, tp.level as priority_level,
      tt.name as type_name, tt.icon as type_icon, tt.color as type_color,
      tc.name as category_name,
      d.name as department_name,
      requester.username as requester_name, requester.full_name as requester_full_name, requester.avatar as requester_avatar,
      assignee.username as assignee_name, assignee.full_name as assignee_full_name, assignee.avatar as assignee_avatar
    FROM tickets t
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users requester ON t.requester_id = requester.id
    LEFT JOIN users assignee ON t.assignee_id = assignee.id
    WHERE t.id = ?
  `, [id]);
}

router.get('/', authenticate, (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const priority = req.query.priority || '';
  const type = req.query.type || '';
  const assignee = req.query.assignee || '';
  const requester = req.query.requester || '';
  const department = req.query.department || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (req.user.role === 'user') {
    where += ' AND (t.requester_id = ? OR t.department_id = ?)';
    params.push(req.user.id, req.user.department_id);
  } else if (req.user.role === 'agent') {
    where += ' AND (t.assignee_id = ? OR t.department_id = ?)';
    params.push(req.user.id, req.user.department_id);
  } else if (req.user.role === 'supervisor') {
    where += ' AND (t.department_id = ? OR t.assignee_id = ? OR t.requester_id = ?)';
    params.push(req.user.department_id, req.user.id, req.user.id);
  }

  if (status) {
    const statuses = status.split(',');
    where += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  if (priority) { where += ' AND t.priority_id = ?'; params.push(parseInt(priority)); }
  if (type) { where += ' AND t.type_id = ?'; params.push(parseInt(type)); }
  if (assignee) { where += ' AND t.assignee_id = ?'; params.push(parseInt(assignee)); }
  if (requester) { where += ' AND t.requester_id = ?'; params.push(parseInt(requester)); }
  if (department) { where += ' AND t.department_id = ?'; params.push(parseInt(department)); }
  if (dateFrom) { where += ' AND t.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND t.created_at <= ?'; params.push(dateTo + ' 23:59:59'); }
  if (search) {
    where += ' AND (t.title LIKE ? OR t.ticket_number LIKE ? OR t.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const total = get(`SELECT COUNT(*) as c FROM tickets t ${where}`, params).c;
  const tickets = all(`
    SELECT t.id, t.ticket_number, t.title, t.status, t.priority_id, t.created_at, t.updated_at, t.resolved_at, t.requester_id, t.assignee_id, t.is_private,
      tp.name as priority_name, tp.color as priority_color, tp.level as priority_level,
      tt.name as type_name, tt.icon as type_icon, tt.color as type_color,
      tc.name as category_name,
      requester.full_name as requester_name, requester.avatar as requester_avatar,
      assignee.full_name as assignee_name, assignee.avatar as assignee_avatar,
      se.response_breached, se.resolution_breached
    FROM tickets t
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    LEFT JOIN users requester ON t.requester_id = requester.id
    LEFT JOIN users assignee ON t.assignee_id = assignee.id
    LEFT JOIN sla_entries se ON t.id = se.ticket_id
    ${where}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  res.json({ tickets, total, page, limit, totalPages: Math.ceil(total / limit) });
});

router.get('/:id', authenticate, (req, res) => {
  const ticket = getTicketDetail(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.user.role === 'user') {
    const canAccess = ticket.requester_id === req.user.id || ticket.department_id === req.user.department_id || ticket.assignee_id === req.user.id;
    if (!canAccess) return res.status(403).json({ error: 'Access denied' });
  } else if (req.user.role === 'agent') {
    const canAccess = ticket.assignee_id === req.user.id || ticket.department_id === req.user.department_id || ticket.requester_id === req.user.id;
    if (!canAccess) return res.status(403).json({ error: 'Access denied' });
  } else if (req.user.role === 'supervisor') {
    const canAccess = ticket.department_id === req.user.department_id || ticket.assignee_id === req.user.id || ticket.requester_id === req.user.id;
    if (!canAccess) return res.status(403).json({ error: 'Access denied' });
  }

  const sla = getSLAByTicketId(ticket.id);
  const comments = all(`
    SELECT tc.*, u.full_name as user_name, u.avatar as user_avatar, u.role as user_role
    FROM ticket_comments tc JOIN users u ON tc.user_id = u.id
    WHERE tc.ticket_id = ? ORDER BY tc.created_at ASC
  `, [ticket.id]);
  const attachments = all(`
    SELECT ta.*, u.full_name as uploaded_by_name
    FROM ticket_attachments ta JOIN users u ON ta.uploaded_by = u.id
    WHERE ta.ticket_id = ? ORDER BY ta.created_at DESC
  `, [ticket.id]);
  const history = all(`
    SELECT th.*, u.full_name as user_name
    FROM ticket_history th LEFT JOIN users u ON th.user_id = u.id
    WHERE th.ticket_id = ? ORDER BY th.created_at DESC LIMIT 50
  `, [ticket.id]);

  res.json({ ...ticket, sla, comments, attachments, history });
});

router.post('/', authenticate, (req, res) => {
  const { title, description, type_id, category_id, priority_id, department_id, is_private, assignee_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const ticketNumber = generateTicketNumber();
  const result = run(`INSERT INTO tickets 
    (ticket_number, title, description, status, priority_id, type_id, category_id, requester_id, department_id, is_private, assignee_id)
    VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
    [ticketNumber, title, description || '', priority_id || null, type_id || null, category_id || null, req.user.id, department_id || null, is_private ? 1 : 0, assignee_id || null]);

  const ticketId = result.lastInsertRowid;

  if (assignee_id) {
    addHistory(ticketId, req.user.id, 'assignee', null, assignee_id);
  }

  if (priority_id && getSetting('feature_sla_tracking')) {
    createSLA(ticketId, priority_id, null, req.user.role, type_id || null);
  }

  if (!assignee_id && getSetting('feature_auto_assign')) {
    try {
      const rules = all(`
        SELECT wr.* FROM workflow_rules wr WHERE wr.is_active = 1 ORDER BY wr.priority ASC, wr.created_at ASC
      `);
      const requester = get("SELECT role, department_id FROM users WHERE id = ?", [req.user.id]);
      let matched = false;
      for (const rule of rules) {
        if (rule.match_type_id && rule.match_type_id !== (type_id || null)) continue;
        if (rule.match_category_id && rule.match_category_id !== (category_id || null)) continue;
        if (rule.match_priority_id && rule.match_priority_id !== (priority_id || null)) continue;
        if (rule.match_department_id && rule.match_department_id !== (department_id || null)) continue;
        if (rule.match_requester_role && rule.match_requester_role !== (requester?.role || '')) continue;

        let assigneeId = null;
        let deptId = null;

        if (rule.assign_type === 'department' && rule.assign_department_id) {
          deptId = rule.assign_department_id;
          const firstAgent = get("SELECT id FROM users WHERE department_id = ? AND role IN ('agent','admin','supervisor') AND is_active = 1 ORDER BY last_login ASC LIMIT 1", [rule.assign_department_id]);
          if (firstAgent) assigneeId = firstAgent.id;
        } else if (rule.assign_type === 'agent' && rule.assign_agent_id) {
          assigneeId = rule.assign_agent_id;
          const agentUser = get("SELECT department_id FROM users WHERE id = ?", [rule.assign_agent_id]);
          if (agentUser) deptId = agentUser.department_id;
        } else if (rule.assign_type === 'role' && rule.assign_role) {
          const availableAgent = get("SELECT id, department_id FROM users WHERE role = ? AND is_active = 1 ORDER BY last_login ASC LIMIT 1", [rule.assign_role]);
          if (availableAgent) { assigneeId = availableAgent.id; deptId = availableAgent.department_id; }
        }

        if (assigneeId || deptId) {
          const sets = ['updated_at = CURRENT_TIMESTAMP', 'workflow_rule_id = ?'];
          const p = [rule.id];
          if (assigneeId) { sets.push('assignee_id = ?'); p.push(assigneeId); }
          if (deptId) { sets.push('department_id = ?'); p.push(deptId); }
          p.push(ticketId);
          run(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`, p);
          addHistory(ticketId, req.user.id, 'assignee', null, assigneeId);
          if (deptId) addHistory(ticketId, req.user.id, 'department', null, deptId);
        }
        matched = true;
        break;
      }

      if (!matched) {
        const anyAgent = get("SELECT id FROM users WHERE role IN ('agent','admin','supervisor') AND is_active = 1 ORDER BY last_login ASC LIMIT 1");
        if (anyAgent) {
          run('UPDATE tickets SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [anyAgent.id, ticketId]);
          addHistory(ticketId, req.user.id, 'assignee', null, anyAgent.id);
        }
      }
    } catch (e) {
      console.error('[Workflow] Evaluation error:', e.message);
    }
  }

  run("INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value) VALUES (?, ?, 'status', NULL, 'open')", [ticketId, req.user.id]);
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'create_ticket', 'ticket', ?, ?)", [req.user.id, ticketId, JSON.stringify({ ticket_number: ticketNumber, title })]);

  const ticket = getTicketDetail(ticketId);
  res.status(201).json(ticket);
});

router.put('/:id', authenticate, (req, res) => {
  const existing = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'user' && existing.requester_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { title, description, status, priority_id, type_id, category_id, assignee_id, department_id, is_private, resolution_notes } = req.body;

  if (status === 'closed') {
    const isSupervisorOrAdmin = ['admin', 'supervisor'].includes(req.user.role);
    if (!isSupervisorOrAdmin && existing.assignee_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the assigned agent or admin can close this ticket.' });
    }
  }

  const fields = []; const params = [];

  if (title !== undefined && title !== existing.title) { fields.push('title = ?'); params.push(title); addHistory(req.params.id, req.user.id, 'title', existing.title, title); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (status !== undefined && status !== existing.status) {
    fields.push('status = ?'); params.push(status);
    addHistory(req.params.id, req.user.id, 'status', existing.status, status);
    if (status === 'resolved' || status === 'closed') {
      fields.push('resolved_at = CURRENT_TIMESTAMP');
      markResolved(req.params.id);
      if (status === 'closed') { fields.push('closed_by = ?'); params.push(req.user.id); fields.push('closed_at = CURRENT_TIMESTAMP'); }
    }
  }
  if (priority_id !== undefined && priority_id !== existing.priority_id) {
    fields.push('priority_id = ?'); params.push(priority_id || null);
    addHistory(req.params.id, req.user.id, 'priority', existing.priority_id, priority_id);
    if (getSetting('feature_sla_tracking')) {
      const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
      createSLA(req.params.id, priority_id, null, req.user.role, ticket?.type_id || null);
    }
  }
  if (type_id !== undefined) { fields.push('type_id = ?'); params.push(type_id || null); }
  if (category_id !== undefined) { fields.push('category_id = ?'); params.push(category_id || null); }
  if (assignee_id !== undefined && assignee_id !== existing.assignee_id) {
    fields.push('assignee_id = ?'); params.push(assignee_id || null);
    addHistory(req.params.id, req.user.id, 'assignee', existing.assignee_id, assignee_id);
  }
  if (department_id !== undefined) { fields.push('department_id = ?'); params.push(department_id || null); }
  if (is_private !== undefined) { fields.push('is_private = ?'); params.push(is_private ? 1 : 0); }
  if (resolution_notes !== undefined) { fields.push('resolution_notes = ?'); params.push(resolution_notes); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);

  run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, params);

  if (status === 'resolved' || status === 'closed') markResolved(req.params.id);

  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'update_ticket', 'ticket', ?, ?)", [req.user.id, req.params.id, JSON.stringify({ fields: Object.keys(req.body) })]);

  const ticket = getTicketDetail(req.params.id);
  res.json(ticket);
});

router.post('/:id/comments', authenticate, (req, res) => {
  const existing = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });

  const canComment = (
    req.user.role === 'admin' ||
    existing.requester_id === req.user.id ||
    existing.assignee_id === req.user.id ||
    existing.department_id === req.user.department_id
  );
  if (!canComment) return res.status(403).json({ error: 'Access denied' });

  const { comment, is_internal } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment is required' });

  if (existing.status === 'open' && existing.assignee_id) {
    run("UPDATE tickets SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
  }

  const result = run('INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, comment, is_internal ? 1 : 0]);

  markFirstResponse(req.params.id);

  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'add_comment', 'ticket', ?, ?)", [req.user.id, req.params.id, JSON.stringify({ comment_id: result.lastInsertRowid })]);

  const commentData = get(`
    SELECT tc.*, u.full_name as user_name, u.avatar as user_avatar, u.role as user_role
    FROM ticket_comments tc JOIN users u ON tc.user_id = u.id WHERE tc.id = ?
  `, [result.lastInsertRowid]);

  res.status(201).json(commentData);
});

router.post('/:id/attachments', authenticate, upload.array('files', 10), (req, res) => {
  if (!getSetting('feature_attachments')) return res.status(403).json({ error: 'File attachments are disabled by admin' });
  const existing = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'user' && existing.requester_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const inserted = [];
  req.files.forEach(file => {
    const result = run('INSERT INTO ticket_attachments (ticket_id, filename, original_name, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, file.filename, file.originalname, file.mimetype, file.size, req.user.id]);
    inserted.push({ id: result.lastInsertRowid, filename: file.filename, original_name: file.originalname, size: file.size, mime_type: file.mimetype });
  });

  res.status(201).json(inserted);
});

router.get('/:id/attachments/:attachmentId/download', authenticate, (req, res) => {
  const attachment = get('SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?', [req.params.attachmentId, req.params.id]);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  const filePath = require('path').join(require('../config').uploadDir, attachment.filename);
  res.download(filePath, attachment.original_name);
});

router.post('/:id/request-assignment', authenticate, (req, res) => {
  const ticket = get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { agent_id, note } = req.body;
  const existing = get('SELECT id FROM assignment_requests WHERE ticket_id = ? AND requester_id = ? AND status = ?', [req.params.id, req.user.id, 'pending']);
  if (existing) return res.status(400).json({ error: 'Already have a pending request' });
  const result = run('INSERT INTO assignment_requests (ticket_id, requester_id, requested_agent_id, note) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, agent_id || null, note || '']);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Assignment request submitted' });
});

router.get('/:id/assignment-requests', authenticate, (req, res) => {
  const requests = all(`
    SELECT ar.*, u.full_name as requester_name, u2.full_name as agent_name
    FROM assignment_requests ar
    LEFT JOIN users u ON ar.requester_id = u.id
    LEFT JOIN users u2 ON ar.requested_agent_id = u2.id
    WHERE ar.ticket_id = ? ORDER BY ar.created_at DESC
  `, [req.params.id]);
  res.json(requests);
});

router.put('/assignment-requests/:id', authenticate, authorize('admin', 'supervisor'), (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const request = get('SELECT * FROM assignment_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  run('UPDATE assignment_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
  if (status === 'approved') {
    run('UPDATE tickets SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [request.requested_agent_id || request.requester_id, request.ticket_id]);
  }
  res.json({ message: `Request ${status}` });
});

router.get('/export/csv', authenticate, (req, res) => {
  if (!getSetting('feature_export')) return res.status(403).json({ error: 'Data export is disabled by admin' });
  const search = req.query.search || '';
  const status = req.query.status || '';
  const priority = req.query.priority || '';
  const type = req.query.type || '';
  const assignee = req.query.assignee || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';

  let where = 'WHERE 1=1';
  const params = [];

  if (req.user.role === 'user') { where += ' AND (t.requester_id = ? OR t.department_id = ?)'; params.push(req.user.id, req.user.department_id); }
  else if (req.user.role === 'agent') { where += ' AND (t.assignee_id = ? OR t.department_id = ?)'; params.push(req.user.id, req.user.department_id); }
  else if (req.user.role === 'supervisor') { where += ' AND (t.department_id = ? OR t.assignee_id = ? OR t.requester_id = ?)'; params.push(req.user.department_id, req.user.id, req.user.id); }

  if (status) { const ss = status.split(','); where += ` AND t.status IN (${ss.map(() => '?').join(',')})`; params.push(...ss); }
  if (priority) { where += ' AND t.priority_id = ?'; params.push(parseInt(priority)); }
  if (type) { where += ' AND t.type_id = ?'; params.push(parseInt(type)); }
  if (assignee) { where += ' AND t.assignee_id = ?'; params.push(parseInt(assignee)); }
  if (dateFrom) { where += ' AND t.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND t.created_at <= ?'; params.push(dateTo + ' 23:59:59'); }
  if (search) { where += ' AND (t.title LIKE ? OR t.ticket_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const tickets = all(`
    SELECT t.ticket_number, t.title, t.status, t.source, t.created_at, t.resolved_at, t.closed_at,
      tp.name as priority_name,
      tt.name as type_name,
      tc.name as category_name,
      d.name as department_name,
      requester.full_name as requester_name,
      assignee.full_name as assignee_name,
      se.response_breached, se.resolution_breached
    FROM tickets t
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users requester ON t.requester_id = requester.id
    LEFT JOIN users assignee ON t.assignee_id = assignee.id
    LEFT JOIN sla_entries se ON t.id = se.ticket_id
    ${where}
    ORDER BY t.created_at DESC
  `, params);

  const headers = ['Ticket Number','Title','Status','Priority','Type','Category','Department','Requester','Assignee','Source','Created','Resolved','Closed','SLA Breached'];
  const csvRows = [headers.join(',')];
  tickets.forEach(t => {
    const row = [
      `"${t.ticket_number}"`, `"${(t.title || '').replace(/"/g, '""')}"`, `"${t.status}"`,
      `"${t.priority_name || ''}"`, `"${t.type_name || ''}"`, `"${t.category_name || ''}"`,
      `"${t.department_name || ''}"`, `"${t.requester_name || ''}"`, `"${t.assignee_name || ''}"`,
      `"${t.source || ''}"`, `"${t.created_at || ''}"`, `"${t.resolved_at || ''}"`, `"${t.closed_at || ''}"`,
      (t.response_breached || t.resolution_breached) ? 'Yes' : 'No'
    ];
    csvRows.push(row.join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="tickets-export-${Date.now()}.csv"`);
  res.send(csvRows.join('\n'));
});

router.get('/stats/summary', authenticate, (req, res) => {
  let where = ''; const params = [];
  if (req.user.role === 'user') { where = 'WHERE (t.requester_id = ? OR t.department_id = ?)'; params.push(req.user.id, req.user.department_id); }
  else if (req.user.role === 'agent') { where = 'WHERE (t.assignee_id = ? OR t.department_id = ?)'; params.push(req.user.id, req.user.department_id); }
  else if (req.user.role === 'supervisor') { where = 'WHERE (t.department_id = ? OR t.assignee_id = ? OR t.requester_id = ?)'; params.push(req.user.department_id, req.user.id, req.user.id); }

  const stats = {
    total: get(`SELECT COUNT(*) as c FROM tickets t ${where}`, params).c,
    open: get(`SELECT COUNT(*) as c FROM tickets t ${where}${where ? ' AND' : 'WHERE'} t.status IN ('open','in_progress','pending')`, params).c,
    resolved: get(`SELECT COUNT(*) as c FROM tickets t ${where}${where ? ' AND' : 'WHERE'} t.status IN ('resolved','closed')`, params).c,
    unassigned: get("SELECT COUNT(*) as c FROM tickets t WHERE t.assignee_id IS NULL AND t.status NOT IN ('closed','cancelled')").c,
    breached: get("SELECT COUNT(*) as c FROM tickets t JOIN sla_entries se ON t.id = se.ticket_id WHERE (se.response_breached = 1 OR se.resolution_breached = 1) AND t.status NOT IN ('closed','cancelled')").c,
    byStatus: all(`SELECT t.status, COUNT(*) as count FROM tickets t ${where} GROUP BY t.status`, params),
    byPriority: all(`SELECT tp.name, tp.color, COUNT(*) as count FROM tickets t JOIN ticket_priorities tp ON t.priority_id = tp.id ${where} GROUP BY tp.name, tp.color`, params)
  };
  res.json(stats);
});

function addHistory(ticketId, userId, field, oldVal, newVal) {
  run('INSERT INTO ticket_history (ticket_id, user_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
    [ticketId, userId, field, oldVal != null ? String(oldVal) : null, newVal != null ? String(newVal) : null]);
}

module.exports = router;
