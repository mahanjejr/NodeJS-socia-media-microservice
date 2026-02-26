const { invalidateSearchCache } = require("../controllers/search-controller");
const Search = require("../model/Search");
const logger = require("../utils/logger");

async function handlerPostCreated(event) {
  try {
    const newSearchPost = new Search({
      postId: event.postId,
      userId: event.userId,
      content: event.content,
      createdAt: event.createdAt,
    });

    // save to search collection
    await newSearchPost.save();

    // invalidate the cache
    await invalidateSearchCache(req, newSearchPost._id.toString())
    
    logger.info(
      `Search post created: ${event.postId}, ${newSearchPost._id.toString()}`,
    );
  } catch (error) {
    logger.error(e, "Error handling post creation event");
  }
}

async function handlerPostDeleted(event) {
  try {
    await Search.findByIdAndDelete({ postId: event.postId });
    logger.info(`Search post deleted: ${event.postId}`);
  } catch (error) {
    logger.error(e, "Error handling post deletion event");
  }
}

module.exports = { handlerPostCreated, handlerPostDeleted };
