import generateToken from "../utils/generateToken.js";
import logger from "../utils/logger.js";
import { validateLogin, validateRegistration } from "../utils/validation.js";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";

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

export const loginUser = async (req, res) => {
  try {
    logger.info("Logging in user with data:");

    const { error, value } = validateLogin(req.body);
    
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { email, password } = value;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      logger.error("User with email %s not found", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.error("Invalid password for user with email %s", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const { accessToken, refreshToken } = await generateToken(user);

    logger.info("User logged in successfully: %s", user.id);

    return res.status(200).json({
      message: "User logged in successfully",
      user: { id: user.id, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Login failed: %s", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refreshTokenUser = async (req, res) => {
  logger.info("Refreshing token for user with data:");
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.error("Refresh token not provided");
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const storedRefreshToken = await RefreshToken.findOne({
      token: refreshToken,
    });

    if (!storedRefreshToken || storedRefreshToken.expiresAt < new Date()) {
      logger.error("Invalid refresh token");
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(storedRefreshToken.userId);

    if (!user) {
      logger.error("User not found");
      return res.status(404).json({ message: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateToken(user);

    await RefreshToken.deleteOne({ token: refreshToken });

    logger.info("Token refreshed successfully for user: %s", user.id);

    return res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("Refresh token failed: %s", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logoutUser = async (req, res) => {
  logger.info("Logging out user with data:");
  try {
    const refreshTokenFromBody = req.body?.refreshToken;
    const refreshTokenFromHeader = req.headers.authorization?.startsWith(
      "Bearer ",
    )
      ? req.headers.authorization.slice(7)
      : null;

    const refreshToken = refreshTokenFromBody || refreshTokenFromHeader;

    if (!refreshToken) {
      logger.error("Refresh token not provided");
      return res.status(400).json({ message: "Refresh token is required" });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    logger.info("User logged out successfully");

    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    logger.error("Logout failed: %s", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserProfile = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Not authorized" });
  }

  logger.info("Fetching user profile for user with ID: %s", req.user.id);
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      logger.error("User not found with ID: %s", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    logger.error("Fetching user profile failed: %s", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
