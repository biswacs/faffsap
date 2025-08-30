import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const MessageEmbedding = sequelize.define(
  "MessageEmbedding",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Messages",
        key: "id",
      },
    },
    embedding: {
      type: DataTypes.TEXT, // Store as text, cast to vector in queries
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "message_embeddings",
    timestamps: true,
  }
);

export default MessageEmbedding;
