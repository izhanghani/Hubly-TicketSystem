const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!config.smtp.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass }
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return { sent: false, message: 'SMTP not configured' };

  try {
    await t.sendMail({
      from: `"${config.app.name}" <${config.smtp.from}>`,
      to,
      subject,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[Email] Send error:', err.message);
    return { sent: false, message: err.message };
  }
}

function getTicketEmailBody(ticket, type) {
  const baseUrl = `http://localhost:${config.port}`;
  const ticketUrl = `${baseUrl}/ticket?id=${ticket.id}`;

  const templates = {
    assigned: {
      subject: `[${ticket.ticket_number}] Ticket Assigned to You`,
      html: `<h2>Ticket Assigned</h2><p>Ticket <strong>${ticket.ticket_number}</strong> has been assigned to you.</p><p><strong>${ticket.title}</strong></p><p>Priority: ${ticket.priority_name || 'N/A'}</p><p><a href="${ticketUrl}">View Ticket</a></p>`
    },
    updated: {
      subject: `[${ticket.ticket_number}] Ticket Updated`,
      html: `<h2>Ticket Updated</h2><p>Ticket <strong>${ticket.ticket_number}</strong> has been updated.</p><p><strong>${ticket.title}</strong></p><p><a href="${ticketUrl}">View Ticket</a></p>`
    },
    resolved: {
      subject: `[${ticket.ticket_number}] Ticket Resolved`,
      html: `<h2>Ticket Resolved</h2><p>Ticket <strong>${ticket.ticket_number}</strong> has been resolved.</p><p><strong>${ticket.title}</strong></p><p><a href="${ticketUrl}">View Ticket</a></p>`
    },
    new_comment: {
      subject: `[${ticket.ticket_number}] New Comment`,
      html: `<h2>New Comment</h2><p>A new comment has been added to ticket <strong>${ticket.ticket_number}</strong>.</p><p><strong>${ticket.title}</strong></p><p><a href="${ticketUrl}">View Ticket</a></p>`
    }
  };

  return templates[type] || templates.updated;
}

async function sendTicketNotification(ticket, type, userEmail) {
  if (!userEmail) return { sent: false, message: 'No email provided' };
  const template = getTicketEmailBody(ticket, type);
  return sendEmail({ to: userEmail, ...template });
}

module.exports = { sendEmail, sendTicketNotification };
