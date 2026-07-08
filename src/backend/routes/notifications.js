const express = require('express');
const { run, get, all } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const notifications = all(`
    SELECT n.*, t.ticket_number, t.title as ticket_title
    FROM notifications n
    LEFT JOIN tickets t ON n.ticket_id = t.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC LIMIT 50
  `, [req.user.id]);
  const unreadCount = get("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0", [req.user.id]).c;
  res.json({ notifications, unreadCount });
});

router.put('/:id/read', authenticate, (req, res) => {
  run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

router.put('/read-all', authenticate, (req, res) => {
  run("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [req.user.id]);
  res.json({ message: 'All marked as read' });
});

router.get('/unread-count', authenticate, (req, res) => {
  const count = get("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0", [req.user.id]).c;
  res.json({ count });
});

module.exports = router;
