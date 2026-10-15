import express from "express";
import cors from "cors";
import helmet from "helmet";
import Redis from "ioredis";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

import { ENV } from "./utils/env.js";
import logger from "./utils/logger.js";
import { connectDB } from "./config/db.js";
import identityRoutes from "./routes/identity-routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = ENV.PORT || 3001;

//  Security middleware
app.use(helmet());

//  CORS
app.use(
  cors({
    origin: ENV.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

//  Parse request bodies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

//  Request logging (never log passwords or tokens)
app.use((req, res, next) => {
  logger.info("Received %s request to %s", req.method, req.path);
  next();
});

function createGeneralRateLimiter(redisClient) {
  if (redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "identity:middleware",
      points: 10,
      duration: 1,
      insuranceLimiter: new RateLimiterMemory({ points: 10, duration: 1 }),
    });
  }

  return new RateLimiterMemory({
    points: 10,
    duration: 1,
  });
}

function createSensitiveEndpointsLimiter(redisClient) {
  const limiterOptions = {
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn("Authentication rate limit exceeded for IP: %s", req.ip);

      res.status(429).json({
        success: false,
        message: "Too many authentication attempts. Try again later.",
      });
    },
  };

  if (redisClient) {
    return rateLimit({
      ...limiterOptions,
      store: new RedisStore({
        prefix: "identity:auth:",
        sendCommand: (command, ...args) => redisClient.call(command, ...args),
      }),
    });
  }

  return rateLimit(limiterOptions);
}

async function createRedisClient() {
  if (!ENV.REDIS_URL) {
    logger.warn(
      "REDIS_URL is not set. Falling back to in-memory rate limiting.",
    );
    return null;
  }

  const redisClient = new Redis(ENV.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  // ioredis emits error events before connect() rejects; swallow here and log once in catch.
  redisClient.on("error", (err) => logger.warn("Redis error: %s", err.message));

  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info("Redis connected successfully");
    return redisClient;
  } catch (error) {
    logger.warn(
      "Redis unavailable, falling back to in-memory rate limiting: %s",
      error?.message || String(error),
    );
    redisClient.disconnect();
    return null;
  }
}

// Start server after dependencies connect
async function startServer() {
  let redisClient;

  try {
    await connectDB();
    redisClient = await createRedisClient();

    const generalRateLimiter = createGeneralRateLimiter(redisClient);

    app.use((req, res, next) => {
      generalRateLimiter
        .consume(req.ip)
        .then(() => next())
        .catch((error) => {
          if (error instanceof Error) {
            logger.error("Rate limiter error: %s", error.message);

            return res.status(503).json({
              success: false,
              message: "Rate limiting service unavailable",
            });
          }

          const retryAfter = Math.max(1, Math.ceil(error.msBeforeNext / 1000));

          logger.warn("Rate limit exceeded for IP: %s", req.ip);

          res.set("Retry-After", String(retryAfter));

          return res.status(429).json({
            success: false,
            message: "Too many requests",
          });
        });
    });

    const sensitiveEndpointsLimiter =
      createSensitiveEndpointsLimiter(redisClient);

    // API routes
    app.use("/api/auth/register", sensitiveEndpointsLimiter);
    // app.use("/api/auth/login", sensitiveEndpointsLimiter);

    app.use("/api/auth", identityRoutes);

    //  Handle unmatched routes
    app.use(notFoundHandler);

    // Centralized error handler
    app.use(errorHandler);

    const server = app.listen(PORT, () => {
      logger.info(`Identity service running on port ${PORT}`);
      logger.info(`Environment: ${ENV.NODE_ENV}`);
    });

    server.on("error", (error) => {
      logger.error("HTTP server error: %s", error.message);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start identity service: %s", error.message);

    if (redisClient) {
      redisClient.disconnect();
    }

    process.exit(1);
  }
}

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection: %s", String(reason));
});
