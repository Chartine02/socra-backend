function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message, ...meta };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

const logger = {
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta),
  request: (req) => {
    log("info", `${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  },
};

module.exports = logger;
