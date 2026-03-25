const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large JSON payloads for base64 images
app.use(express.static(__dirname)); // Serve static html/js/css files

// API Route: Get portfolio data
app.get('/api/data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            // Ignore if file doesn't exist, just return empty template
            if (err.code === 'ENOENT') {
                return res.json({ site_settings: {}, gallery: [], memos: [] });
            }
            return res.status(500).json({ error: 'Failed to read data' });
        }
        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData);
        } catch (parseErr) {
             console.error('Error parsing data.json:', parseErr);
             res.status(500).json({ error: 'Failed to parse data' });
        }
    });
});

// API Route: Save portfolio data
app.post('/api/data', (req, res) => {
    const newData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing data.json:', err);
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json({ success: true, message: 'Data saved successfully' });
    });
});

// Fallback to index.html for any other route
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('Use this URL to access your site.');
});
