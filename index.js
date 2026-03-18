// index.js
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://blhqirndorouhetyyzzp.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_F_lLs_Gt_hkDUteZspo82A_irUETSOb';
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin PIN
const ADMIN_PIN = 'sila0022';
let visitors = Math.floor(Math.random() * 50) + 100; // Random visitors between 100-150

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session for admin
app.use(session({
    secret: 'sila-tech-secret-key-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 3600000 } // 1 hour
}));

// Auth middleware for admin
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
};

// Initialize database tables
async function initDatabase() {
    try {
        // Check if settings table exists and create if not
        const { error: settingsError } = await supabase
            .from('settings')
            .select('*')
            .limit(1);
        
        if (settingsError && settingsError.code === '42P01') {
            // Table doesn't exist, create it
            console.log('Creating settings table...');
            
            // Create settings table
            const { error: createError } = await supabase.rpc('create_settings_table', {});
            
            if (createError) {
                console.error('Error creating settings table:', createError);
            } else {
                // Insert default settings
                await supabase
                    .from('settings')
                    .insert([
                        {
                            id: 1,
                            target: 200,
                            group_link: 'https://chat.whatsapp.com/Be9v56VJm8kJLrJfuzvWL0',
                            channel_link: 'https://whatsapp.com/channel/0029VbBG4gfISTkCpKxyMH02',
                            group_description: 'Connect with community',
                            channel_description: 'Get latest updates',
                            updated_at: new Date().toISOString()
                        }
                    ]);
            }
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

initDatabase();

// API Routes

// Get all contacts
app.get('/api/contacts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get contacts count
app.get('/api/contacts/count', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add new contact
app.post('/api/contacts', async (req, res) => {
    try {
        const { name, phone, photo } = req.body;
        
        // Get current target
        const { data: settings } = await supabase
            .from('settings')
            .select('target')
            .eq('id', 1)
            .single();
        
        const target = settings?.target || 200;
        
        // Check count
        const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
        
        if (count >= target) {
            return res.status(400).json({ 
                success: false, 
                error: 'Maximum contacts reached' 
            });
        }
        
        // Check if phone exists
        const { data: existing } = await supabase
            .from('contacts')
            .select('phone')
            .eq('phone', phone)
            .maybeSingle();
        
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number already exists' 
            });
        }
        
        // Insert new contact
        const { data, error } = await supabase
            .from('contacts')
            .insert([{ name, phone, photo }])
            .select();
        
        if (error) throw error;
        
        // Increment visitors
        visitors++;
        
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete contact (admin only)
app.delete('/api/contacts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (error && error.code === 'PGRST116') {
            // No settings found, return defaults
            res.json({ 
                success: true, 
                data: {
                    target: 200,
                    group_link: 'https://chat.whatsapp.com/Be9v56VJm8kJLrJfuzvWL0',
                    channel_link: 'https://whatsapp.com/channel/0029VbBG4gfISTkCpKxyMH02',
                    group_description: 'Connect with community',
                    channel_description: 'Get latest updates'
                }
            });
        } else if (error) {
            throw error;
        } else {
            res.json({ success: true, data });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update settings (admin only)
app.post('/api/settings', requireAdmin, async (req, res) => {
    try {
        const { target, group_link, channel_link, group_description, channel_description } = req.body;
        
        const { data, error } = await supabase
            .from('settings')
            .upsert({ 
                id: 1,
                target: parseInt(target) || 200,
                group_link,
                channel_link,
                group_description,
                channel_description,
                updated_at: new Date().toISOString()
            })
            .select();
        
        if (error) throw error;
        
        res.json({ success: true, data: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { pin } = req.body;
    
    if (pin === ADMIN_PIN) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check admin auth
app.get('/api/admin/check', (req, res) => {
    res.json({ success: true, isAdmin: req.session.isAdmin || false });
});

// Get visitors count
app.get('/api/visitors', (req, res) => {
    // Simulate visitor count changes
    visitors += Math.floor(Math.random() * 5) - 2; // -2 to +2 change
    visitors = Math.max(50, Math.min(300, visitors)); // Keep between 50-300
    
    res.json({ success: true, count: visitors });
});

// Export contacts as JSON (admin only)
app.get('/api/admin/export', requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve main page for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📱 Main site: http://localhost:${PORT}`);
});
