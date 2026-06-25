module.exports = {
  apps: [
    {
      name: 'ceo-backend',
      script: 'venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000 --workers 1',
      cwd: '/var/www/ceo/backend',
      interpreter: 'none',
      env: { NODE_ENV: 'production' },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // Logging
      out_file: '/var/log/pm2/ceo-backend-out.log',
      error_file: '/var/log/pm2/ceo-backend-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'ceo-whatsapp',
      script: 'index.js',
      cwd: '/var/www/ceo/whatsapp-service',
      interpreter: 'node',
      // Kill zombie Chrome BEFORE starting — this is the key fix
      pre_start: 'pkill -f "chrome.*wa_session" || true',
      env: { NODE_ENV: 'production' },
      // Restart policy — wait longer between restarts to avoid Chrome spam
      max_restarts: 15,
      min_uptime: '15s',
      restart_delay: 8000,
      // Kill Chrome processes when PM2 stops the app
      kill_timeout: 8000,
      // Logging
      out_file: '/var/log/pm2/ceo-whatsapp-out.log',
      error_file: '/var/log/pm2/ceo-whatsapp-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'marketer-portal',
      script: 'app.py',
      interpreter: 'python3',
      cwd: '/home/ubuntu/webapp',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      out_file: '/var/log/pm2/marketer-out.log',
      error_file: '/var/log/pm2/marketer-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'telecrm-backend',
      script: 'index.js',
      cwd: '/opt/crm-tele/backend',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      out_file: '/var/log/pm2/telecrm-out.log',
      error_file: '/var/log/pm2/telecrm-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
