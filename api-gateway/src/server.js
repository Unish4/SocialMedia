import { ENV } from "./utils/env.js";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = ENV.PORT;

app.use(helmet());
app.use(cors());

// NOTE: express.json() is intentionally NOT registered here.
// express-http-proxy reads the raw request stream to forward the body. If
// express.json() runs first it consumes that stream, so POST bodies never
// reach the proxy. Instead we register express.json() AFTER the proxy below,
// and we use proxyReqBodyDecorator to re-serialise req.body for proxied
// auth routes (see the auth proxy configuration).

app.use((req, res, next) => {
  logger.info("Received %s request to %s", req.method, req.path);
  next();
});

function createRateLimiter(redisClient) {
  const baseOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many requests" });
    },
  };

  if (!redisClient) {
    return rateLimit(baseOptions);
  }

  return rateLimit({
    ...baseOptions,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
  });
}

async function createRedisClient() {
  if (!ENV.REDIS_URL) {
    logger.warn("REDIS_URL is not set. Using in-memory rate limiting.");
    return null;
  }

  const redisClient = new Redis(ENV.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  redisClient.on("error", () => {});

  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info("Redis connected successfully");
    return redisClient;
  } catch (error) {
    logger.warn(
      "Redis unavailable, using in-memory rate limiting: %s",
      error?.message || String(error),
    );
    redisClient.disconnect();
    return null;
  }
}

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    // The proxy's timeout option aborts the upstream socket, which surfaces as
    // an ECONNRESET error. Return 504 (Gateway Timeout) in that case — the same
    // status the proxy library's built-in handler would return — so clients
    // receive a meaningful signal instead of a generic 500. All other proxy
    // errors (connection refused, DNS failure, etc.) remain 500.
    if (err?.code === "ECONNRESET") {
      logger.warn(
        "Proxy request timed out (ECONNRESET): %s",
        err?.message || String(err),
      );
      res.setHeader("X-Timeout-Reason", "Gateway proxy request timed out.");
      return res.status(504).json({ message: "Gateway timeout" });
    }

    logger.error("Proxy error: %s", err?.stack || err?.message || String(err));
    res.status(500).json({ message: "Internal server error" });
  },
};

async function startServer() {
  const redisClient = await createRedisClient();

  app.use("/v1/auth", createRateLimiter(redisClient));


  app.use(
    "/v1/auth",
    proxy(ENV.IDENTITY_SERVICE_URL, {
      ...proxyOptions,
      timeout: 10000,
      parseReqBody: false,
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["Content-Type"] = "application/json";
        return proxyReqOpts;
      },
      proxyReqBodyDecorator: (bodyContent, srcReq) => {
        // If express.json() (or another body parser) has already consumed the
        // stream, req.body is populated. Re-serialise it so the upstream
        // service receives a valid JSON body.
        if (
          srcReq.body &&
          typeof srcReq.body === "object" &&
          Object.keys(srcReq.body).length > 0
        ) {
          return JSON.stringify(srcReq.body);
        }
        return bodyContent;
      },
      userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(
          `Response received from Identity service: ${proxyRes.statusCode}`,
        );

        return proxyResData;
      },
    }),
  );

  // Register express.json() AFTER the proxy so it is available for any
  // non-proxied routes added in the future, without interfering with proxy
  // body forwarding.
  app.use(express.json());

  //  Handle unmatched routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(
      `Identity service is running on port ${ENV.IDENTITY_SERVICE_URL}`,
    );
    logger.info(
      redisClient
        ? "Redis rate limiting is enabled"
        : "Redis rate limiting is disabled; using in-memory fallback",
    );
  });
}

startServer();
