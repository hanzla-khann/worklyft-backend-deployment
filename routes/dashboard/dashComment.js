const express = require('express');
const mongoose = require('mongoose');
const DashComment = require("../../models/Dashboard/DashComment");

const router = express.Router();

// Safe way to get userId
const getUserId = (req) => {
    if (req.user && req.user.id) {
        return req.user.id;
    } else if (req.cookies && req.cookies.userId) {
        return req.cookies.userId;
    } else {
        return null; // Important: return null, not throw error
    }
};

// 1. Get all comments for a specific user
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const comments = await DashComment.find({ userId }).sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        console.error("Error fetching comments:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. Create a new comment
router.post('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { title, description, tag } = req.body;
        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const comment = new DashComment({
            userId,
            title,
            description,
            tag: tag || 'Urgent',
        });

        const newComment = await comment.save();
        res.status(201).json(newComment);
    } catch (err) {
        console.error("Error creating comment:", err);
        res.status(400).json({ message: 'Error creating comment' });
    }
});

// 3. Update a comment
router.put('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const { title, description, tag } = req.body;
        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const comment = await DashComment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: Not your comment' });
        }

        comment.title = title;
        comment.description = description;
        comment.tag = tag;

        const updatedComment = await comment.save();
        res.json(updatedComment);
    } catch (err) {
        console.error("Error updating comment:", err);
        res.status(400).json({ message: 'Error updating comment' });
    }
});

// 4. Delete a comment
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID' });
        }

        const comment = await DashComment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        if (comment.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized: Not your comment' });
        }

        await comment.deleteOne();
        res.json({ message: 'Comment deleted' });
    } catch (err) {
        console.error("Error deleting comment:", err);
        res.status(500).json({ message: 'Error deleting comment' });
    }
});

// Error handler
router.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: 'Internal server error' });
});

module.exports = router;


