import {
  Conversation,
  ConversationMember,
  User,
  Message,
} from "../schemas/index.js";

export const createConversation = async (req, res) => {
  try {
    const { type, name, memberIds } = req.body;
    const { userId } = req.user;

    const conversation = await Conversation.create({
      type,
      name: type === "private" ? null : name,
      lastMessageAt: new Date(),
    });

    const members = [userId, ...memberIds];
    const conversationMembers = members.map((memberId) => ({
      conversationId: conversation.id,
      userId: memberId,
    }));

    await ConversationMember.bulkCreate(conversationMembers);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.user;

    const conversations = await Conversation.findAll({
      include: [
        {
          model: ConversationMember,
          where: { userId },
          include: [
            {
              model: User,
              attributes: ["id", "name", "email"],
            },
          ],
        },
        {
          model: Message,
          limit: 1,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: User,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["lastMessageAt", "DESC"]],
    });

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.user;

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
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
