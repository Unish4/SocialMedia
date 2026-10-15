import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    message:
      statusCode >= 500
        ? "Internal server error"
        : err.message || "Request failed",
  });
};

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    message: "Resource not found",
  });
};
