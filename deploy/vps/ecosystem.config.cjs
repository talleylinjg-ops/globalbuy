// CrossBuy VPS 生产部署 PM2 配置
// 用法：pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'crossbuy-server',
      cwd: __dirname + '/../../server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      out_file: '/var/log/crossbuy/server.log',
      error_file: '/var/log/crossbuy/server.error.log',
      time: true,
    },
  ],
};
