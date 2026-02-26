const joi = require("joi");

const validateCreatePost = (data) => {
  const schema = joi.object({
    content: joi.string().min(3).max(5000).required(),
    mediaIds: joi.array(),
  });

  // validate the data that passed down to validatePost.
  return schema.validate(data);
};

module.exports = { validateCreatePost };
