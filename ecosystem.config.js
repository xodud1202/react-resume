module.exports = {
    apps: [
        {
            name: "react-resume",
            script: "npm",
            args: "start",
            autorestart: false,
            max_memory_restart: "300M",
            env: {
              PORT: 3013, // 여기에 포트를 명시합니다.
              NODE_ENV: "production"
            }
        }
    ]
}