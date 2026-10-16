import express from "express";
import {
  createPost,
  getPost,
  deletePost,
  getAllPosts,
  updatePost,
} from "../controllers/post-controller.js";
import { authenticateRequest } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateRequest);

router.post("/", createPost);
router.get("/", getAllPosts);
router.get("/:id", getPost);
router.put("/:id", updatePost);
router.delete("/:id", deletePost);

export default router;