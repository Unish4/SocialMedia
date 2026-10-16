import joi from "joi";

export const validateCreatePost = (data) => {
  const schema = joi.object({
    content: joi
      .string()
      .max(500)
      .required()
      .messages({ "string.max": "Content must be at most 500 characters" }),
    mediaUrl: joi.array().items(joi.string().uri()).optional(),
  });
  return schema.validate(data);
};

export const validateUpdatePost = (data) => {
  const schema = joi.object({
    content: joi
      .string()
      .max(500)
      .optional()
      .messages({ "string.max": "Content must be at most 500 characters" }),
    mediaUrl: joi.array().items(joi.string().uri()).optional(),
  });
  return schema.validate(data);
};
