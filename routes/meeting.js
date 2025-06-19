const router = require("express").Router();
const jwt = require("jsonwebtoken");
const axios = require("axios");

function generateManagementToken() {
  const payload = {
    access_key: process.env.APP_ACCESS_KEY_HMS,
    type: "management",
    version: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    jti: Math.random().toString(36).substring(2),
  };

  return jwt.sign(payload, process.env.APP_SECRET_KEY_HMS, {
    algorithm: "HS256",
  });
}

router.post("/create-room", async (req, res) => {
  const { name, description } = req.body;
  const token = generateManagementToken();

  if (!name || !description) {
    return res
      .status(400)
      .json({ message: "Room name and description are required." });
  }
  try {
    const roomRes = await axios.post(
      "https://api.100ms.live/v2/rooms",
      {
        name: `${name}-${Date.now()}`,
        description,
        template_id: process.env.TEMPLATE_ID_HMS,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const roomId = roomRes.data.id;

    const codeRes = await axios.post(
      "https://api.100ms.live/v2/room-codes/room/" + roomId,
      {
        role: "host",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const hostRoomCode = codeRes.data.data.find(
      (obj) => obj.role === "host"
    )?.code;
    const guestRoomCode = codeRes.data.data.find(
      (obj) => obj.role === "guest"
    )?.code;

    res.json({
      message: "Room created successfully",
      success: true,
      hostRoomCode,
      guestRoomCode,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Room creation failed" });
  }
});

module.exports = router;
