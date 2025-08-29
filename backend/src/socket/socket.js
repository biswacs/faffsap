import { Server } from "socket.io";
import {
  User,
  Conversation,
  Message,
  ConversationMember,
  ReadReceipt,
} from "../schemas/index.js";

const userSockets = new Map();
const onlineUsers = new Set();

function socketConnection(io) {
  io.on("connection", (socket) => {
    socket.on("user_online", async (data) => {
      const { userId } = data;
      userSockets.set(userId, socket.id);
      onlineUsers.add(userId);
      
      // Emit to all clients that this user is now online
      io.emit("user_status_change", {
        userId,
        status: "online"
      });
    });

    socket.on("join_conversation", async (data) => {
      const { userId, conversationId } = data;
      const conversation = await Conversation.findByPk(conversationId, {
        include: [{ model: ConversationMember, include: [User] }],
      });

      if (conversation) {
        const isMember = conversation.ConversationMembers.some(
          (member) => member.userId === userId
        );
        if (isMember) {
          socket.join(conversationId);
          userSockets.set(userId, socket.id);
        }
      }
    });

    socket.on("send_message", async (data) => {
      const { conversationId, senderId, content, messageType = "text" } = data;

      const message = await Message.create({
        conversationId,
        senderId,
        content,
        messageType,
      });

      await Conversation.update(
        { lastMessageAt: new Date() },
        { where: { id: conversationId } }
      );

      const sender = await User.findByPk(senderId);
      const messageData = {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: sender.name,
        conversationId: message.conversationId,
        messageType: message.messageType,
        createdAt: message.createdAt,
      };

      io.to(conversationId).emit("receive_message", messageData);
    });

    socket.on("mark_read", async (data) => {
      const { messageId, userId } = data;

      await ReadReceipt.findOrCreate({
        where: { messageId, userId },
        defaults: { readAt: new Date() },
      });

      socket.broadcast.to(data.conversationId).emit("message_read", {
        messageId,
        userId,
        readAt: new Date(),
      });
    });

    socket.on("typing_start", (data) => {
      socket.broadcast.to(data.conversationId).emit("user_typing", {
        userId: data.userId,
        userName: data.userName,
      });
    });

    socket.on("typing_stop", (data) => {
      socket.broadcast.to(data.conversationId).emit("user_stop_typing", {
        userId: data.userId,
      });
    });

    socket.on("disconnect", () => {
      let disconnectedUserId = null;
      
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          break;
        }
      }

      if (disconnectedUserId) {
        // Emit to all clients that this user is now offline
        io.emit("user_status_change", {
          userId: disconnectedUserId,
          status: "offline"
        });
      }
    });
  });
}

// Function to get online users (can be used by other parts of the app)
export const getOnlineUsers = () => Array.from(onlineUsers);

export default socketConnection;
