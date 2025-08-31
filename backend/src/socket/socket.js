import {
  User,
  Conversation,
  Message,
  ConversationMember,
  ReadReceipt,
  sequelize,
} from "../schemas/index.js";
import { authenticateSocket } from "../middleware/auth.middleware.js";
import { messageEmbeddingQueue } from "../config/queue.js";

const userSockets = new Map();
const socketUsers = new Map();
const onlineUsers = new Set();
let ioInstance = null;

function socketConnection(io) {
  ioInstance = io;
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const { userId, username } = socket;

    console.log(`User ${username} (${userId}) connected`);

    userSockets.set(userId, socket.id);
    socketUsers.set(socket.id, userId);
    onlineUsers.add(userId);

    socket.join(`user_${userId}`);

    io.emit("user_status_change", {
      userId,
      username,
      status: "online",
    });

    socket.on("send_message", async (data) => {
      const transaction = await sequelize.transaction();

      try {
        const {
          receiverId,
          content,
          conversationId,
          messageType = "text",
        } = data;

        if (!receiverId || !content || !conversationId) {
          await transaction.rollback();
          socket.emit("error", { message: "Missing required fields" });
          return;
        }

        const conversation = await Conversation.findOne({
          include: [
            {
              model: User,
              as: "members",
              through: { attributes: [] },
              attributes: ["id"],
            },
          ],
          where: {
            id: conversationId,
            type: "private",
          },
          transaction,
        });

        if (!conversation) {
          await transaction.rollback();
          socket.emit("error", {
            message: "Conversation not found.",
          });
          return;
        }

        const memberIds = conversation.members.map((member) => member.id);
        if (!memberIds.includes(userId)) {
          await transaction.rollback();
          socket.emit("error", {
            message: "You are not a member of this conversation.",
          });
          return;
        }

        console.log(
          `Sending message in conversation ${conversation.id} from user ${userId}`
        );

        const message = await Message.create(
          {
            conversationId: conversation.id,
            senderId: userId,
            content,
            messageType,
          },
          { transaction }
        );

        if (messageType === "text") {
          await messageEmbeddingQueue.add({
            messageId: message.id,
            content,
            messageType,
          });
        }

        await Conversation.update(
          { lastMessageAt: new Date() },
          { where: { id: conversation.id }, transaction }
        );

        await transaction.commit();

        const messageData = {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderName: username,
          conversationId: conversation.id,
          messageType: message.messageType,
          createdAt: message.createdAt,
        };

        socket.emit("message_sent", messageData);

        io.to(`user_${userId}`).emit("receive_message", messageData);

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", messageData);
        }

        const conversationUpdateData = {
          conversationId: conversation.id,
          lastMessage: messageData,
        };

        io.to(`user_${userId}`).emit(
          "conversation_updated",
          conversationUpdateData
        );
        if (receiverSocketId) {
          io.to(`user_${receiverId}`).emit(
            "conversation_updated",
            conversationUpdateData
          );
        }
      } catch (error) {
        await transaction.rollback();
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("typing_start", (data) => {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user_typing", {
          userId,
          username,
        });
      }
    });

    socket.on("typing_stop", (data) => {
      const { receiverId } = data;
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("user_stop_typing", {
          userId,
        });
      }
    });

    socket.on("mark_read", async (data) => {
      try {
        const { messageId, conversationId } = data;
        console.log(
          `Attempting to mark message ${messageId} as read by user ${userId} in conversation ${conversationId}`
        );

        if (!messageId || !conversationId) {
          console.error("Missing required data:", {
            messageId,
            conversationId,
          });
          socket.emit("error", {
            message: "Missing messageId or conversationId",
          });
          return;
        }

        const message = await Message.findByPk(messageId);
        if (!message) {
          console.error(`Message ${messageId} not found`);
          socket.emit("error", { message: "Message not found" });
          return;
        }

        const isMember = await ConversationMember.findOne({
          where: { conversationId, userId },
        });
        if (!isMember) {
          console.error(
            `User ${userId} is not a member of conversation ${conversationId}`
          );
          socket.emit("error", {
            message: "Not a member of this conversation",
          });
          return;
        }

        console.log("Creating/updating read receipt...");

        const [readReceipt, created] = await ReadReceipt.findOrCreate({
          where: { messageId, userId },
          defaults: { readAt: new Date() },
        });

        if (!created) {
          console.log("Updating existing read receipt");

          await readReceipt.update({ readAt: new Date() });
        } else {
          console.log("Created new read receipt");
        }

        console.log(
          "Read receipt created/updated successfully:",
          readReceipt.readAt
        );

        const senderSocketId = userSockets.get(message.senderId);
        if (senderSocketId) {
          console.log(
            `Emitting message_read to sender ${message.senderId} at socket ${senderSocketId}`
          );
          io.to(senderSocketId).emit("message_read", {
            messageId,
            userId,
            readAt: readReceipt.readAt,
            conversationId,
          });
        } else {
          console.log(
            `Sender ${message.senderId} is not online, cannot emit message_read`
          );
        }

        console.log(
          `Message ${messageId} marked as read by user ${userId}, event sent to sender ${message.senderId}`
        );
      } catch (error) {
        console.error("Error marking message as read:", error);
        console.error("Error stack:", error.stack);
        socket.emit("error", { message: "Failed to mark message as read" });
      }
    });

    socket.on("mark_conversation_read", async (data) => {
      try {
        const { conversationId } = data;
        console.log(
          `Marking all messages in conversation ${conversationId} as read by user ${userId}`
        );

        const unreadMessages = await Message.findAll({
          where: {
            conversationId,
            senderId: { [sequelize.Sequelize.Op.ne]: userId },
          },
          include: [
            {
              model: ReadReceipt,
              where: { userId },
              required: false,
            },
          ],
        });

        const messagesToMark = unreadMessages.filter(
          (msg) => !msg.ReadReceipts || msg.ReadReceipts.length === 0
        );

        if (messagesToMark.length > 0) {
          const readReceipts = messagesToMark.map((msg) => ({
            messageId: msg.id,
            userId,
            readAt: new Date(),
          }));

          await ReadReceipt.bulkCreate(readReceipts, {
            ignoreDuplicates: true,
          });

          messagesToMark.forEach((msg) => {
            const senderSocketId = userSockets.get(msg.senderId);
            if (senderSocketId) {
              console.log(
                `Emitting message_read to sender ${msg.senderId} for message ${msg.id}`
              );
              io.to(senderSocketId).emit("message_read", {
                messageId: msg.id,
                userId,
                readAt: new Date(),
                conversationId,
              });
            } else {
              console.log(
                `Sender ${msg.senderId} is not online, cannot emit message_read for message ${msg.id}`
              );
            }
          });

          console.log(
            `Marked ${messagesToMark.length} messages as read in conversation ${conversationId}`
          );
        }
      } catch (error) {
        console.error("Error marking conversation as read:", error);
        socket.emit("error", {
          message: "Failed to mark conversation as read",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User ${username} (${userId}) disconnected`);

      userSockets.delete(userId);
      socketUsers.delete(socket.id);
      onlineUsers.delete(userId);

      io.emit("user_status_change", {
        userId,
        username,
        status: "offline",
      });
    });
  });
}

export const getOnlineUsers = () => Array.from(onlineUsers);
export const isUserOnline = (userId) => onlineUsers.has(userId);
export const getUserSocketId = (userId) => userSockets.get(userId);
export const getIoInstance = () => ioInstance;

export default socketConnection;
