import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { sequelize } from "./schemas/index.js";
import userRoutes from "./routers/user.router.js";
import conversationRoutes from "./routers/conversation.router.js";
import socketConnection from "./socket/socket.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/conversation", conversationRoutes);

app.get("/api/v1/faff", (req, res) => {
  res.json({ message: "faff" });
});

socketConnection(io);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected.");

    await sequelize.sync({ alter: false });
    console.log("DB synced.");

    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
