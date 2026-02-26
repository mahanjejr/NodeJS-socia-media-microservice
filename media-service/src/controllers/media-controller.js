const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");
const Media = require("../models/Media");

const uploadMedia = async (req, res) => {
  logger.info("Starting media upload");
  try {
    if (!req.file) {
      logger.error("No file found! Please try again");
      return res.status(404).json({
        success: false,
        message: "No file found! Please try again",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;

    logger.info(`File details: name=${originalname}, type=${mimetype}`);
    logger.info("Uploading to cloudinary starting...");

    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successfully. Public Id - ${cloudinaryUploadResult.publicId}`,
    );

    const newlyCreatedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    });

    await newlyCreatedMedia.save();

    res.status(201).json({
      success: true,
      mediaId: newlyCreatedMedia._id,
      url: newlyCreatedMedia.url,
      message: "Media uploaded successfully",
    });
  } catch (e) {
    logger.error("Error while uploading media", e);
    return res.status(500).json({
      success: false,
      message: "Error while uploading media",
    });
  }
};

// optional
const getAllMedia = async (req, res) => {
  try {
    const result = await Media.find({});
    res.json({ result });
  } catch (error) {
    logger.error("Error while fetching all media", e);
    return res.status(500).json({
      success: false,
      message: "Error while fetching all media",
    });
  }
};

module.exports = { uploadMedia, getAllMedia };
 