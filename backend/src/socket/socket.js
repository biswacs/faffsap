import {
  User,
  Conversation,
  Message,
  ConversationMember,
  ReadReceipt,
  sequelize,
} from "../schemas/index.js";
import { authenticateSocket } from "../middleware/auth.middleware.js";

const userSockets = new Map();
const socketUsers = new Map();
const onlineUsers = new Set();

function socketConnection(io) {
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
      try {
        const { receiverId, content, messageType = "text" } = data;

        if (!receiverId || !content) {
          socket.emit("error", { message: "Missing required fields" });
          return;
        }

        let conversation = await Conversation.findOne({
          include: [
            {
              model: User,
              as: "members",
              through: { attributes: [] },
              where: {
                id: { [sequelize.Sequelize.Op.in]: [userId, receiverId] },
              },
            },
          ],
          where: { type: "private" },
        });

        if (!conversation || conversation.members.length !== 2) {
          conversation = await Conversation.create({
            type: "private",
            lastMessageAt: new Date(),
          });

          await ConversationMember.bulkCreate([
            { conversationId: conversation.id, userId },
            { conversationId: conversation.id, userId: receiverId },
          ]);
        }

        const message = await Message.create({
          conversationId: conversation.id,
          senderId: userId,
          content,
          messageType,
        });

        await Conversation.update(
          { lastMessageAt: new Date() },
          { where: { id: conversation.id } }
        );

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

        io.to(`user_${userId}`).emit("conversation_updated", {
          conversationId: conversation.id,
          lastMessage: messageData,
        });

        if (receiverSocketId) {
          io.to(`user_${receiverId}`).emit("conversation_updated", {
            conversationId: conversation.id,
            lastMessage: messageData,
          });
        }
      } catch (error) {
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

        // Validate input data
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

        // Check if the message exists and get the sender
        const message = await Message.findByPk(messageId);
        if (!message) {
          console.error(`Message ${messageId} not found`);
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Check if user is a member of the conversation
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

        // Create or update read receipt
        const [readReceipt, created] = await ReadReceipt.findOrCreate({
          where: { messageId, userId },
          defaults: { readAt: new Date() },
        });

        if (!created) {
          console.log("Updating existing read receipt");
          // Update existing read receipt
          await readReceipt.update({ readAt: new Date() });
        } else {
          console.log("Created new read receipt");
        }

        console.log(
          "Read receipt created/updated successfully:",
          readReceipt.readAt
        );

        // Find the sender's socket and emit message_read directly to them
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

        // Get all unread messages in the conversation for this user
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

        // Mark all unread messages as read
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

          // Emit read receipts directly to each sender
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

export default socketConnection;
