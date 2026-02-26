const logger = require("../utils/logger");
const Post = require("../models/Post");
const { validateCreatePost } = require("../utils/validation");
const { publishEvent } = require("../utils/rabbitmq");

async function invalidatePostCache(req, input) {
  const cachedKey = `post:${input}`;
  await req.redisClient.del(cachedKey);

  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

const createPost = async (req, res) => {
  logger.info("Create post endpoint hit");
  try {
    // vaidate the schema
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newlyCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });

    await newlyCreatedPost.save();

    // we publish event to be consumed in seach service
    await publishEvent("post.created", {
      postId: newlyCreatedPost._id.toString(),
      userId: newlyCreatedPost.user.toString(),
      content: newlyCreatedPost.content,
      createdAt: newlyCreatedPost.createdAt,
    });

    invalidatePostCache(req, newlyCreatedPost._id.toString());
    logger.info("Post created successfully", newlyCreatedPost);
    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (e) {
    logger.error("Error creating post", e);
    return res.status(500).json({
      success: false,
      message: "Error creating post",
    });
  }
};

const getAllPosts = async (req, res) => {
  try {
    // pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    // config Redis cache
    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalNoOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };

    // Save posts in redis cache (set + expire for 5 mins)
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));
    
    // return res
    return res.json(result);
  } catch (e) {
    logger.error("Error fetching posts", e);
    return res.status(500).json({
      success: false,
      message: "Error fetching posts",
    });
  }
};

const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);

    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostbyId = await Post.findById(postId);
    if (!singlePostbyId) {
      logger.warn("Post not found");
      return res.status(404).json({
        success: false,
        message: "Post not Found!",
      });
    }

    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(singlePostbyId));

    res.json(singlePostbyId);
  } catch (e) {
    logger.error("Error fetching single post", e);
    return res.status(500).json({
      success: false,
      message: "Error fetching single post by ID",
    });
  }
};

const deletePost = async (req, res) => {
  try {
    // only logged-in user can delete the post
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // publish post delete method
    await publishEvent("post.deleted", {
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    });

    // ivalidate the cache
    await invalidatePostCache(req, req.params.id).catch((err) =>
      logger.error("Cache invalidation failed", err),
    );

    // response for deletion
    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (e) {
    logger.error("Error deleting post", e);
    return res.status(500).json({
      success: false,
      message: "Error deleting post",
    });
  }
};

module.exports = { createPost, getAllPosts, getPost, deletePost };
