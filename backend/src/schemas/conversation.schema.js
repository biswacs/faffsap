import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Conversation extends Model {
  // Custom validation to prevent duplicate conversations
  static async findOrCreatePrivateConversation(
    userId1,
    userId2,
    transaction = null
  ) {
    // First, find all private conversations that include both users
    const existingConversations = await this.findAll({
      include: [
        {
          model: sequelize.models.User,
          as: "members",
          through: { attributes: [] },
          attributes: ["id"],
        },
      ],
      where: { type: "private" },
      transaction,
    });

    // Filter to find a conversation that has exactly these two users
    const exactMatch = existingConversations.find((conv) => {
      if (conv.members.length !== 2) return false;

      const memberIds = conv.members.map((member) => member.id);
      return memberIds.includes(userId1) && memberIds.includes(userId2);
    });

    if (exactMatch) {
      console.log(
        `Found existing conversation ${exactMatch.id} between users ${userId1} and ${userId2}`
      );
      return [exactMatch, false]; // false means not created
    }

    // Create new conversation
    console.log(
      `Creating new conversation between users ${userId1} and ${userId2}`
    );
    const conversation = await this.create(
      {
        type: "private",
        lastMessageAt: new Date(),
      },
      { transaction }
    );

    return [conversation, true]; // true means created
  }
}

Conversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM("private", "group"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Conversation",
    timestamps: true,
    indexes: [
      {
        fields: ["type"],
      },
      {
        fields: ["lastMessageAt"],
      },
    ],
  }
);

export default Conversation;
