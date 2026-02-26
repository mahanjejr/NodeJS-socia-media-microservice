const Search = require("../model/Search");
const logger = require("../utils/logger");

async function invalidateSearchCache(req, input) {
  const cacheKey = `search:${input}`;
  await req.redisClient.del(cacheKey);

  const keys = await req.redisClient.keys("search:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

const searchPost = async (req, res) => {
  logger.info("Search endpoint hit!");
  try {
    const { query } = req.query;

    // config redis cache
    const cacheKey = `search:posts:${query}`;
    const cachedSearch = await req.redisClient.get(cacheKey);

    // check if result exist in redis cache
    if (cachedSearch) {
      return res.json(JSON.parse(cachedSearch));
    }

    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);

    // save result to redis cache
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(results))

    return res.json(results);
  } catch (e) {
    logger.error("Error while searching post", e);
    return res.status(500).json({
      success: false,
      message: "Error while searching post",
    });
  }
};

module.exports = { searchPost, invalidateSearchCache };
