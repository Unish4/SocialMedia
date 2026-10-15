import mongoose from "mongoose";

const refreshToken = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, "token is required"],
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

refreshToken.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("RefreshToken", refreshToken);
export default RefreshToken;
