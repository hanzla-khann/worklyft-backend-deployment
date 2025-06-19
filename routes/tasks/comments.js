const router = require("express").Router({ mergeParams: true });

const Comment = require("../../models/Tasks/Comment");
const Task = require("../../models/Tasks/Task");

router.post("/add-comment", async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    let comment = await Comment.create({
      text: req.body.text,
      author: req.user.id,
    });
    task.comments.push(comment._id);
    comment = await comment.populate("author");
    console.log(comment);
    await task.save();
    return res.status(201).json({
      success: true,
      message: "Comment Added Successfully",
      data: comment,
    });
  } catch (error) {
    console.log("Error: ", error);
    return res.status(400).json({
      success: false,
      message: "Could not Create Comment",
    });
  }
});

router.put("/:commentId", async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    let comment = await Comment.findById(req.params.commentId).populate(
      "author"
    );
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Invalid Comment ID",
      });
    }
    if (comment.author._id == req.user.id) {
      comment.edited = true;
      comment.text = req.body.comment.text;
      await comment.save();
    } else {
      return res.status(401).json({
        success: false,
        message: "Unauthorized User",
      });
    }
    return res.status(201).json({
      success: true,
      message: "Comment Edited Successfully",
      comment,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      message: "Failed to Edit Comment",
    });
  }
});

router.post("/delete-comment/:commentId", async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    let comment = await Comment.findById(req.params.commentId).populate(
      "author"
    );
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Invalid Comment ID",
      });
    }
    if (comment.author._id == req.user.id) {
      comment.deleted = true;
      await comment.save();
    } else {
      return res.status(401).json({
        success: false,
        message: "Unauthorized User",
      });
    }
    return res.status(201).json({
      success: true,
      message: "Comment Deleted Successfully",
      comment,
    });
  } catch (error) {
    console.log("Error: ", error);
    return res.status(400).json({
      success: false,
      message: "Could not Delete Comment",
    });
  }
});

module.exports = router;
