module.exports = {
  apps: [{
    name: 'it-ticket-system',
    script: 'src/backend/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env',
    error_file: 'data/logs/pm2-error.log',
    out_file: 'data/logs/pm2-out.log',
    max_restarts: 10,
    restart_delay: 5000
  }]
};
