import express from "express";
import ConversationController from "../controllers/conversation.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// Handle preflight OPTIONS requests for all conversation routes
router.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://faffsap.vercel.app");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.status(204).end();
});

router.get("/", authMiddleware, ConversationController.getUserConversations);
router.get(
  "/:conversationId/messages",
  authMiddleware,
  ConversationController.getConversationMessages
);
router.post(
  "/create",
  authMiddleware,
  ConversationController.createPrivateConversation
);
router.post(
  "/:conversationId/read",
  authMiddleware,
  ConversationController.markConversationAsRead
);

router.get("/search", authMiddleware, ConversationController.searchAllMessages);
router.get(
  "/:conversationId/search",
  authMiddleware,
  ConversationController.searchMessagesInConversation
);

export default router;
