import express from "express";
import ConversationController from "../controllers/conversation.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

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
