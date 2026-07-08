const { run, get } = require('../database');
const config = require('../config');
const bcrypt = require('bcryptjs');

let ActiveDirectory;
let adClient = null;
let syncTimer = null;

function getAD() {
  if (!config.ad.enabled) return null;
  if (!ActiveDirectory) {
    try { ActiveDirectory = require('activedirectory2'); } catch { return null; }
  }
  if (!adClient) {
    adClient = new ActiveDirectory({
      url: config.ad.url, baseDN: config.ad.baseDN,
      username: config.ad.username, password: config.ad.password
    });
  }
  return adClient;
}

function findOrCreateUser(adUser) {
  const existing = get('SELECT id FROM users WHERE ad_guid = ? OR username = ?', [adUser.objectGUID, adUser.sAMAccountName]);

  if (existing) {
    run(`UPDATE users SET full_name = ?, email = ?, phone = ?, job_title = ?,
      is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [adUser.displayName || adUser.cn || adUser.sAMAccountName,
       adUser.mail || `${adUser.sAMAccountName}@local`,
       adUser.telephoneNumber || '', adUser.title || '',
       adUser.userAccountControl ? !(adUser.userAccountControl & 2) : 1, existing.id]);
    return existing.id;
  }

  const hash = bcrypt.hashSync('changeme123', 10);
  const result = run(`INSERT INTO users (username, password, full_name, email, phone, role, job_title, ad_guid, is_active)
    VALUES (?, ?, ?, ?, ?, 'user', ?, ?, ?)`,
    [adUser.sAMAccountName, hash, adUser.displayName || adUser.cn || adUser.sAMAccountName,
     adUser.mail || `${adUser.sAMAccountName}@local`, adUser.telephoneNumber || '',
     adUser.title || '', adUser.objectGUID, 1]);
  return result.lastInsertRowid;
}

function syncUsers() {
  const ad = getAD();
  if (!ad) return { synced: 0, message: 'AD sync not configured or disabled' };

  return new Promise((resolve, reject) => {
    ad.findUsers({}, true, (err, users) => {
      if (err) { console.error('[AD Sync] Error:', err.message); return reject(err); }
      if (!users || users.length === 0) return resolve({ synced: 0, message: 'No users found in AD' });

      const arr = Array.isArray(users) ? users : [users];
      let synced = 0;
      arr.forEach(u => {
        if (u.sAMAccountName && !u.sAMAccountName.endsWith('$')) {
          findOrCreateUser(u);
          synced++;
        }
      });

      run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (NULL, 'ad_sync', 'user', ?)", [JSON.stringify({ synced })]);
      resolve({ synced, message: `Synced ${synced} users from Active Directory` });
    });
  });
}

function startAutoSync() {
  if (!config.ad.enabled || syncTimer) return;
  console.log(`[AD Sync] Auto-sync every ${config.ad.syncInterval / 60000} minutes`);
  syncUsers().catch(() => {});
  syncTimer = setInterval(() => {
    syncUsers().catch(err => console.error('[AD Sync] Auto-sync error:', err.message));
  }, config.ad.syncInterval);
}

function stopAutoSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

module.exports = { syncUsers, startAutoSync, stopAutoSync, getAD };
