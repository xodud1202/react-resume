module.exports = {
    apps: [
        {
            name: "react-resume",
            cwd: __dirname,
            script: "./server.js",
            interpreter: "node",
            autorestart: false,
            max_memory_restart: "300M",
            env: {
                HOSTNAME: "0.0.0.0",
                PORT: 3013,
                NODE_ENV: "production"
            }
        }
    ]
}
