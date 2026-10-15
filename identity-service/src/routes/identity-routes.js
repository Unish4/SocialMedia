import express from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  logoutUser,
  refreshTokenUser,
} from "../controllers/identity-controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getUserProfile);
router.post("/logout", logoutUser);
router.post("/refresh-token", refreshTokenUser);

export default router;
