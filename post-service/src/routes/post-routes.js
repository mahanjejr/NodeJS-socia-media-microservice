const express = require("express");
const { createPost, getAllPosts, getPost, deletePost } = require("../controllers/post-controller");
const { authenticateRequest } = require("../middleware/authMiddleware");

const router = express.Router();

// middleware => show user is auth or not
router.use(authenticateRequest); // for every routes

router.post("/create-post", createPost);
router.get("/all-posts", getAllPosts);
router.get("/:id", getPost);
router.delete("/:id", deletePost);

module.exports = router;
