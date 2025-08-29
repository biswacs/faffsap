import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class ConversationMember extends Model {}

ConversationMember.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "ConversationMember",
    timestamps: true,
    indexes: [
      {
        fields: ["conversationId", "userId"],
        unique: true,
      },
      {
        fields: ["userId"],
      },
    ],
  }
);

export default ConversationMember;
