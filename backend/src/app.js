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
  socketMonitor,
  dbMonitor,
} from "./middleware/monitoring.middleware.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

// app.use(memoryMonitor);
// app.use(performanceMonitor);

app.options("/api/v1/conversation/search", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.status(204).end();
});

app.options("/api/v1/conversation/:conversationId/search", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.status(204).end();
});

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
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
