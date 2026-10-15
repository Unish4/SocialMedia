import Joi from "joi";

export const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string().trim().min(3).max(30).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(30).required(),
  });

  return schema.validate(data);
};
