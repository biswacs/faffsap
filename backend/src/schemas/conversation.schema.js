import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Conversation extends Model {}

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
