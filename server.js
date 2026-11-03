/**
 * Qxuan Photobooth - Local Node.js Express Server
 * Menjalankan fungsi serverless yang sama persis dengan yang di-deploy ke Vercel.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Static Assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Serverless Handler Wrappers
const createPayment = require('./api/create_payment');
const checkStatus   = require('./api/check_status');
const mockPay       = require('./api/mock_pay');
const webhook       = require('./api/webhook_callback');
const uploadTemp    = require('./api/upload_temp');
const cronCleanup   = require('./api/cron_cleanup');

// Routes (Mendukung path dengan atau tanpa ekstensi .php)
app.all(['/api/create_payment', '/api/create_payment.php'], createPayment);
app.all(['/api/check_status',   '/api/check_status.php'],   checkStatus);
app.all(['/api/mock_pay',       '/api/mock_pay.php'],       mockPay);
app.all(['/api/webhook_callback', '/api/webhook_callback.php'], webhook);
app.all(['/api/upload_temp',    '/api/upload_temp.php'],    uploadTemp);
app.all(['/api/cron_cleanup',   '/api/cron_cleanup.php'],   cronCleanup);

// Serve Frontend SPA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`📸 Qxuan Photobooth Local Server`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🚀 Siap di-deploy ke Vercel dengan database Supabase!`);
    console.log(`======================================================\n`);
});
