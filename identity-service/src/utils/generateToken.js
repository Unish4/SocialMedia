import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";

const generateToken = async (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      username: user.username,
    },
    ENV.JWT_SECRET,
    {
      expiresIn: "60m",
    },
  );

  const refreshToken = crypto.randomBytes(40).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

export default generateToken;
