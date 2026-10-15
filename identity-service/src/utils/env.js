import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

// JWT_SECRET must be explicitly configured in every environment.
//
// The identity service issues access tokens (60-minute lifetime) and stores
// opaque refresh tokens in MongoDB (7-day lifetime). Both operations use
// JWT_SECRET to sign/verify access tokens via ENV.JWT_SECRET:
//   - generateToken()   signs the access token on login/register/refresh
//   - authMiddleware    verifies the access token on every protected route
//
// A randomly generated secret (the previous fallback) creates two silent bugs:
//   1. Restart invalidity — a new random secret is generated on each process
//      start, invalidating all previously issued access tokens immediately.
//   2. Multi-instance rejection — if multiple gateway/identity-service
//      instances run concurrently (e.g. Docker, pm2 cluster), each generates
//      its own random secret. Instance B rejects tokens signed by instance A.
//
// These problems are not limited to production; they affect any environment
// where tokens must survive a restart or span more than one process. Require a
// configured JWT_SECRET in all environments and fail fast at startup if it is
// missing, so the misconfiguration is caught before any request is served.
if (!process.env.JWT_SECRET) {
  throw new Error(
    `Missing required environment variable: JWT_SECRET (NODE_ENV=${nodeEnv}). ` +
      "Set JWT_SECRET to a stable, high-entropy secret in your .env file or " +
      "environment configuration for every deployment.",
  );
}

const jwtSecret = process.env.JWT_SECRET;

export const ENV = {
  MONGODB_URI: process.env.MONGODB_URI,
  PORT: process.env.PORT,
  JWT_SECRET: jwtSecret,
  NODE_ENV: nodeEnv,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  REDIS_URL: process.env.REDIS_URL,
};
