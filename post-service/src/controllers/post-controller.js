import mongoose from "mongoose";
import logger from "../utils/logger.js";
import Post from "../models/Post.js";
import { validateCreatePost, validateUpdatePost } from "../utils/validation.js";

export const createPost = async (req, res) => {
  try {
    const { error } = validateCreatePost(req.body);

    if (error) {
      logger.warn(
        "Validation error while creating post",
        error.details[0].message,
      );
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { content, mediaUrl } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        message: "Post content is required",
      });
    }

    const post = await Post.create({
      user: req.userId,
      content,
      mediaUrl: mediaUrl ?? [],
    });

    res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    logger.error("Error creating post", error);
    res.status(500).json({ message: "Error creating post" });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    logger.error("Error fetching posts", error);
    res.status(500).json({ message: "Error fetching posts" });
  }
};

export const getPost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json(post);
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({ message: "Error fetching post" });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { error } = validateUpdatePost(req.body);

    if (error) {
      logger.warn(
        "Validation error while updating post",
        error.details[0].message,
      );
      return res.status(400).json({ message: error.details[0].message });
    }
    
    const { id } = req.params;
    const { content, mediaUrl } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (content === undefined && mediaUrl === undefined) {
      return res.status(400).json({
        message: "Provide content or mediaUrl to update",
      });
    }

    if (content !== undefined && !content.trim()) {
      return res.status(400).json({
        message: "Post content cannot be empty",
      });
    }

    const updates = {};

    if (content !== undefined) updates.content = content;
    if (mediaUrl !== undefined) updates.mediaUrl = mediaUrl;

    const post = await Post.findOneAndUpdate(
      { _id: id, user: req.userId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!post) {
      return res.status(404).json({
        message: "Post not found or you are not authorized to update it",
      });
    }

    res.status(200).json(post);
  } catch (error) {
    logger.error("Error updating post", error);
    res.status(500).json({ message: "Error updating post" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const post = await Post.findOneAndDelete({
      _id: id,
      user: req.userId,
    });

    if (!post) {
      return res.status(404).json({
        message: "Post not found or you are not authorized to delete it",
      });
    }

    res.status(200).json({
      message: "Post deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting post", error);
    res.status(500).json({ message: "Error deleting post" });
  }
};
