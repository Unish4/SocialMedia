import jwt from "jsonwebtoken";

import { ENV } from "../utils/env.js";
import logger from "../utils/logger.js";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);

    req.user = {
      id: decoded.userId,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    logger.warn("Auth token verification failed: %s", error.message);

    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
};