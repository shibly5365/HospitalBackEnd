import Joi from "joi";

export const SignUpValidation = (req, res, next) => {
  const schema = Joi.object({
    fullName: Joi.string().min(3).max(16).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(7).max(13).required(),
    contact: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required(),
    gender: Joi.string().valid("Male", "Female", "Other").required(),
    age: Joi.number().min(0).max(120).required(),
    patientType: Joi.string()
      .valid("New Patient", "Returning Patient", "Other")
      .required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: "Bad Requesr", error });
  }
  next();
};

export const LoginValidation = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(7).max(13).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: "Bad Requesr", error });
  }
  next();
};
