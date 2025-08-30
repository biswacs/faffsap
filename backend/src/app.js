import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { sequelize } from "./schemas/index.js";
import { setupTypesense } from "./config/setupTypesense.js";
import userRoutes from "./routers/user.router.js";
import conversationRoutes from "./routers/conversation.router.js";
import socketConnection from "./socket/socket.js";
import {
  memoryMonitor,
  performanceMonitor,
} from "./middleware/monitoring.middleware.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(memoryMonitor);
app.use(performanceMonitor);

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/conversation", conversationRoutes);

app.get("/api/v1/faff", (req, res) => {
  res.json({ message: "faff" });
});

app.get("/api/v1/test-cors", (req, res) => {
  res.json({
    message: "CORS test successful",
    timestamp: new Date().toISOString(),
    headers: req.headers,
  });
});

socketConnection(io);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected.");

    await sequelize.sync({ force: false });
    console.log("DB synced.");

    await setupTypesense();
    console.log("Typesense collection ready.");

    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`http://localhost:${PORT}`);
      console.log(
        `[MONITORING] Memory, performance, socket, and database monitoring enabled`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
