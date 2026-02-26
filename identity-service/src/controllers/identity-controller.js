const logger = require("../utils/logger");
const { validateRegistration, validateLogin } = require("../utils/validation");
const User = require("../models/User");
const generateTokens = require("../utils/generateToken");
const RefreshToken = require("../models/RefreshToken");

// user registration
const registerUser = async (req, res) => {
  logger.info("Registration endpoint hit..");
  try {
    // vaidate the schema
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password, username } = req.body;

    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      logger.warn("User already exists");
      return res.status(400).json({
        success: false,
        message: "User already exists!",
      });
    }
    // create the user
    user = new User({ username, email, password });
    await user.save();
    logger.warn("User saved successfully", user._id);

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      accessToken,
      refreshToken,
    });
  } catch (e) {
    logger.error("Registration error occured!", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// User login
const loginUser = async (req, res) => {
  logger.info("login endpoint hit...");
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      logger.warn("Invalid user");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // if user present, user valid password or not
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn("Invalid password");
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    // generate the token
    const { accessToken, refreshToken } = await generateTokens(user);

    res.json({
      accessToken,
      refreshToken,
      userId: user._id,
    });
  } catch (e) {
    logger.error("Login error occured!", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// refresh token
const refreshTokenUser = async (req, res) => {
  logger.info("Refresh token endpoint hit...");
  try {
    // get the refresh token from body
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // get stored token from db
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token");

      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // we find a user
    const user = await User.findById(storedToken.user);
    if (!user) {
      logger.warn("User not found!");
      return res.status(401).json({
        success: false,
        message: "User not found!",
      });
    }

    // now generate new token
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);

    // delete the old refresh token
    await RefreshToken.deleteOne({ _id: storedToken._id });
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (e) {
    logger.error("Refresh token error occured", e);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// logout
const logoutUser = async (req, res) => {
  logger.info("Logout endpoint hit...");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    // gonna delete the refresh token
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info("Refresh token deleted for logout");

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (e) {
    logger.warn("Error while logging out", e);
    res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

module.exports = { registerUser, loginUser, refreshTokenUser, logoutUser };
