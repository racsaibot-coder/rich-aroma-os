const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });

const app = express();
const PORT = process.env.CLOCK_IN_PORT || 8085;

// Rich Aroma Coordinates
const SHOP_LAT = 15.3524; // Placeholder for Quimistan, update to exact
const SHOP_LNG = -88.4000;
const MAX_DISTANCE_METERS = 50;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq'
);

// Distance Calculation (Haversine)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c; // Distance in km
}

app.post('/api/clock', async (req, res) => {
    const { employeeId, type, lat, lng, bypassGps } = req.body;

    if (!employeeId || !type) {
        return res.status(400).json({ error: 'Missing employee ID or punch type' });
    }

    if (!bypassGps) {
        if (!lat || !lng) {
            return res.status(400).json({ error: 'GPS location required to clock in.' });
        }
        const distance = getDistanceFromLatLonInKm(SHOP_LAT, SHOP_LNG, lat, lng) * 1000;
        if (distance > MAX_DISTANCE_METERS) {
            return res.status(403).json({ error: `You are too far from the shop (${Math.round(distance)}m away). You must be within ${MAX_DISTANCE_METERS}m to clock in.` });
        }
    }

    // Verify Employee
    const { data: employee } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
        
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Record Punch
    const { data, error } = await supabase
        .from('timeclock')
        .insert({
            employee_id: employeeId,
            type: type
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, punch: data, employee: employee.name });
});

app.listen(PORT, () => {
    console.log(`Clock-in app running on port ${PORT}`);
});
