const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const config = require('./config');
const { initializeDatabase, getDatabase, run } = require('./database');
const { startAutoSync, stopAutoSync, syncUsers } = require('./utils/ad-sync');
const { checkSLA } = require('./utils/sla-engine');

const { authenticate, authorize } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const slaRoutes = require('./routes/sla');
const settingRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const workflowRoutes = require('./routes/workflow');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] } });

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadDir));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/', limiter);

function isMaintenanceMode() {
  try {
    const { getSetting } = require('./database');
    return process.env.MAINTENANCE_MODE === 'true' || config.maintenanceMode || getSetting('feature_maintenance_mode') === true;
  } catch {
    return process.env.MAINTENANCE_MODE === 'true' || config.maintenanceMode;
  }
}

app.use('/api/', (req, res, next) => {
  if (isMaintenanceMode()) {
    const publicPaths = ['/auth/login', '/health', '/auth/me', '/settings/logo'];
    if (publicPaths.some(p => req.path.startsWith(p))) return next();
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = require('jsonwebtoken').verify(token, config.jwtSecret);
        if (decoded.role === 'admin') return next();
      } catch {}
    }
    return res.status(503).json({ error: 'System is currently under maintenance. Please try again later.', maintenance: true });
  }
  next();
});

if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true });
if (!fs.existsSync(config.logDir)) fs.mkdirSync(config.logDir, { recursive: true });

async function start() {
  await initializeDatabase();

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/sla', slaRoutes);
  app.use('/api/settings', settingRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/workflow', workflowRoutes);

  app.get('/api/settings/logo', (req, res) => {
    const logo = require('./database').get("SELECT value FROM settings WHERE key = 'app_logo'");
    if (logo && logo.value) {
      const logoPath = path.join(config.uploadDir, path.basename(logo.value));
      if (fs.existsSync(logoPath)) return res.sendFile(logoPath);
    }
    res.status(204).send();
  });

  app.get('/api/settings/favicon', (req, res) => {
    const fav = require('./database').get("SELECT value FROM settings WHERE key = 'app_favicon'");
    if (fav && fav.value) {
      const favPath = path.join(config.uploadDir, path.basename(fav.value));
      if (fs.existsSync(favPath)) return res.sendFile(favPath);
    }
    res.redirect('/favicon.svg');
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), version: config.app.version, maintenance: process.env.MAINTENANCE_MODE === 'true' });
  });

  app.get('/api/config', authenticate, authorize('admin'), (req, res) => {
    res.json({
      port: config.port,
      maintenance: process.env.MAINTENANCE_MODE === 'true',
      adminDisabled: process.env.ADMIN_DISABLED === 'true',
      smtp: {
        enabled: config.smtp.enabled,
        host: config.smtp.host,
        port: config.smtp.port,
        username: config.smtp.user,
        password: config.smtp.pass ? '••••••' : '',
        from: config.smtp.from
      },
      ad: {
        enabled: config.ad.enabled,
        url: config.ad.url,
        baseDN: config.ad.baseDN,
        username: config.ad.username,
        password: config.ad.password ? '••••••' : ''
      }
    });
  });

  app.put('/api/config', authenticate, authorize('admin'), (req, res) => {
    const { maintenance, adminDisabled, ad, smtp } = req.body;
    const runtimeConfigPath = require('path').join(__dirname, '..', '..', 'data', 'runtime-config.json');
    let rc = {};
    try { rc = JSON.parse(require('fs').readFileSync(runtimeConfigPath, 'utf8')); } catch {}
    if (maintenance !== undefined) { rc.maintenance = maintenance; process.env.MAINTENANCE_MODE = maintenance ? 'true' : 'false'; config.maintenanceMode = maintenance; }
    if (adminDisabled !== undefined) { rc.adminDisabled = adminDisabled; process.env.ADMIN_DISABLED = adminDisabled ? 'true' : 'false'; config.adminDisabled = adminDisabled; }
    if (ad) {
      Object.assign(rc, {
        adEnabled: ad.enabled !== undefined ? ad.enabled : rc.adEnabled,
        adUrl: ad.url !== undefined ? ad.url : rc.adUrl,
        adBaseDN: ad.baseDN !== undefined ? ad.baseDN : rc.adBaseDN,
        adUser: ad.username !== undefined ? ad.username : rc.adUser,
        adPass: ad.password !== undefined ? (ad.password || rc.adPass) : rc.adPass,
      });
      Object.assign(config.ad, {
        enabled: rc.adEnabled === true || rc.adEnabled === 'true',
        url: rc.adUrl || config.ad.url,
        baseDN: rc.adBaseDN || config.ad.baseDN,
        username: rc.adUser || config.ad.username,
        password: rc.adPass || config.ad.password,
      });
    }
    if (smtp) {
      Object.assign(rc, {
        smtpEnabled: smtp.enabled !== undefined ? smtp.enabled : rc.smtpEnabled,
        smtpHost: smtp.host !== undefined ? smtp.host : rc.smtpHost,
        smtpPort: smtp.port !== undefined ? parseInt(smtp.port) : rc.smtpPort,
        smtpUser: smtp.username !== undefined ? smtp.username : rc.smtpUser,
        smtpPass: smtp.password !== undefined ? (smtp.password || rc.smtpPass) : rc.smtpPass,
        smtpFrom: smtp.from !== undefined ? smtp.from : rc.smtpFrom,
      });
      Object.assign(config.smtp, {
        enabled: rc.smtpEnabled === true || rc.smtpEnabled === 'true',
        host: rc.smtpHost || config.smtp.host,
        port: parseInt(rc.smtpPort) || config.smtp.port,
        user: rc.smtpUser || config.smtp.user,
        pass: rc.smtpPass || config.smtp.pass,
        from: rc.smtpFrom || config.smtp.from,
      });
    }
    require('fs').writeFileSync(runtimeConfigPath, JSON.stringify(rc, null, 2));
    res.json({ message: 'Config updated' });
  });

  const MAINTENANCE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__COMPANY_NAME__ - Maintenance</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0f1e;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:linear-gradient(145deg,#1a2332,#151d2b);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:48px 40px;max-width:520px;width:100%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.5);animation:fadeIn 0.5s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.icon-wrap{width:80px;height:80px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:40px;color:#fff;box-shadow:0 8px 32px rgba(245,158,11,0.3)}
.icon-wrap img{width:48px;height:48px;border-radius:12px;object-fit:contain}
h1{font-size:26px;font-weight:800;margin-bottom:8px;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
p{color:#94a3b8;font-size:15px;line-height:1.7;margin-bottom:8px}
.status{display:inline-flex;align-items:center;gap:8px;padding:8px 20px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:12px;margin:20px 0 8px;font-size:14px;color:#fbbf24}
.status i{animation:pulse 1.5s infinite}
.footer{margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#475569}
.brand{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;color:#64748b;font-size:13px;font-weight:600}
.brand i{color:#f59e0b}
</style>
</head>
<body>
<div class="card">
<div class="icon-wrap">__LOGO_HTML__</div>
<h1>System Maintenance</h1>
<p>We are currently performing scheduled maintenance to improve our services.</p>
<p style="font-size:13px;color:#64748b">The system will be back online shortly. Please check back later.</p>
<div class="status"><i class="bi bi-gear-wide-connected"></i> Maintenance in progress</div>
<div class="footer">
<div class="brand"><i class="bi bi-ticket-perforated"></i> __COMPANY_NAME__</div>
&copy; __YEAR__ &middot; All rights reserved
</div>
</div>
</body>
</html>`;

  let distPath = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distPath)) {
    const altDist = path.join(__dirname, '..', 'frontend', 'dist');
    if (fs.existsSync(altDist)) { distPath = altDist; }
  }
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return;
      if (isMaintenanceMode()) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const decoded = require('jsonwebtoken').verify(authHeader.slice(7), require('./config').jwtSecret);
            if (decoded.role === 'admin') return res.sendFile(path.join(distPath, 'index.html'));
          } catch {}
        }
        const db = require('./database');
        const companyName = db.getSetting('branding_company_name') || 'Hubly';
        const logoSetting = db.get("SELECT value FROM settings WHERE key = 'app_logo'");
        const logoHtml = (logoSetting && logoSetting.value) ? `<img src="/api/settings/logo" alt="Logo" />` : '<i class="bi bi-tools"></i>';
        const year = new Date().getFullYear();
        const page = MAINTENANCE_PAGE
          .replace(/__COMPANY_NAME__/g, companyName)
          .replace(/__LOGO_HTML__/g, logoHtml)
          .replace(/__YEAR__/g, String(year));
        return res.send(page);
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 10MB)' });
    if (err.message?.includes('File type')) return res.status(415).json({ error: err.message });
    console.error('[Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  io.on('connection', (socket) => {
    socket.on('join:ticket', (ticketId) => socket.join(`ticket:${ticketId}`));
    socket.on('leave:ticket', (ticketId) => socket.leave(`ticket:${ticketId}`));
    socket.on('join:user', (userId) => socket.join(`user:${userId}`));
  });

  function emitNotification(ticketId, event, data) {
    io.to(`ticket:${ticketId}`).emit(event, data);
  }

  app.set('io', io);
  app.set('emitNotification', emitNotification);

  const PORT = config.port;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[${config.app.name}] Server running on port ${PORT}`);
    console.log(`[${config.app.name}] API: http://localhost:${PORT}/api`);

    startAutoSync();

    setInterval(() => {
      try {
        const { all, getSetting } = require('./database');
        if (!getSetting('feature_sla_tracking')) return;
        const activeTickets = all("SELECT id FROM tickets WHERE status NOT IN ('closed','cancelled','resolved')");
        activeTickets.forEach(t => {
          try { checkSLA(t.id); } catch (_) {}
        });
      } catch (_) {}
    }, 60000);
  });
}

start().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

process.on('SIGTERM', () => { stopAutoSync(); server.close(); process.exit(0); });
process.on('SIGINT', () => { stopAutoSync(); server.close(); process.exit(0); });

module.exports = { app, server, io };
