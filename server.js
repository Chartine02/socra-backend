require("dotenv").config();
const express = require("express");
const authRoutes = require("./src/routes/auth.routes");
const { errorHandler } = require("./src/middleware/error.middleware");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
