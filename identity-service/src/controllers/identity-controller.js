import generateToken from "../utils/generateToken.js";
import logger from "../utils/logger.js";
import { validateRegistration } from "../utils/validation.js";
import User from "../models/User.js";

export const registerUser = async (req, res) => {
  logger.info("Registering user with data:");
  try {
    const { error } = validateRegistration(req.body);

    if (error) {
      logger.error("Validation error: %s", error.details[0].message);
      return res.status(400).json({ message: error.details[0].message });
    }

    const { username, email, password } = req.body;

    const ExistingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (ExistingUser) {
      logger.error("User with email %s already exists", email);
      return res.status(400).json({ message: "User already exists" });
    }

    if (password.length < 6 || password.length > 30) {
      logger.error("Password length validation failed");
      return res.status(400).json({
        message: "Password must be between 6 and 30 characters long",
      });
    }

    const user = await User.create({ username, email, password });

    logger.info("User registered successfully: %s", user.id);

    const { accessToken, refreshToken } = await generateToken(user);

    return res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    logger.error("Registration failed: %s", error.message);
  }
};

export const loginUser = async (req, res) => {};
