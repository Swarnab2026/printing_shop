const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Stock Item Schema
const stockSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Stock = mongoose.model('Stock', stockSchema);

// Admin Schema (for authentication)
const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

const Admin = mongoose.model('Admin', adminSchema);

// JWT Secret (should be in .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        req.adminId = decoded.id;
        next();
    });
};

// ============= PUBLIC ROUTES =============

// Get all stock items (public route for customers)
app.get('/api/stock', async (req, res) => {
    try {
        const items = await Stock.find().sort({ name: 1 });
        res.json({ success: true, items });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching stock', error: error.message });
    }
});

// ============= ADMIN ROUTES =============

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find admin
        const admin = await Admin.findOne({ username });

        if (!admin || admin.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: admin._id }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ success: true, token, message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login error', error: error.message });
    }
});

// Create admin (run this once to create admin account)
app.post('/api/admin/create', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin already exists' });
        }

        const admin = new Admin({ username, password });
        await admin.save();

        res.json({ success: true, message: 'Admin created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating admin', error: error.message });
    }
});

// Add new stock item (protected)
app.post('/api/stock', verifyToken, async (req, res) => {
    try {
        const { name, quantity } = req.body;

        // Check if item already exists
        const existingItem = await Stock.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingItem) {
            return res.status(400).json({ success: false, message: 'Item already exists' });
        }

        const newItem = new Stock({
            name,
            quantity,
            updatedAt: new Date()
        });

        await newItem.save();
        res.json({ success: true, message: 'Item added successfully', item: newItem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error adding item', error: error.message });
    }
});

// Update stock item (protected)
app.put('/api/stock/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        const item = await Stock.findByIdAndUpdate(
            id,
            { quantity, updatedAt: new Date() },
            { new: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, message: 'Item updated successfully', item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating item', error: error.message });
    }
});

// Delete stock item (protected)
app.delete('/api/stock/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Stock.findByIdAndDelete(id);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting item', error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('');
    console.log('To create an admin account, send a POST request to:');
    console.log(`http://localhost:${PORT}/api/admin/create`);
    console.log('with body: { "username": "admin", "password": "yourpassword" }');
});
