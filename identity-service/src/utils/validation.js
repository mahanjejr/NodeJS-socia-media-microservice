const joi = require("joi");

const validateRegistration = (data) => {
  const schema = joi.object({
    username: joi.string().min(3).max(50).required(),
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
  });

  // validate the data that passed down to validateRegistration.
  return schema.validate(data, {
    abortEarly: false, // return all errors
    stripUnknown: true, // remove extra fields
  });
};

const validateLogin = (data) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).required(),
  });

  // validate the data that passed down to validateRegistration.
  return schema.validate(data, {
    abortEarly: false, // return all errors
    stripUnknown: true, // remove extra fields
  });
};

module.exports = { validateRegistration, validateLogin };
