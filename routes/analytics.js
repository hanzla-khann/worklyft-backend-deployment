const router = require("express").Router();
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    priority: String,
    server: mongoose.Schema.Types.ObjectId,
    status: String,
    deadline: Date,
    milestones: [Object],
    comments: [Object],
    assignedMembers: [mongoose.Schema.Types.ObjectId],
    createdBy: mongoose.Schema.Types.ObjectId,
    deleted: Boolean,
  },
  { timestamps: true }
);

const Task = mongoose.model("Task");

router.get("/task-analytics", async (req, res) => {
  try {
    const userId = req.user.id;
    
    const tasks = await Task.find({ 
      createdBy: userId,
      deleted: false
    });
    
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const taskCompletionTrends = daysOfWeek.map(day => ({
      date: day,
      completed: 0
    }));
    
    let onTimeCount = 0;
    let completedLateCount = 0;
    let stillOverdueCount = 0;
    
    const heatmapData = [];
    
    let totalTasks = tasks.length;
    let completedTasks = 0;
    let overdueTasks = 0;
    
    const now = new Date();
    
    tasks.forEach(task => {
      const createdDate = new Date(task.createdAt);
      const deadline = task.deadline ? new Date(task.deadline) : null;
      const isCompleted = task.status === "Completed";
      
      if (isCompleted) {
        completedTasks++;
        
        const completedDay = createdDate.getDay(); 
        taskCompletionTrends[completedDay].completed += 1;
        
        const dateStr = createdDate.toISOString().split('T')[0];
        const existingEntry = heatmapData.find(item => item.date === dateStr);
        if (existingEntry) {
          existingEntry.count += 1;
        } else {
          heatmapData.push({ date: dateStr, count: 1 });
        }
        
        if (deadline && createdDate > deadline) {
          completedLateCount++;
        } else {
          onTimeCount++;
        }
      } else if (deadline && deadline < now) {
        stillOverdueCount++;
        overdueTasks++;
      }
    });
    
    const totalForPercentage = onTimeCount + completedLateCount + stillOverdueCount || 1; // Avoid division by zero
    const overdueData = [
      { name: "On Time", value: Math.round((onTimeCount / totalForPercentage) * 100), color: "#4CAF50" },
      { name: "Completed Late", value: Math.round((completedLateCount / totalForPercentage) * 100), color: "#FF9800" },
      { name: "Still Overdue", value: Math.round((stillOverdueCount / totalForPercentage) * 100), color: "#F44336" }
    ];
    
    const summaryData = [
      { title: "Total Tasks", value: totalTasks, color: "#417CAE" },
      { title: "Completed", value: completedTasks, color: "#4CAF50" },
      { title: "Overdue", value: overdueTasks, color: "#F44336" }
    ];
    
    res.status(200).json({
      success: true,
      data: {
        taskCompletionTrends,
        overdueData,
        heatmapData,
        summaryData
      }
    });
    
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics data",
      error: error.message
    });
  }
});

function calculateBadges(completedTasks) {
  const badges = [];
  
  if (completedTasks >= 10) {
    badges.push({ name: "Task Master", icon: "🏆" });
  }
  if (completedTasks >= 5) {
    badges.push({ name: "Productivity Pro", icon: "⚡" });
  }
  if (completedTasks >= 3) {
    badges.push({ name: "Go-Getter", icon: "🚀" });
  }
  if (completedTasks >= 1) {
    badges.push({ name: "Early Bird", icon: "🐦" });
  }
  
  return badges;
}

router.get("/leaderboard/:serverId", async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.user.id;
    
    const Server = mongoose.model("Server");
    const server = await Server.findById(serverId).populate("members.user");
    
    if (!server) {
      return res.status(404).json({ success: false, message: "Server not found" });
    }
    
    const memberIds = server.members.map(member => 
      member.user._id ? member.user._id.toString() : member.user.toString()
    );
    
    const memberStats = await Promise.all(memberIds.map(async (memberId) => {
      const completedTasks = await Task.countDocuments({
        createdBy: memberId,
        server: serverId,
        status: "Completed",
        deleted: false
      });
      
      const memberData = server.members.find(m => {
        const userIdString = m.user._id ? m.user._id.toString() : m.user.toString();
        return userIdString === memberId;
      });
      
      const userInfo = memberData?.user;
      
      return {
        userId: memberId,
        username: userInfo?.username || "Unknown User",
        profileImg: userInfo?.profileImg || null,
        completedTasks,
        rank: 0, 
        badges: calculateBadges(completedTasks)
      };
    }));
    
    memberStats.sort((a, b) => b.completedTasks - a.completedTasks);
    
    memberStats.forEach((member, index) => {
      member.rank = index + 1;
    });
    
    const userStats = memberStats.find(member => member.userId === userId) || {
      rank: "N/A",
      totalMembers: memberStats.length,
      badges: []
    };
    
    return res.status(200).json({
      success: true,
      leaderboard: memberStats,
      userRank: {
        rank: userStats.rank,
        totalMembers: memberStats.length,
        badges: userStats.badges,
        userId
      }
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching leaderboard data",
      error: error.message
    });
  }
});

module.exports = router;
