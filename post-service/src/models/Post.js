import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    mediaUrl: [
      {
        type: String,
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  },
);

postSchema.index({content: "text"});

const Post = mongoose.model("Post", postSchema);

export default Post;
