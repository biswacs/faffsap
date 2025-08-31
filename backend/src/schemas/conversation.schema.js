import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Conversation extends Model {
  // Custom validation to prevent duplicate conversations
  static async findOrCreatePrivateConversation(userId1, userId2) {
    const existingConversation = await this.findOne({
      include: [
        {
          model: sequelize.models.User,
          as: "members",
          through: { attributes: [] },
          where: {
            id: { [sequelize.Sequelize.Op.in]: [userId1, userId2] },
          },
        },
      ],
      where: { type: "private" },
    });

    if (existingConversation && existingConversation.members.length === 2) {
      return [existingConversation, false]; // false means not created
    }

    // Create new conversation
    const conversation = await this.create({
      type: "private",
      lastMessageAt: new Date(),
    });

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
