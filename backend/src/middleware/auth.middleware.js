import jwt from "jsonwebtoken";
import { User } from "../schemas/index.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      console.log("[authMiddleware] No authorization header found");
      return res.status(401).json({
        message: "Authorization header missing",
        shouldLogout: true,
      });
    }

    const lm_auth_token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(lm_auth_token, process.env.JWT_SECRET);

    const user = await User.findOne({
      where: {
        id: decoded.userId || decoded.id,
        isActive: true,
      },
      attributes: ["id", "email", "name"],
    });

    if (!user) {
      return res.status(401).json({
        message: "User not found or inactive",
        shouldLogout: true,
      });
    }

    req.user = user;
    req.lm_auth_token = lm_auth_token;
    next();
  } catch (error) {
    res.status(401).json({
      message: "Please authenticate",
      shouldLogout: true,
    });
  }
};

export default authMiddleware;
