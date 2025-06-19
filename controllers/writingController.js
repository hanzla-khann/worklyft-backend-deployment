


// this code works for hardcoded author 123
const Writing = require("../models/Writing/Writing");
const { v4: uuidv4 } = require("uuid");

// Create new writing
const createWriting = async (req, res) => {
  try {
    const { title, content, author, template } = req.body;
    const newWriting = new Writing({ title, content, author, template });
    await newWriting.save();
    res.status(201).json(newWriting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all writings
const getWritings = async (req, res) => {
  try {
    const writings = await Writing.find();
    res.status(200).json(writings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update writing
const updateWriting = async (req, res) => {
  try {
    const { title, content } = req.body;
    const updatedWriting = await Writing.findByIdAndUpdate(
      req.params.id,
      { title, content },
      { new: true }
    );
    res.status(200).json(updatedWriting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete writing
const deleteWriting = async (req, res) => {
  try {
    await Writing.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Writing deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Share writing
const shareWriting = async (req, res) => {
  try {
    const writing = await Writing.findById(req.params.id);
    if (!writing) return res.status(404).json({ message: "Writing not found" });

    writing.shared = true;
    writing.sharedLink = `http://localhost:5173/shared/${uuidv4()}`;

    await writing.save();

    res.status(200).json({ sharedLink: writing.sharedLink });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createWriting,
  getWritings,
  updateWriting,
  deleteWriting,
  shareWriting,
};
