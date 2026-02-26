const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      username: user.username,
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "60m" } //keep 10m | 15m
  );

  // This generate strong refresh token
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date();
  //refresh token expires in 7 days
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

module.exports = generateTokens;
