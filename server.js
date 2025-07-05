const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

// Debug: Check if environment variables are loaded
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'NOT LOADED');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Loaded' : 'NOT LOADED');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Database connection (Neon PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Email transporter
let transporter = null;

try {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('Email transporter configured successfully');
    } else {
        console.log('Email configuration not found. Email notifications will be disabled.');
    }
} catch (error) {
    console.log('Email configuration error. Email notifications will be disabled.');
}

// Initialize database table
async function initializeDatabase() {
    try {
        const client = await pool.connect();

        // Create orders table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(100) NOT NULL,
                customer_email VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                delivery_address TEXT NOT NULL,
                order_items JSONB NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'pending'
            )
        `);

        // Create contacts table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                country VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if payment_confirmed column exists, if not add it
        try {
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN payment_confirmed BOOLEAN DEFAULT FALSE
            `);
            console.log('Added payment_confirmed column');
        } catch (error) {
            if (error.code === '42701') {
                console.log('payment_confirmed column already exists');
            } else {
                console.log('Error adding payment_confirmed column:', error.message);
            }
        }

        // Check if transaction_id column exists, if not add it
        try {
            await client.query(`
                ALTER TABLE orders 
                ADD COLUMN transaction_id VARCHAR(100)
            `);
            console.log('Added transaction_id column');
        } catch (error) {
            if (error.code === '42701') {
                console.log('transaction_id column already exists');
            } else {
                console.log('Error adding transaction_id column:', error.message);
            }
        }

        // Add unique constraint to transaction_id if it doesn't exist
        try {
            await client.query(`
                ALTER TABLE orders 
                ADD CONSTRAINT unique_transaction_id UNIQUE (transaction_id)
            `);
            console.log('Added unique constraint to transaction_id');
        } catch (error) {
            if (error.code === '42710') {
                console.log('Unique constraint on transaction_id already exists');
            } else if (error.code === '42P07') {
                console.log('Unique constraint on transaction_id already exists');
            } else {
                console.log('Error adding unique constraint to transaction_id:', error.message);
            }
        }

        client.release();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// API Routes
app.post('/api/orders', async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            deliveryAddress,
            orderItems,
            totalAmount,
            paymentConfirmed,
            transactionId
        } = req.body;

        // Validate required fields
        if (!customerName || !customerEmail || !customerPhone || !deliveryAddress || !orderItems || !totalAmount) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate payment confirmation
        if (!paymentConfirmed) {
            return res.status(400).json({ error: 'Payment must be confirmed before placing order' });
        }

        // Validate transaction ID
        if (!transactionId || transactionId.trim() === '') {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        // Check if transaction ID already exists
        const client = await pool.connect();
        try {
            const existingOrder = await client.query(
                'SELECT id FROM orders WHERE transaction_id = $1',
                [transactionId.trim()]
            );

            if (existingOrder.rows.length > 0) {
                client.release();
                return res.status(400).json({
                    error: 'This transaction ID has already been used. Please use a different transaction ID.'
                });
            }

            // Insert order into database with payment information
            const result = await client.query(
                `INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_address, order_items, total_amount, payment_confirmed, transaction_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [customerName, customerEmail, customerPhone, deliveryAddress, JSON.stringify(orderItems), totalAmount, paymentConfirmed, transactionId.trim()]
            );

            const orderId = result.rows[0].id;

            // Send email notification
            await sendOrderNotification({
                orderId,
                customerName,
                customerEmail,
                customerPhone,
                deliveryAddress,
                orderItems,
                totalAmount,
                transactionId: transactionId.trim()
            });

            res.json({
                success: true,
                message: 'Order placed successfully! Payment confirmed.',
                orderId: orderId
            });

        } catch (error) {
            if (error.code === '23505') { // Unique constraint violation
                client.release();
                return res.status(400).json({
                    error: 'This transaction ID has already been used. Please use a different transaction ID.'
                });
            }
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Get all orders (admin endpoint)
app.get('/api/orders', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM orders ORDER BY order_date DESC');
        client.release();
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, country, message } = req.body;

        // Validate required fields
        if (!name || !email || !country || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        // Insert contact into database
        const client = await pool.connect();
        const result = await client.query(
            `INSERT INTO contacts (name, email, country, message)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, email, country, message]
        );
        client.release();

        const contactId = result.rows[0].id;

        // Send email notification
        await sendContactNotification({
            contactId,
            name,
            email,
            country,
            message
        });

        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            contactId: contactId
        });

    } catch (error) {
        console.error('Contact submission error:', error);
        res.status(500).json({ error: 'Failed to submit contact form' });
    }
});

// Get all contacts (admin endpoint)
app.get('/api/contacts', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM contacts ORDER BY submission_date DESC');
        client.release();
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Email notification function
async function sendOrderNotification(orderData) {
    if (!transporter) {
        console.log('Email transporter not configured. Skipping email notifications.');
        return;
    }

    try {
        const orderItemsList = orderData.orderItems.map(item =>
            `${item.name} - ₹${item.price} x ${item.quantity}`
        ).join('\n');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New Order #${orderData.orderId} - Jyothi's Spice Emporium`,
            html: `
                <h2>New Order Received!</h2>
                <p><strong>Order ID:</strong> ${orderData.orderId}</p>
                <p><strong>Customer Name:</strong> ${orderData.customerName}</p>
                <p><strong>Email:</strong> ${orderData.customerEmail}</p>
                <p><strong>Phone:</strong> ${orderData.customerPhone}</p>
                <p><strong>Delivery Address:</strong></p>
                <p>${orderData.deliveryAddress}</p>
                <p><strong>Order Items:</strong></p>
                <ul>
                    ${orderData.orderItems.map(item =>
                `<li>${item.name} - ₹${item.price} x ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}</li>`
            ).join('')}
                </ul>
                <p><strong>Total Amount:</strong> ₹${orderData.totalAmount}</p>
                <p><strong>Payment Status:</strong> ✅ CONFIRMED</p>
                <p><strong>Transaction ID:</strong> ${orderData.transactionId}</p>
                <p><strong>Order Date:</strong> ${new Date().toLocaleString()}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Order notification email sent successfully');

        // Send confirmation email to customer
        const customerMailOptions = {
            from: process.env.EMAIL_USER,
            to: orderData.customerEmail,
            subject: `Order Confirmation #${orderData.orderId} - Jyothi's Spice Emporium`,
            html: `
                <h2>Thank you for your order!</h2>
                <p>Dear ${orderData.customerName},</p>
                <p>Your order has been successfully placed and payment has been confirmed.</p>
                <p><strong>Order ID:</strong> ${orderData.orderId}</p>
                <p><strong>Transaction ID:</strong> ${orderData.transactionId}</p>
                <p><strong>Total Amount:</strong> ₹${orderData.totalAmount}</p>
                <p>We will contact you soon regarding delivery details.</p>
                <p>Thank you for choosing Jyothi's Spice Emporium!</p>
            `
        };

        await transporter.sendMail(customerMailOptions);
        console.log('Customer confirmation email sent successfully');

    } catch (error) {
        console.error('Email sending error:', error);
        // Don't throw error - order should still be processed even if email fails
    }
}

// Contact notification email function
async function sendContactNotification(contactData) {
    if (!transporter) {
        console.log('Email transporter not configured. Skipping contact email notifications.');
        return;
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New Contact Message #${contactData.contactId} - Jyothi's Spice Emporium`,
            html: `
                <h2>New Contact Message Received!</h2>
                <p><strong>Contact ID:</strong> ${contactData.contactId}</p>
                <p><strong>Name:</strong> ${contactData.name}</p>
                <p><strong>Email:</strong> ${contactData.email}</p>
                <p><strong>Country:</strong> ${contactData.country}</p>
                <p><strong>Message:</strong></p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${contactData.message.replace(/\n/g, '<br>')}
                </div>
                <p><strong>Submission Date:</strong> ${new Date().toLocaleString()}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Contact notification email sent successfully');

        // Send confirmation email to customer
        const customerMailOptions = {
            from: process.env.EMAIL_USER,
            to: contactData.email,
            subject: `Message Received - Jyothi's Spice Emporium`,
            html: `
                <h2>Thank you for contacting us!</h2>
                <p>Dear ${contactData.name},</p>
                <p>We have received your message and will get back to you soon.</p>
                <p><strong>Your Message:</strong></p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${contactData.message.replace(/\n/g, '<br>')}
                </div>
                <p>Thank you for your interest in Jyothi's Spice Emporium!</p>
            `
        };

        await transporter.sendMail(customerMailOptions);
        console.log('Contact confirmation email sent successfully');

    } catch (error) {
        console.error('Contact email sending error:', error);
        // Don't throw error - contact should still be processed even if email fails
    }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Serve Home page as default landing page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/Home.html');
});

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDatabase();
}); 