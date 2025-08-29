import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class ReadReceipt extends Model {}

ReadReceipt.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    readAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "ReadReceipt",
    timestamps: true,
    indexes: [
      {
        fields: ["messageId", "userId"],
        unique: true,
      },
      {
        fields: ["userId"],
      },
    ],
  }
);

export default ReadReceipt;
