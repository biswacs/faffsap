import express from "express";
import UserController from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", UserController.register);
router.post("/login", UserController.login);
router.get("/profile", authMiddleware, UserController.getProfile);
router.get("/search", authMiddleware, UserController.searchUsers);

export default router;
