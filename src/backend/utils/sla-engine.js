const { get, all, run } = require('../database');

const businessDays = [1, 2, 3, 4, 5];
let businessHoursStart = 9;
let businessHoursEnd = 18;

function loadSettings() {
  try {
    const start = get("SELECT value FROM settings WHERE key = 'business_hours_start'");
    const end = get("SELECT value FROM settings WHERE key = 'business_hours_end'");
    const days = get("SELECT value FROM settings WHERE key = 'business_days'");
    if (start) businessHoursStart = parseInt(start.value, 10);
    if (end) businessHoursEnd = parseInt(end.value, 10);
    if (days) {
      businessDays.length = 0;
      businessDays.push(...days.value.split(',').map(Number));
    }
  } catch (_) {}
}

function isBusinessHour(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const time = h + m / 60;
  return businessDays.includes(date.getDay()) && time >= businessHoursStart && time < businessHoursEnd;
}

function addBusinessMinutes(date, minutes) {
  loadSettings();
  let remaining = minutes;
  let current = new Date(date);

  while (remaining > 0) {
    if (isBusinessHour(current)) {
      const endOfDay = new Date(current);
      endOfDay.setHours(businessHoursEnd, 0, 0, 0);
      const minsLeftInDay = Math.max(0, (endOfDay - current) / 60000);
      if (minsLeftInDay >= remaining) {
        current = new Date(current.getTime() + remaining * 60000);
        remaining = 0;
      } else {
        remaining -= minsLeftInDay;
        current = new Date(current);
        current.setDate(current.getDate() + 1);
        current.setHours(businessHoursStart, 0, 0, 0);
        if (!businessDays.includes(current.getDay())) continue;
      }
    } else {
      current = new Date(current);
      current.setDate(current.getDate() + 1);
      current.setHours(businessHoursStart, 0, 0, 0);
    }
  }
  return current;
}

function addCalendarMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function createSLA(ticketId, priorityId, policyId, requesterRole, ticketTypeId) {
  let policy = null;

  if (policyId) {
    policy = get('SELECT * FROM sla_policies WHERE id = ?', [policyId]);
  } else {
    // Find best matching SLA policy: try to match priority + role + type
    if (requesterRole && ticketTypeId) {
      policy = get('SELECT * FROM sla_policies WHERE priority_id = ? AND requester_role = ? AND ticket_type_id = ? AND is_active = 1 LIMIT 1',
        [priorityId, requesterRole, ticketTypeId]);
    }
    // Fall back to priority + role
    if (!policy && requesterRole) {
      policy = get('SELECT * FROM sla_policies WHERE priority_id = ? AND requester_role = ? AND ticket_type_id IS NULL AND is_active = 1 LIMIT 1',
        [priorityId, requesterRole]);
    }
    // Fall back to priority + type
    if (!policy && ticketTypeId) {
      policy = get(`SELECT * FROM sla_policies WHERE priority_id = ? AND ticket_type_id = ? AND requester_role = '' AND is_active = 1 LIMIT 1`,
        [priorityId, ticketTypeId]);
    }
    // Fall back to just priority
    if (!policy) {
      policy = get(`SELECT * FROM sla_policies WHERE priority_id = ? AND requester_role = '' AND ticket_type_id IS NULL AND is_active = 1 LIMIT 1`,
        [priorityId]);
    }
    // Fall back to any active policy
    if (!policy) {
      policy = get('SELECT * FROM sla_policies WHERE is_active = 1 LIMIT 1');
    }
  }

  if (!policy) return null;

  const now = new Date();
  const addMins = policy.business_hours_only ? addBusinessMinutes : addCalendarMinutes;
  const responseDeadline = addMins(now, policy.response_time_minutes);
  const resolutionDeadline = addMins(now, policy.resolution_time_minutes);
  const escalationDeadline = policy.escalation_time_minutes
    ? addMins(now, policy.escalation_time_minutes) : null;

  const result = run(`INSERT INTO sla_entries 
    (ticket_id, policy_id, response_deadline, resolution_deadline, escalation_deadline) 
    VALUES (?, ?, ?, ?, ?)`,
    [ticketId, policy.id, responseDeadline.toISOString(), resolutionDeadline.toISOString(), escalationDeadline?.toISOString() || null]);

  return result.lastInsertRowid;
}

function checkSLA(ticketId) {
  const sla = get('SELECT * FROM sla_entries WHERE ticket_id = ?', [ticketId]);
  if (!sla) return null;

  const now = new Date();
  const updates = [];

  if (!sla.first_response_at && new Date(sla.response_deadline) < now) updates.push("response_breached = 1");
  if (!sla.resolved_at && new Date(sla.resolution_deadline) < now) updates.push("resolution_breached = 1");
  if (sla.escalation_deadline && !sla.escalation_triggered && new Date(sla.escalation_deadline) < now) updates.push("escalation_triggered = 1");

  if (updates.length > 0) {
    run(`UPDATE sla_entries SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?`, [ticketId]);
  }

  return get('SELECT * FROM sla_entries WHERE ticket_id = ?', [ticketId]);
}

function markFirstResponse(ticketId) {
  const sla = get('SELECT * FROM sla_entries WHERE ticket_id = ?', [ticketId]);
  if (!sla) return;

  run(`UPDATE sla_entries SET first_response_at = CURRENT_TIMESTAMP, 
    response_breached = CASE WHEN ? > response_deadline THEN 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?`, [new Date().toISOString(), ticketId]);
}

function markResolved(ticketId) {
  const sla = get('SELECT * FROM sla_entries WHERE ticket_id = ?', [ticketId]);
  if (!sla) return;

  const now = new Date().toISOString();
  run(`UPDATE sla_entries SET resolved_at = ?, 
    resolution_breached = CASE WHEN ? > resolution_deadline THEN 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP WHERE ticket_id = ?`, [now, now, ticketId]);
}

function getSLAByTicketId(ticketId) {
  return get(`SELECT se.*, sp.name as policy_name, sp.response_time_minutes, sp.resolution_time_minutes
    FROM sla_entries se JOIN sla_policies sp ON se.policy_id = sp.id
    WHERE se.ticket_id = ?`, [ticketId]);
}

module.exports = { createSLA, checkSLA, markFirstResponse, markResolved, getSLAByTicketId };
