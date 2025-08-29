import { User, sequelize } from "../schemas/index.js";
import jwt from "jsonwebtoken";

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT secret is missing.");
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
};

const UserController = {
  async register(req, res) {
    try {
      if (!req.body.name || !req.body.email || !req.body.password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { name, email, password } = req.body;
      const transaction = await sequelize.transaction();

      try {
        const existingUser = await User.findOne({
          where: { email },
          transaction,
        });

        if (existingUser) {
          await transaction.rollback();
          return res.status(400).json({ message: "Email already exists" });
        }

        const user = await User.create(
          {
            name,
            email: email.toLowerCase(),
            password,
          },
          { transaction }
        );

        await transaction.commit();

        const auth_token = generateToken(user.id);
        res.status(201).json({
          message: "User created successfully",
          auth_token: auth_token,
        });
      } catch (error) {
        await transaction.rollback();
        res.status(500).json({ message: "Failed to create user" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async login(req, res) {
    try {
      if (!req.body.email || !req.body.password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { email, password } = req.body;

      try {
        const user = await User.findOne({
          where: {
            email: email.toLowerCase(),
            isActive: true,
          },
          attributes: ["id", "name", "email", "password"],
          raw: false,
        });

        if (!user) {
          return res.status(401).json({ message: "Invalid email" });
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Invalid password" });
        }

        const auth_token = generateToken(user.id);

        if (!auth_token) {
          throw new Error("Failed to generate access token");
        }

        res.json({
          message: "Login successful",
          auth_token: auth_token,
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "An error occurred during authentication" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      try {
        const user = await User.findOne({
          where: { id: userId },
          attributes: [
            "id",
            "name",
            "email",
            "isActive",
            "createdAt",
            "updatedAt",
          ],
        });

        if (!user) {
          return res.status(404).json({ message: "User profile not found" });
        }

        res.json({
          message: "Profile retrieved successfully",
          data: {
            user: user,
          },
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to retrieve user profile" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },

  async getAllUsers(req, res) {
    try {
      const currentUserId = req.user.id;

      try {
        const users = await User.findAll({
          where: {
            id: { [sequelize.Sequelize.Op.ne]: currentUserId },
            isActive: true,
          },
          attributes: [
            "id",
            "name",
            "email",
            "isActive",
            "createdAt",
            "updatedAt",
          ],
          order: [["name", "ASC"]],
        });

        res.json({
          message: "Users retrieved successfully",
          data: users,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to retrieve users" });
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
};

export default UserController;
