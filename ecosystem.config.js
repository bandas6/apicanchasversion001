module.exports = {
  apps: [
    {
      name: "api_canc",
      script: "app.js",
      env: {
        DB_URI: "mongodb+srv://arnold:MUfyQ5peXiouqvE8@cluster0.orv7yru.mongodb.net/canchas"
      }
    }
  ]
};
