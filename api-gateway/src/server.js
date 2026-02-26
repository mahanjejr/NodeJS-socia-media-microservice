require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("../../identity-service/src/utils/logger");
const proxy = require("express-http-proxy");
const errorHandler = require("./middleware/errorHandler");
const { validateToken } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

// middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// install express-rate-limiting, rate-limit-redis

// rate limiting
const rateLimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000, // 15min (60000=1min)
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

// let we use our rate limiter here
app.use(rateLimitOptions);

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}, ${req.body}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

// create the proxy for api gateway
const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    if (Buffer.isBuffer(err)) {
      const decoded = err.toString("utf-8");
      logger.error("Proxy buffer error", decoded);

      return res.status(502).json({
        success: false,
        message: "Proxy error",
        error: decoded,
      });
    }

    logger.error("Proxy error:", err);

    res.status(502).json({
      success: false,
      message: "Proxy error",
      error: err?.message || err?.code || "Unknown error",
    });
  },
};

// setup proxy for our identity service
app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      // // you can update the headers

      if (srcReq.body && Object.keys(srcReq.body).length) {
        const bodyData = JSON.stringify(srcReq.body);

        proxyReqOpts.headers["Content-Type"] = "application/json";
        // proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
        proxyReqOpts.headers["Content-Length"] = Buffer.byteLength(bodyData);

        proxyReqOpts.body = bodyData;
      }

      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Identity service: ${proxyRes.statusCode}`
      );

      return proxyResData;
    },
  })
);

// Setting up proxy for our post service
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      if (srcReq.body && Object.keys(srcReq.body).length) {
        const bodyData = JSON.stringify(srcReq.body);

        proxyReqOpts.headers["Content-Type"] = "application/json";
        proxyReqOpts.headers["Content-Length"] = Buffer.byteLength(bodyData);

        proxyReqOpts.body = bodyData;
      }

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`
      );

      return proxyResData;
    },
  })
);

// Setting up proxy for our media service
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      if (!srcReq.headers["content-type"].startsWith("multipart/form-data")) {
        proxyReqOpts.headers["Content-Type"] = "application/json";
      }
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from media service: ${proxyRes.statusCode}`
      );
      return proxyResData;
    },
    parseReqBody: false,
  })
);

// Setting up proxy for our search service
app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      if (srcReq.body && Object.keys(srcReq.body).length) {
        const bodyData = JSON.stringify(srcReq.body);

        proxyReqOpts.headers["Content-Type"] = "application/json";
        proxyReqOpts.headers["Content-Length"] = Buffer.byteLength(bodyData);

        proxyReqOpts.body = bodyData;
      }

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Search service: ${proxyRes.statusCode}`
      );

      return proxyResData;
    },
  })
);

// error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway is running on port: ${PORT}`);
  logger.info(
    `Identity service is running on port: ${process.env.IDENTITY_SERVICE_URL}`
  );
  logger.info(
    `Post service is running on port: ${process.env.POST_SERVICE_URL}`
  );
   logger.info(
    `Media service is running on port: ${process.env.MEDIA_SERVICE_URL}`
  );
   logger.info(
    `Search service is running on port: ${process.env.SEARCH_SERVICE_URL}`
  );
  logger.info(`Redis url: ${process.env.REDIS_URL}`);
});
