import logger from "../utils/logger.js";

export const authenticateRequest = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    logger.error("User ID not provided in request headers");
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.userId = userId;
  next();
};
