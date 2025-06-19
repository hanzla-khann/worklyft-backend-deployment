

//this code works for hardcoded author 123
const express = require("express");
const { createWriting, getWritings, updateWriting, deleteWriting, shareWriting } = require("../../controllers/writingController");

const router = express.Router();

router.post("/", createWriting);
router.get("/", getWritings);
router.put("/:id", updateWriting);
router.delete("/:id", deleteWriting);
router.post("/share/:id", shareWriting);

module.exports = router;
