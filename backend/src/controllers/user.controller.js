import { User, sequelize } from "../schemas/index.js";
import { Op } from "sequelize";
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
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: "missing required fields" });
      }

      let { username, password } = req.body;

      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message:
            "username can only contain lowercase letters, numbers 0-9, and underscores",
        });
      }

      username = username.toLowerCase().trim().replace(/\s+/g, "");

      try {
        const existingUser = await User.findOne({
          where: { username },
        });

        if (existingUser) {
          return res.status(400).json({ message: "username already exists" });
        }

        const user = await User.create({
          username,
          password,
        });

        const auth_token = generateToken(user.id);
        res.status(201).json({
          message: "user created successfully",
          auth_token: auth_token,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "failed to create user" });
      }
    } catch (error) {
      console.log(error);           
      res.status(500).json({ message: "internal server error" });
    }
  },

  async login(req, res) {
    try {
      console.log(req.body);
      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ message: "missing required fields" });
      }

      let { username, password } = req.body;
      console.log(username, password);

      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message:
            "username can only contain lowercase letters, numbers 0-9, and underscores",
        });
      }

      try {
        const user = await User.findOne({
          where: {
            username,
            isActive: true,
          },
          attributes: ["id", "username", "password"],
          raw: false,
        });

        if (!user) {
          return res.status(401).json({ message: "user not found" });
        }

        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "invalid password" });
        }

        const auth_token = generateToken(user.id);

        if (!auth_token) {
          throw new Error("Failed to generate access token");
        }

        res.json({
          message: "login successful",
          auth_token: auth_token,
        });
      } catch (error) {
        console.log(error);
        res
          .status(500)
          .json({ message: "an error occurred during authentication" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "internal server error" });
    }
  },

  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      try {
        const user = await User.findOne({
          where: { id: userId },
          attributes: ["id", "username", "isActive"],
        });

        if (!user) {
          return res.status(404).json({ message: "user profile not found" });
        }

        res.json({
          message: "profile retrieved successfully",
          data: {
            user: user,
          },
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "failed to retrieve user profile" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "internal server error" });
    }
  },

  async searchUsers(req, res) {
    try {
      const { username } = req.query;
      const currentUserId = req.user.id;

      if (!username || username.trim().length === 0) {
        return res.status(400).json({
          message: "username parameter is required",
        });
      }

      const usernameRegex = /^[a-z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message:
            "username can only contain lowercase letters, numbers 0-9, and underscores",
        });
      }

      try {
        const users = await User.findAll({
          where: {
            id: { [Op.ne]: currentUserId },
            isActive: true,
            username: {
              [Op.iLike]: `%${username.trim()}%`,
            },
          },
          attributes: ["id", "username", "isActive", "createdAt", "updatedAt"],
          order: [["username", "ASC"]],
          limit: 10,
        });

        res.json({
          message: "users found successfully",
          data: users,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "failed to search users" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "internal server error" });
    }
  },
};

export default UserController;
