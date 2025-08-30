import {
  Conversation,
  ConversationMember,
  User,
  Message,
  sequelize,
  ReadReceipt,
  MessageEmbedding,
} from "../schemas/index.js";

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

        // Get unread message count for this conversation using a separate query
        const unreadCount = await Message.count({
          where: {
            conversationId: conversation.id,
            senderId: { [sequelize.Sequelize.Op.ne]: userId },
          },
        });

        // Get count of messages that have been read by this user
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

        const actualUnreadCount = unreadCount - readCount;

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

    // Get read receipts for all messages in this conversation
    const readReceipts = await ReadReceipt.findAll({
      where: {
        messageId: messages.map((msg) => msg.id),
      },
      attributes: ["messageId", "userId", "readAt"],
    });

    // Create a map of messageId to read receipts
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

    // Transform messages to include read receipt information
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
  try {
    const { receiverId } = req.body;
    const { id: userId } = req.user;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required",
      });
    }

    if (receiverId === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot create conversation with yourself",
      });
    }

    const existingConversation = await Conversation.findOne({
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

    const hasExactlyTwoMembers = existingConversation?.members?.length === 2;

    if (existingConversation && hasExactlyTwoMembers) {
      const otherUser = existingConversation.members.find(
        (member) => member.id !== userId
      );

      const transformedConversation = {
        id: existingConversation.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          isActive: otherUser.isActive,
        },
        lastMessage: null,
        lastMessageAt: existingConversation.lastMessageAt,
      };

      return res.json({
        success: true,
        data: transformedConversation,
        isNew: false,
      });
    }

    const conversation = await Conversation.create({
      type: "private",
      lastMessageAt: new Date(),
    });

    const conversationMembers = [
      { conversationId: conversation.id, userId },
      { conversationId: conversation.id, userId: receiverId },
    ];

    await ConversationMember.bulkCreate(conversationMembers);

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

    const transformedConversation = {
      id: newConversation.id,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        isActive: otherUser.isActive,
      },
      lastMessage: null,
      lastMessageAt: newConversation.lastMessageAt,
    };

    res.status(201).json({
      success: true,
      data: transformedConversation,
      isNew: true,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create conversation",
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

    // Get all unread messages in the conversation for this user
    const unreadMessages = await Message.findAll({
      where: {
        conversationId,
        senderId: { [sequelize.Sequelize.Op.ne]: userId },
      },
    });

    // Get message IDs that already have read receipts for this user
    const existingReadReceipts = await ReadReceipt.findAll({
      where: { userId },
      attributes: ["messageId"],
    });

    const existingReadMessageIds = new Set(
      existingReadReceipts.map((rr) => rr.messageId)
    );

    // Filter out messages that already have read receipts
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

    // Check if user is a member of the conversation
    const isMember = await ConversationMember.findOne({
      where: { conversationId, userId },
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Not a member of this conversation",
      });
    }

    // Get OpenAI API key from environment
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search for similar messages using Typesense
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
        createdAt: new Date(result.createdAt * 1000), // Convert from Unix timestamp
        similarity: 1 - (hit.vector_distance || 0), // Convert distance to similarity
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

const searchAllMessages = async (req, res) => {
  try {
    const { query } = req.query;
    const { id: userId } = req.user;

    console.log("query", query);

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    // Get OpenAI API key from environment
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search for similar messages using Typesense
    const { performVectorSearch, messageEmbeddingSchema } = await import(
      "../config/typesense.js"
    );

    // Get user's conversations first
    const userConversations = await ConversationMember.findAll({
      where: { userId },
      include: [
        {
          model: Conversation,
          as: "conversation",
          attributes: ["id", "type"],
        },
      ],
    });

    const conversationIds = userConversations.map((cm) => cm.conversation.id);

    if (conversationIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        query,
        totalConversations: 0,
        totalMessages: 0,
      });
    }

    const searchResults = await performVectorSearch(
      messageEmbeddingSchema.name,
      queryEmbedding,
      { conversationId: `[${conversationIds.join(",")}]` },
      50
    );

    // Group results by conversation
    const groupedResults = searchResults.hits.reduce((acc, hit) => {
      const result = hit.document;
      const conversationId = result.conversationId;
      if (!acc[conversationId]) {
        acc[conversationId] = {
          conversationId,
          conversationType: result.conversationType,
          messages: [],
        };
      }

      acc[conversationId].messages.push({
        id: result.id,
        content: result.content,
        senderId: result.senderId,
        senderName: result.senderName,
        messageType: result.messageType,
        createdAt: new Date(result.createdAt * 1000), // Convert from Unix timestamp
        similarity: 1 - (hit.vector_distance || 0), // Convert distance to similarity
      });

      return acc;
    }, {});

    const transformedResults = Object.values(groupedResults).map(
      (conversation) => ({
        conversationId: conversation.conversationId,
        conversationType: conversation.conversationType,
        messages: conversation.messages.sort(
          (a, b) => b.similarity - a.similarity
        ),
        totalMessages: conversation.messages.length,
        bestMatch: conversation.messages[0]?.similarity || 0,
      })
    );

    res.json({
      success: true,
      data: transformedResults,
      query,
      totalConversations: transformedResults.length,
      totalMessages: searchResults.length,
    });
  } catch (error) {
    console.error("Error searching all messages:", error);
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
  searchAllMessages,
};

export default ConversationController;
