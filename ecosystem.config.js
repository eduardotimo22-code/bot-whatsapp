module.exports = {
  apps: [
    {
      name: 'bot-whatsapp',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev --port 3131',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}
