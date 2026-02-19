module.exports = {
  apps: [
    {
      name: "gomoku-ws",
      cwd: "/opt/skill-gomoku-online",
      script: "npm",
      args: "--prefix server run start",
      env: {
        PORT: "8080",
        NODE_ENV: "production"
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000
    }
  ]
};
