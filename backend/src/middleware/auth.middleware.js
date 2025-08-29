import jwt from "jsonwebtoken";
import { User } from "../schemas/index.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      console.log("[authMiddleware] No authorization header found");
      return res.status(401).json({
        message: "Authorization header missing",
      });
    }

    const lm_auth_token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(lm_auth_token, process.env.JWT_SECRET);

    const user = await User.findOne({
      where: {
        id: decoded.userId || decoded.id,
        isActive: true,
      },
      attributes: ["id", "username"],
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found or inactive",
      });
    }

    req.user = user;
    req.lm_auth_token = lm_auth_token;
    next();
  } catch (error) {
    res.status(401).json({
      message: "Please authenticate",
    });
  }
};
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      where: { id: decoded.id, isActive: true },
      attributes: ["id", "username"],
    });

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.userId = user.id;
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
};

export { authMiddleware, authenticateSocket };
