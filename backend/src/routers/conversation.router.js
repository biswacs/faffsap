import express from "express";
import {
  createConversation,
  getUserConversations,
  getConversationMessages,
} from "../controllers/conversation.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createConversation);
router.get("/", authMiddleware, getUserConversations);
router.get("/:conversationId/messages", authMiddleware, getConversationMessages);

export default router;
