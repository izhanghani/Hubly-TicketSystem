const express = require('express');
const { get, all } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const isAgentOrAdmin = ['admin', 'supervisor', 'agent'].includes(role);

  let ticketWhere = '';
  const params = [];
  if (role === 'user') { ticketWhere = 'WHERE t.requester_id = ?'; params.push(userId); }

  const totalTickets = get(`SELECT COUNT(*) as c FROM tickets t ${ticketWhere}`, params).c;
  const openTickets = get(`SELECT COUNT(*) as c FROM tickets t ${ticketWhere}${ticketWhere ? ' AND' : 'WHERE'} t.status IN ('open','in_progress','pending')`, params).c;
  const resolvedTickets = get(`SELECT COUNT(*) as c FROM tickets t ${ticketWhere}${ticketWhere ? ' AND' : 'WHERE'} t.status IN ('resolved','closed')`, params).c;

  const myTickets = isAgentOrAdmin
    ? get("SELECT COUNT(*) as c FROM tickets t WHERE t.assignee_id = ? AND t.status NOT IN ('closed','cancelled')", [userId]).c
    : 0;

  const breachedSLA = get("SELECT COUNT(*) as c FROM tickets t JOIN sla_entries se ON t.id = se.ticket_id WHERE (se.response_breached = 1 OR se.resolution_breached = 1) AND t.status NOT IN ('closed','cancelled')").c;

  const ticketsByStatus = all(`SELECT t.status, COUNT(*) as count FROM tickets t ${ticketWhere} GROUP BY t.status`, params);
  const ticketsByPriority = all(`SELECT tp.id, tp.name, tp.color, tp.level, COUNT(*) as count FROM tickets t JOIN ticket_priorities tp ON t.priority_id = tp.id ${ticketWhere} GROUP BY tp.id, tp.name, tp.color, tp.level ORDER BY tp.level ASC`, params);

  const recentTickets = all(`
    SELECT t.id, t.ticket_number, t.title, t.status, t.created_at,
      tp.name as priority_name, tp.color as priority_color,
      tt.name as type_name, tt.icon as type_icon, tt.color as type_color,
      u.full_name as requester_name
    FROM tickets t
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.id
    LEFT JOIN ticket_types tt ON t.type_id = tt.id
    LEFT JOIN users u ON t.requester_id = u.id
    ${ticketWhere}
    ORDER BY t.created_at DESC LIMIT 10
  `, params);

  const ticketsOverTime = all(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM tickets t ${ticketWhere}
    GROUP BY DATE(created_at)
    ORDER BY date DESC LIMIT 30
  `, params);

  const recentActivity = all(`
    SELECT 'ticket_created' as type, t.ticket_number || ' created' as text, 'bi-plus-circle' as icon, t.created_at as created_at
    FROM tickets t ORDER BY t.created_at DESC LIMIT 5
  `, []);

  res.json({
    totalTickets, openTickets, resolvedTickets, myTickets, breachedSLA,
    ticketsByStatus, ticketsByPriority, recentTickets, ticketsOverTime, recentActivity
  });
});

router.get('/agent-performance', authenticate, authorizeAdmin, (req, res) => {
  const data = all(`
    SELECT u.id, u.full_name, u.avatar,
      COUNT(DISTINCT t.id) as assigned_tickets,
      SUM(CASE WHEN t.status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolved_tickets,
      ROUND(AVG(CASE WHEN t.status IN ('resolved','closed') AND t.resolved_at IS NOT NULL THEN 
        (julianday(t.resolved_at) - julianday(t.created_at)) * 24 * 60 ELSE NULL END)) as avg_resolution_minutes,
      SUM(CASE WHEN se.response_breached = 1 OR se.resolution_breached = 1 THEN 1 ELSE 0 END) as breached_sla
    FROM users u
    LEFT JOIN tickets t ON t.assignee_id = u.id
    LEFT JOIN sla_entries se ON se.ticket_id = t.id
    WHERE u.role IN ('agent','admin','supervisor') AND u.is_active = 1
    GROUP BY u.id
    ORDER BY resolved_tickets DESC
  `);
  res.json(data);
});

function authorizeAdmin(req, res, next) {
  if (!['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

module.exports = router;
