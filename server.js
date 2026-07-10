require("dotenv").config();
const axios = require("axios");
const app = require("./src/app");
const { startCanvasSyncScheduler } = require("./src/jobs/canvas-sync.job");

const PORT = process.env.PORT || 8000;

// Keep AI service warm by pinging every 13 minutes
function keepAIServiceAlive() {
  const url = process.env.AI_SERVICE_URL;
  if (!url) return;

  const ping = () => {
    axios.get(`${url}/health`, { timeout: 60000 }).catch(() => {});
  };

  ping(); // Wake it immediately on backend start
  setInterval(ping, 13 * 60 * 1000); // Then every 13 minutes
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  keepAIServiceAlive();
  startCanvasSyncScheduler();
});
