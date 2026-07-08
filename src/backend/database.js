const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

let db = null;
let SQL = null;

function getDatabase() {
  if (db) return db;
  throw new Error('Database not initialized. Call initializeDatabase() first.');
}

async function initializeDatabase() {
  SQL = await initSqlJs();

  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  createTables();
  seedDefaults();

  return db;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.dbPath, buffer);
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','agent','supervisor','user')),
      department_id INTEGER REFERENCES departments(id),
      job_title TEXT DEFAULT '',
      ad_guid TEXT UNIQUE,
      avatar TEXT DEFAULT '',
      signature TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT 'ticket',
      color TEXT DEFAULT '#6c757d',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id INTEGER REFERENCES ticket_types(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL DEFAULT 0,
      color TEXT DEFAULT '#6c757d',
      sla_response_minutes INTEGER DEFAULT 60,
      sla_resolution_minutes INTEGER DEFAULT 480,
      is_active INTEGER DEFAULT 1
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      priority_id INTEGER REFERENCES ticket_priorities(id),
      requester_role TEXT DEFAULT '',
      ticket_type_id INTEGER REFERENCES ticket_types(id),
      response_time_minutes INTEGER NOT NULL,
      resolution_time_minutes INTEGER NOT NULL,
      escalation_time_minutes INTEGER DEFAULT 0,
      business_hours_only INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.run("ALTER TABLE sla_policies ADD COLUMN requester_role TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE sla_policies ADD COLUMN ticket_type_id INTEGER REFERENCES ticket_types(id)"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN ad_guid TEXT UNIQUE"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN signature TEXT DEFAULT ''"); } catch {}
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','pending','resolved','closed','cancelled')),
      priority_id INTEGER REFERENCES ticket_priorities(id),
      type_id INTEGER REFERENCES ticket_types(id),
      category_id INTEGER REFERENCES ticket_categories(id),
      requester_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER REFERENCES users(id),
      department_id INTEGER REFERENCES departments(id),
      source TEXT DEFAULT 'web' CHECK(source IN ('web','email','phone','api')),
      is_private INTEGER DEFAULT 0,
      resolution_notes TEXT DEFAULT '',
      closed_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      closed_at DATETIME
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      comment TEXT NOT NULL,
      is_internal INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      comment_id INTEGER REFERENCES ticket_comments(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sla_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      policy_id INTEGER REFERENCES sla_policies(id),
      response_deadline DATETIME NOT NULL,
      resolution_deadline DATETIME NOT NULL,
      escalation_deadline DATETIME,
      first_response_at DATETIME,
      resolved_at DATETIME,
      response_breached INTEGER DEFAULT 0,
      resolution_breached INTEGER DEFAULT 0,
      escalation_triggered INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS assignment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      requested_agent_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT DEFAULT '',
      type TEXT DEFAULT 'text' CHECK(type IN ('text','number','boolean','json','image')),
      category TEXT DEFAULT 'general',
      description TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  run('CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id)');
  run('CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id)');
  run('CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at)');
  run('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id)');
  run('CREATE INDEX IF NOT EXISTS idx_sla_entries_ticket ON sla_entries(ticket_id)');
  run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      match_type_id INTEGER REFERENCES ticket_types(id),
      match_category_id INTEGER REFERENCES ticket_categories(id),
      match_priority_id INTEGER REFERENCES ticket_priorities(id),
      match_department_id INTEGER REFERENCES departments(id),
      match_requester_role TEXT DEFAULT '',
      assign_type TEXT NOT NULL DEFAULT 'department' CHECK(assign_type IN ('department','agent','role')),
      assign_department_id INTEGER REFERENCES departments(id),
      assign_agent_id INTEGER REFERENCES users(id),
      assign_role TEXT DEFAULT '',
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try { db.run("ALTER TABLE tickets ADD COLUMN workflow_rule_id INTEGER REFERENCES workflow_rules(id)"); } catch {}

  run('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)');

  saveDatabase();
}

function seedDefaults() {
  const userCount = get("SELECT COUNT(*) as c FROM users");
  if (userCount && userCount.c > 0) return;

  const hash = bcrypt.hashSync('admin123', 10);

  exec("INSERT INTO ticket_priorities (name, level, color, sla_response_minutes, sla_resolution_minutes) VALUES ('Low', 1, '#28a745', 240, 2880)");
  exec("INSERT INTO ticket_priorities (name, level, color, sla_response_minutes, sla_resolution_minutes) VALUES ('Medium', 2, '#ffc107', 120, 1440)");
  exec("INSERT INTO ticket_priorities (name, level, color, sla_response_minutes, sla_resolution_minutes) VALUES ('High', 3, '#fd7e14', 60, 480)");
  exec("INSERT INTO ticket_priorities (name, level, color, sla_response_minutes, sla_resolution_minutes) VALUES ('Critical', 4, '#dc3545', 15, 120)");

  exec("INSERT INTO ticket_types (name, description, icon, color) VALUES ('Incident', 'Service interruption or quality degradation', 'exclamation-triangle', '#dc3545')");
  exec("INSERT INTO ticket_types (name, description, icon, color) VALUES ('Service Request', 'Request for new service or information', 'gear', '#0d6efd')");
  exec("INSERT INTO ticket_types (name, description, icon, color) VALUES ('Complaint', 'Expression of dissatisfaction', 'hand', '#fd7e14')");
  exec("INSERT INTO ticket_types (name, description, icon, color) VALUES ('Change Request', 'Request for change to infrastructure', 'arrow-repeat', '#6f42c1')");
  exec("INSERT INTO ticket_types (name, description, icon, color) VALUES ('Problem', 'Root cause investigation', 'search', '#20c997')");

  ['Hardware Failure', 'Software Issue', 'Network Issue', 'Email Issue', 'Printer Issue', 'Access Problem', 'Account Issue', 'Other'].forEach(c => {
    run("INSERT INTO ticket_categories (type_id, name) VALUES (1, ?)", [c]);
  });
  ['New Hardware', 'Software Installation', 'Access Request', 'Password Reset', 'Information', 'Training', 'Other'].forEach(c => {
    run("INSERT INTO ticket_categories (type_id, name) VALUES (2, ?)", [c]);
  });
  ['Service Quality', 'Response Time', 'Staff Behavior', 'Billing', 'Other'].forEach(c => {
    run("INSERT INTO ticket_categories (type_id, name) VALUES (3, ?)", [c]);
  });
  ['Application Change', 'Infrastructure Change', 'Security Change', 'Configuration Change', 'Other'].forEach(c => {
    run("INSERT INTO ticket_categories (type_id, name) VALUES (4, ?)", [c]);
  });
  ['Recurring Issue', 'Major Incident', 'Root Cause Analysis', 'Other'].forEach(c => {
    run("INSERT INTO ticket_categories (type_id, name) VALUES (5, ?)", [c]);
  });

  run("INSERT INTO departments (name, description) VALUES ('HR', 'Human Resources')");
  run("INSERT INTO departments (name, description) VALUES ('IT', 'Information Technology')");
  run("INSERT INTO departments (name, description) VALUES ('Support', 'Customer Support')");
  run("INSERT INTO departments (name, description) VALUES ('Operations', 'Operations Department')");

  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('admin', ?, 'System Admin', 'admin@ticket.local', 'admin', 2, 'IT Administrator', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('supervisor', ?, 'Supervisor User', 'supervisor@ticket.local', 'supervisor', 2, 'Supervisor', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('user1', ?, 'Normal User', 'user1@ticket.local', 'user', 1, 'Employee', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('hr1', ?, 'HR User One', 'hr1@ticket.local', 'agent', 1, 'HR Specialist', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('hr2', ?, 'HR User Two', 'hr2@ticket.local', 'agent', 1, 'HR Specialist', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('it1', ?, 'IT User One', 'it1@ticket.local', 'agent', 2, 'IT Specialist', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('it2', ?, 'IT User Two', 'it2@ticket.local', 'agent', 2, 'IT Specialist', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('it3', ?, 'IT User Three', 'it3@ticket.local', 'agent', 2, 'IT Specialist', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('support1', ?, 'Support Agent One', 'support1@ticket.local', 'agent', 3, 'Support Agent', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('support2', ?, 'Support Agent Two', 'support2@ticket.local', 'agent', 3, 'Support Agent', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('ops1', ?, 'Operations User One', 'ops1@ticket.local', 'agent', 4, 'Operations Staff', 1)", [hash]);
  run("INSERT INTO users (username, password, full_name, email, role, department_id, job_title, is_active) VALUES ('ops2', ?, 'Operations User Two', 'ops2@ticket.local', 'agent', 4, 'Operations Staff', 1)", [hash]);

  exec("INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES ('Low SLA', 1, 240, 2880, 1)");
  exec("INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES ('Medium SLA', 2, 120, 1440, 1)");
  exec("INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES ('High SLA', 3, 60, 480, 1)");
  exec("INSERT INTO sla_policies (name, priority_id, response_time_minutes, resolution_time_minutes, business_hours_only) VALUES ('Critical SLA', 4, 15, 120, 0)");

  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('app_name', 'IT Ticket System Pro', 'text', 'general', 'Application name')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('app_logo', '', 'image', 'branding', 'Company logo')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('company_name', 'Your Company', 'text', 'general', 'Company name')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('ticket_prefix', 'TKT', 'text', 'tickets', 'Ticket number prefix')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('auto_assign', 'false', 'boolean', 'tickets', 'Auto-assign tickets to agents')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('business_hours_start', '09:00', 'text', 'sla', 'Business hours start')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('business_hours_end', '18:00', 'text', 'sla', 'Business hours end')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('business_days', '1,2,3,4,5', 'text', 'sla', 'Business days (1=Mon, 7=Sun)')");

  exec("INSERT INTO workflow_rules (name, description, match_department_id, assign_type, assign_department_id, priority, is_active) VALUES ('HR Tickets → HR Dept', 'Auto-route HR tickets to HR department', 1, 'department', 1, 1, 1)");
  exec("INSERT INTO workflow_rules (name, description, match_department_id, assign_type, assign_department_id, priority, is_active) VALUES ('IT Tickets → IT Dept', 'Auto-route IT tickets to IT department', 2, 'department', 2, 1, 1)");
  exec("INSERT INTO workflow_rules (name, description, match_department_id, assign_type, assign_department_id, priority, is_active) VALUES ('Support Tickets → Support Dept', 'Auto-route Support tickets to Support department', 3, 'department', 3, 1, 1)");
  exec("INSERT INTO workflow_rules (name, description, match_department_id, assign_type, assign_department_id, priority, is_active) VALUES ('Ops Tickets → Ops Dept', 'Auto-route Operations tickets to Operations department', 4, 'department', 4, 1, 1)");

  // Feature Flags
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_ad_sync', 'false', 'boolean', 'features', 'Enable Active Directory sync')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_email_notify', 'false', 'boolean', 'features', 'Enable email notifications')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_self_registration', 'false', 'boolean', 'features', 'Allow user self-registration')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_auto_assign', 'false', 'boolean', 'features', 'Auto-assign tickets to agents')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_sla_tracking', 'true', 'boolean', 'features', 'Enable SLA tracking')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_attachments', 'true', 'boolean', 'features', 'Enable file attachments')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_private_tickets', 'true', 'boolean', 'features', 'Enable private tickets')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_knowledge_base', 'false', 'boolean', 'features', 'Enable knowledge base')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_reports', 'true', 'boolean', 'features', 'Enable reports & analytics')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_audit_logs', 'true', 'boolean', 'features', 'Enable audit logging')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_guest_tickets', 'false', 'boolean', 'features', 'Allow guest ticket submission')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_maintenance_mode', 'false', 'boolean', 'features', 'Show maintenance page to non-admins')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_export', 'true', 'boolean', 'features', 'Enable CSV/PDF data export')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_public_faq', 'false', 'boolean', 'features', 'Show public FAQ page')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_realtime', 'true', 'boolean', 'features', 'Real-time updates via WebSocket')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('feature_ratings', 'false', 'boolean', 'features', 'Allow ticket ratings')");

  // Security Settings
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('password_min_length', '6', 'number', 'security', 'Minimum password length')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('session_timeout', '24', 'number', 'security', 'Session timeout in hours')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('max_login_attempts', '5', 'number', 'security', 'Max login attempts before lockout')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('lockout_duration', '30', 'number', 'security', 'Lockout duration in minutes')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('two_factor_auth', 'false', 'boolean', 'security', 'Enable two-factor authentication')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('enforce_https', 'true', 'boolean', 'security', 'Force HTTPS connections')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('allowed_domains', '', 'text', 'security', 'Allowed email domains (comma-separated)')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('recaptcha_enabled', 'false', 'boolean', 'security', 'Enable reCAPTCHA on login')");

  // Ticket Settings
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('max_tickets_per_user', '0', 'number', 'tickets', 'Max open tickets per user (0=unlimited)')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('require_priority', 'true', 'boolean', 'tickets', 'Require priority on ticket creation')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('require_category', 'false', 'boolean', 'tickets', 'Require category on ticket creation')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('auto_close_days', '7', 'number', 'tickets', 'Auto-close resolved tickets after days')");

  // Notification Settings
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('notify_on_assign', 'true', 'boolean', 'notifications', 'Notify on ticket assignment')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('notify_on_comment', 'true', 'boolean', 'notifications', 'Notify on new comments')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('notify_on_resolve', 'true', 'boolean', 'notifications', 'Notify on ticket resolution')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('notify_sla_breach', 'true', 'boolean', 'notifications', 'Notify on SLA breach')");

  // Branding Settings
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('branding_company_name', 'Your Company', 'text', 'branding', 'Company display name')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('branding_tagline', 'Professional IT Ticket Management', 'text', 'branding', 'System tagline')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('branding_primary_color', '#2563eb', 'text', 'branding', 'Primary brand color')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('branding_secondary_color', '#64748b', 'text', 'branding', 'Secondary brand color')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('branding_footer_text', 'IT Ticket System Pro', 'text', 'branding', 'Footer text')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('app_favicon', '', 'image', 'branding', 'Favicon')");

  // Theme Settings
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('theme_primary_color', '#2563eb', 'text', 'theme', 'Primary theme color')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('theme_sidebar_color', '#1e293b', 'text', 'theme', 'Sidebar background color')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('theme_dark_mode', 'false', 'boolean', 'theme', 'Enable dark mode')");
  exec("INSERT INTO settings (key, value, type, category, description) VALUES ('theme_accent_color', '#8b5cf6', 'text', 'theme', 'Accent color for highlights')");

  saveDatabase();
}

// Helper functions to mimic better-sqlite3 sync API
function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  const id = getLastInsertId();
  const changes = db.getRowsModified();
  saveDatabase();
  return { lastInsertRowid: id, changes };
}

function get(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  if (!stmt) return undefined;
  stmt.bind(params);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return undefined;
}

function all(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const results = [];
  const stmt = db.prepare(sql);
  if (!stmt) return results;
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function exec(sql) {
  if (!db) throw new Error('DB not initialized');
  db.exec(sql);
}

function getLastInsertId() {
  const result = get("SELECT last_insert_rowid() as id");
  return result ? result.id : 0;
}

function addAuditLog(userId, action, entityType, entityId = null, details = '') {
  if (!getSetting('feature_audit_logs')) return;
  run("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)",
    [userId, action, entityType, entityId, typeof details === 'object' ? JSON.stringify(details) : String(details)]);
}

function getSetting(key) {
  try {
    const row = get("SELECT value, type FROM settings WHERE key = ?", [key]);
    if (!row) return null;
    if (row.type === 'boolean') return row.value === 'true';
    if (row.type === 'number') return parseFloat(row.value);
    return row.value;
  } catch { return null; }
}

function transaction(fn) {
  return function(...args) {
    db.run('BEGIN TRANSACTION');
    try {
      fn(...args);
      db.run('COMMIT');
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  };
}

module.exports = { getDatabase, initializeDatabase, run, get, all, exec, transaction, saveDatabase, getSetting, addAuditLog };
