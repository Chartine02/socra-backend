const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const routes = require("./routes");
const { errorHandler } = require("./middleware/error.middleware");
const { error } = require("./utils/response.utils");

const app = express();

// Middleware stack
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
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
