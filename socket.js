const io = require("socket.io")(8900, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://worklyft-alpha.vercel.app"
    ],
    methods: ["GET", "POST"], 
    credentials: true,        
  },
});


var voiceChannelUsers = {};

var socketUsers = {};

io.on("connection", (socket) => {
  socket.on("userOnline", (userId) => {
    socketUsers[userId] = socket.id;
  });

  // Listen for 'sendMessage' event to send messages to the receiver
  socket.on("sendMessage", ({ senderId, receiverId, text }) => {
    const user = getUser(receiverId);
    console.log("User", user);
    if (user) {
      io.to(user.socketId).emit("getMessage", {
        senderId,
        text,
      });
    }
  });

  socket.on("joinChannel", (channelID) => {
    socket.join(channelID);
  });

  // ----Voice Channels----
  socket.on("joinVoiceChannel", ({ channelID, user }) => {
    if (!voiceChannelUsers[channelID]) {
      voiceChannelUsers[channelID] = [];
    }
    if (!voiceChannelUsers[channelID].some((u) => u.userId === user._id)) {
      voiceChannelUsers[channelID].push({
        userId: user._id,
        username: user.username,
      });
    }
    socket.join(channelID);
    socket.broadcast.emit("user-joined", { channelID, user });
  });

  socket.on("leaveVoiceChannel", ({ channelID, user }) => {
    if (voiceChannelUsers[channelID]) {
      voiceChannelUsers[channelID] = voiceChannelUsers[channelID].filter(
        (u) => u.userId !== user._id
      );

      if (voiceChannelUsers[channelID].length === 0) {
        delete voiceChannelUsers[channelID];
      }
    }
    socket.leave(channelID);
    socket.broadcast.emit("user-left", { channelID, user });
  });

  socket.on("updateUserMuteStatus", (channelID, userID, isMuted, isDeafen) => {
    if (voiceChannelUsers[channelID]) {
      const user = voiceChannelUsers[channelID].find(
        (u) => u.userId === userID
      );
      if (user) {
        user.isMuted = isMuted;
        user.isDeafen = isDeafen;
        console.log(user);
      }
    }
    io.emit("updateJoinedUsers", voiceChannelUsers);
  });

  // DM - Conversations

  socket.on("newConversation", ({ receiver, conversation }) => {
    socket.broadcast.emit("newConversationCreated", { receiver, conversation });
  });

  socket.on("updateConversationLastMessage", ({ conversation, message }) => {
    const receiver = conversation.members.find(
      (member) => member._id !== message.senderID._id
    );
    const receiverSocketId = socketUsers[receiver._id];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateConversation", {
        conversation,
        message,
      });
    }
    const senderSocketId = socketUsers[message.senderID._id];
    if (senderSocketId) {
      io.to(senderSocketId).emit("updateConversation", {
        conversation,
        message,
      });
    }
  });

  socket.on("message", (data) => {
    socket.broadcast.emit("message", data);
  });

  // ----Text-Channels----
  socket.on("message:channel", (data) => {
    const { channelID, message } = data;
    socket.to(channelID).emit("newMessage:channel", { message });
  });

  socket.on("deleteMessage", ({ channelID, message }) => {
    io.to(channelID).emit("messageDeleted", { message });
  });

  socket.on("editMessage", ({ channelID, message }) => {
    io.to(channelID).emit("messageEdited", { message });
  });

  socket.on("updateChannel", ({ channel, server }) => {
    console.log(channel, server);
    io.emit("channelUpdated", { channel, server });
  });

  // Members
  socket.on("removeMember", ({ server, user }) => {
    io.emit("memberRemoved", { server, userToRemove: user });
  });

  // ----Tasks / Comments----
  // Tasks
  socket.on("createTask", () => {
    io.emit("taskCreated");
  });

  socket.on("editTask", ({ taskToEdit, data }) => {
    io.emit("taskEdited", { taskToEdit, data });
  });

  socket.on("deleteTask", () => {
    io.emit("taskDeleted");
  });

  socket.on("addMember", ({ member, task }) => {
    io.emit("memberAdded", { member, taskToEdit: task });
  });

  socket.on("removeMember", ({ member, task }) => {
    io.emit("memberRemoved", { member, taskToEdit: task });
  });

  // Comments
  socket.on("addComment", ({ taskId, comment }) => {
    io.emit("commentAdded", { taskId, comment });
  });

  socket.on("deleteComment", ({ taskId, comment }) => {
    io.emit("commentDeleted", {
      taskId,
      deletedComment: comment,
    });
  });

  socket.on("editComment", ({ taskId, comment }) => {
    io.emit("commentEdited", {
      taskId,
      editedComment: comment,
    });
  });

  socket.on("disconnect", () => {});

  process.on("uncaughtException", (err) => {
    console.error("Uncaught:", err);
  });
});

module.exports = { voiceChannelUsers };
