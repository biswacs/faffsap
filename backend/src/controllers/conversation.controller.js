import {
  Conversation,
  ConversationMember,
  User,
  Message,
  sequelize,
  ReadReceipt,
} from "../schemas/index.js";
import { getUserSocketId, getIoInstance } from "../socket/socket.js";

const getUserConversations = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const conversations = await Conversation.findAll({
      include: [
        {
          model: User,
          as: "members",
          through: { attributes: [] },
          attributes: ["id", "username", "isActive"],
        },
        {
          model: Message,
          as: "messages",
          limit: 1,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "username"],
            },
          ],
        },
      ],
      where: { type: "private" },
      order: [["lastMessageAt", "DESC"]],
    });

    const userConversations = conversations.filter((conversation) =>
      conversation.members.some((member) => member.id === userId)
    );

    const transformedConversations = await Promise.all(
      userConversations.map(async (conversation) => {
        const otherUser = conversation.members.find(
          (member) => member.id !== userId
        );

        const lastMessage = conversation.messages[0];

        const unreadCount = await Message.count({
          where: {
            conversationId: conversation.id,
            senderId: { [sequelize.Sequelize.Op.ne]: userId },
          },
        });

        const readCount = await ReadReceipt.count({
          where: {
            userId: userId,
          },
          include: [
            {
              model: Message,
              as: "message",
              where: {
                conversationId: conversation.id,
                senderId: { [sequelize.Sequelize.Op.ne]: userId },
              },
            },
          ],
        });

        const actualUnreadCount = Math.max(0, unreadCount - readCount);

        return {
          id: conversation.id,
          otherUser: {
            id: otherUser?.id,
            username: otherUser?.username,
            isActive: otherUser?.isActive,
          },
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.username,
                createdAt: lastMessage.createdAt,
              }
            : null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: Math.max(0, actualUnreadCount),
        };
      })
    );

    res.json({
      success: true,
      data: transformedConversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
};

const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { id: userId } = req.user;

    const isMember = await ConversationMember.findOne({
      where: { conversationId, userId },
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Not a member of this conversation",
      });
    }

    const messages = await Message.findAll({
      where: { conversationId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "username"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const readReceipts = await ReadReceipt.findAll({
      where: {
        messageId: messages.map((msg) => msg.id),
      },
      attributes: ["messageId", "userId", "readAt"],
    });

    const readReceiptsMap = readReceipts.reduce((acc, receipt) => {
      if (!acc[receipt.messageId]) {
        acc[receipt.messageId] = [];
      }
      acc[receipt.messageId].push({
        userId: receipt.userId,
        readAt: receipt.readAt,
      });
      return acc;
    }, {});

    const transformedMessages = messages.map((message) => ({
      id: message.id,
      content: message.content,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: message.sender,
      messageType: message.messageType,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      readReceipts: readReceiptsMap[message.id] || [],
      isRead: (readReceiptsMap[message.id] || []).length > 0,
    }));

    res.json({
      success: true,
      data: transformedMessages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};

const createPrivateConversation = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { receiverId } = req.body;
    const { id: userId } = req.user;

    if (!receiverId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    if (receiverId === userId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot create conversation with yourself",
      });
    }

    console.log(
      `Checking for existing conversation between users ${userId} and ${receiverId}`
    );

    const [conversation, isNew] =
      await Conversation.findOrCreatePrivateConversation(
        userId,
        receiverId,
        transaction
      );

    if (!isNew) {
      console.log(
        `Found existing conversation ${conversation.id} for users ${userId} and ${receiverId}`
      );

      await transaction.commit();

      const otherUser = conversation.members.find(
        (member) => member.id !== userId
      );

      const lastMessage = await Message.findOne({
        where: { conversationId: conversation.id },
        include: [
          {
            model: User,
            as: "sender",
            attributes: ["id", "username"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      const unreadCount = await Message.count({
        where: {
          conversationId: conversation.id,
          senderId: { [sequelize.Sequelize.Op.ne]: userId },
        },
      });

      const readCount = await ReadReceipt.count({
        where: {
          userId: userId,
        },
        include: [
          {
            model: Message,
            as: "message",
            where: {
              conversationId: conversation.id,
              senderId: { [sequelize.Sequelize.Op.ne]: userId },
            },
          },
        ],
      });

      const actualUnreadCount = Math.max(0, unreadCount - readCount);

      const transformedConversation = {
        id: conversation.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          isActive: otherUser.isActive,
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: lastMessage.sender.username,
              createdAt: lastMessage.createdAt,
            }
          : null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: actualUnreadCount,
      };

      return res.json({
        success: true,
        data: transformedConversation,
        isNew: false,
      });
    }

    console.log(
      `Creating new conversation between users ${userId} and ${receiverId}`
    );

    const conversationMembers = [
      { conversationId: conversation.id, userId },
      { conversationId: conversation.id, userId: receiverId },
    ];

    await ConversationMember.bulkCreate(conversationMembers, { transaction });

    console.log(
      `Created new conversation ${conversation.id} with members:`,
      conversationMembers
    );

    await transaction.commit();

    const newConversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: User,
          as: "members",
          through: { attributes: [] },
          attributes: ["id", "username", "isActive"],
        },
      ],
    });

    const otherUser = newConversation.members.find(
      (member) => member.id !== userId
    );
    const currentUser = newConversation.members.find(
      (member) => member.id === userId
    );

    const transformedConversation = {
      id: newConversation.id,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        isActive: otherUser.isActive,
      },
      lastMessage: null,
      lastMessageAt: newConversation.lastMessageAt,
      unreadCount: 0,
    };

    // If this is a new conversation, broadcast it to the other user
    if (isNew) {
      const io = getIoInstance();
      if (io) {
        const conversationForReceiver = {
          id: newConversation.id,
          otherUser: {
            id: currentUser.id,
            username: currentUser.username,
            isActive: currentUser.isActive,
          },
          lastMessage: null,
          lastMessageAt: newConversation.lastMessageAt,
          unreadCount: 0,
        };

        const receiverSocketId = getUserSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit(
            "new_conversation",
            conversationForReceiver
          );
          console.log(`Broadcasted new conversation to user ${receiverId}`);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: transformedConversation,
      isNew: true,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create conversation",
      error: error.message,
    });
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { id: userId } = req.user;

    const isMember = await ConversationMember.findOne({
      where: { conversationId, userId },
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Not a member of this conversation",
      });
    }

    const unreadMessages = await Message.findAll({
      where: {
        conversationId,
        senderId: { [sequelize.Sequelize.Op.ne]: userId },
      },
    });

    const existingReadReceipts = await ReadReceipt.findAll({
      where: { userId },
      attributes: ["messageId"],
    });

    const existingReadMessageIds = new Set(
      existingReadReceipts.map((rr) => rr.messageId)
    );

    const messagesToMark = unreadMessages.filter(
      (msg) => !existingReadMessageIds.has(msg.id)
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
    }

    res.json({
      success: true,
      message: `Marked ${messagesToMark.length} messages as read`,
      data: { markedCount: messagesToMark.length },
    });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark conversation as read",
    });
  }
};

const searchMessagesInConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { query } = req.query;
    const { id: userId } = req.user;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    const isMember = await ConversationMember.findOne({
      where: { conversationId, userId },
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Not a member of this conversation",
      });
    }

    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const { performVectorSearch, messageEmbeddingSchema } = await import(
      "../config/typesense.js"
    );

    const searchResults = await performVectorSearch(
      messageEmbeddingSchema.name,
      queryEmbedding,
      { conversationId },
      20
    );

    const transformedResults = searchResults.hits.map((hit) => {
      const result = hit.document;
      return {
        id: result.id,
        content: result.content,
        senderId: result.senderId,
        senderName: result.senderName,
        messageType: result.messageType,
        createdAt: new Date(result.createdAt * 1000),
        similarity: 1 - (hit.vector_distance || 0),
      };
    });

    res.json({
      success: true,
      data: transformedResults,
      query,
      totalResults: transformedResults.length,
    });
  } catch (error) {
    console.error("Error searching messages in conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search messages",
    });
  }
};

const ConversationController = {
  getUserConversations,
  getConversationMessages,
  createPrivateConversation,
  markConversationAsRead,
  searchMessagesInConversation,
};

export default ConversationController;
