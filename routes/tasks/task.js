const router = require("express").Router();

const commentRoute = require("./comments");

const Task = require("../../models/Tasks/Task");
const Server = require("../../models/Servers/server");

router.use("/:taskId/comments", commentRoute);

async function getTasks(user) {
  try {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    startOfNextMonth.setHours(0, 0, 0, 0);

    const servers = await Server.find({
      "members.user": user.id,
    });

    const thisMonthTasks = await Task.find({
      deadline: { $gte: startOfMonth, $lte: endOfMonth },
      deleted: false,
      server: { $in: servers.map((server) => server._id) },
    })
      .populate("assignedMembers")
      .populate({
        path: "comments",
        populate: { path: "author" },
      })
      .populate("server");

    const upcomingTasks = await Task.find({
      deadline: { $gte: startOfNextMonth },
      deleted: false,
      server: { $in: servers.map((server) => server._id) },
    })
      .populate("assignedMembers")
      .populate({
        path: "comments",
        populate: { path: "author" },
      })
      .populate("server");

    return { thisMonthTasks, upcomingTasks };
  } catch (error) {
    console.log("Error: ", error);
  }
}

router.get("/fetch-tasks", async (req, res) => {
  const user = req.user;
  let { thisMonthTasks, upcomingTasks } = await getTasks(user);
  res.json({
    success: true,
    message: "Tasks Fetched Successfully",
    thisMonthTasks,
    upcomingTasks,
  });
});

router.get("/:serverId/fetch-tasks", async (req, res) => {
  try {
    let tasks = await Task.find({
      server: req.params.serverId,
      deleted: false,
    })
      .populate("assignedMembers")
      .populate({
        path: "comments",
        populate: {
          path: "author",
        },
      })
      .populate("server");
    if (!tasks) {
      return res.status(404).json({
        success: false,
        message: "Invalid Server ID",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Tasks Fetched Successfully",
      tasks,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Fetch Tasks",
    });
  }
});

router.post("/create-task", async (req, res) => {
  try {
    console.log(req.body);
    await Task.create({
      title: req.body.title,
      description: req.body.description || "",
      priority: req.body.priority,
      server: req.body.server,
      deadline: req.body.deadline,
      milestones: req.body.milestones,
      assignedMembers: req.body.assignedMembers || [],
      createdBy: req.user.id,
    });
    return res.status(200).json({
      success: true,
      message: "Task Created Successfully",
    });
  } catch (error) {
    console.log("Error: ", error);
    return res.status(500).json({
      success: false,
      message: "Failed to Create Task",
    });
  }
});

router.post("/delete-task/:id", async (req, res) => {
  let id = req.params.id;
  try {
    let task = await Task.findById(id);
    if (!task) {
      return res.json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    if (task.createdBy == req.user.id) {
      task.deleted = true;
      await task.save();
      return res.json({
        success: true,
        message: "Task Deleted Successfully",
      });
    } else {
      return res.json({
        success: false,
        message: "Unauthorized User",
      });
    }
  } catch (error) {
    console.log("Error: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/update-task/:id", async (req, res) => {
  let id = req.params.id;
  try {
    let task = await Task.findById(id);
    if (!task) {
      return res.json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    if (task.createdBy == req.user.id) {
      Object.assign(task, req.body);
      await task.save();
      return res.json({
        success: true,
        message: "Task Updated Successfully",
      });
    } else {
      return res.json({
        success: false,
        message: "Unauthorized User",
      });
    }
  } catch (error) {
    console.log("Error: ", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/update-task-progress/:id", async (req, res) => {
  let id = req.params.id;
  let status = "";
  let started = false;
  let allCompleted = true;
  try {
    let task = await Task.findById(id);
    if (!task) {
      return res.json({
        success: false,
        message: "Invalid Task ID",
      });
    }

    req.body.forEach((milestone) => {
      if (milestone.completed) {
        started = true;
      } else {
        allCompleted = false;
      }
    });

    if (allCompleted || (task.milestones.length === 1 && started)) {
      status = "Completed";
    } else if (started) {
      status = "In Progress";
    } else {
      status = "Pending";
    }
    task.milestones = req.body;
    task.status = status;
    await task.save();
    return res.json({
      success: true,
      message: "Task Updated Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// Members

router.post("/:taskID/add-member", async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskID);
    if (!task) {
      return res.json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    if (task.createdBy == req.user.id) {
      task.assignedMembers.push(req.body.member);
      await task.save();
      return res.json({
        success: true,
        message: "Member Added Successfully",
      });
    } else {
      return res.json({
        success: false,
        message: "Unauthorized User",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Add Member",
    });
  }
});

router.delete("/:taskID/members/:memberID", async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskID);
    if (!task) {
      return res.json({
        success: false,
        message: "Invalid Task ID",
      });
    }
    if (task.createdBy == req.user.id) {
      task.assignedMembers.pull(req.params.memberID);
      await task.save();
      return res.json({
        success: true,
        message: "Member Removed Successfully",
      });
    } else {
      return res.json({
        success: false,
        message: "Unauthorized User",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Remove Member",
    });
  }
});

module.exports = router;
