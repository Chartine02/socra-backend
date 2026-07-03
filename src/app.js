const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const routes = require("./routes");
const { errorHandler } = require("./middleware/error.middleware");
const { error } = require("./utils/response.utils");

const app = express();

// CORS — env-driven origins
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  logger.request(req);
  next();
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  error(res, "Route not found", 404);
});

// Centralised error handler
app.use(errorHandler);

module.exports = app;
