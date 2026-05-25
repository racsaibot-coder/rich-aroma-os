const { supabase: defaultSupabase } = require('./supabase');

const HONDURAS_TZ = 'America/Tegucigalpa';

function getHondurasDate() {
    try {
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: HONDURAS_TZ, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(new Date());
    } catch(e) {
        return new Date().toISOString().split('T')[0];
    }
}

/**
 * Calculates and awards points to a customer based on order details.
 */
async function awardPoints(customerId, amount, paymentMethod, supabase = defaultSupabase) {
    if (!customerId || amount <= 0) return;
    try {
        const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single();
        if (!customer) return;

        // Logic: 1 point per L. 10 spent. Double points for Rico Cash.
        let pointsBase = Math.floor((parseFloat(amount) || 0) / 10);
        let multiplier = (paymentMethod === 'rico_balance' || paymentMethod === 'rico_cash') ? 2 : 1;
        
        // VIP Bonus (2x)
        if (customer.is_vip) {
            multiplier *= 2;
        }

        const pointsEarned = pointsBase * multiplier;
        if (pointsEarned <= 0) return;

        const newPoints = (parseInt(customer.points) || 0) + pointsEarned;
        const newVisits = (parseInt(customer.visits) || 0) + 1;
        const newTotalSpent = (parseFloat(customer.total_spent) || 0) + parseFloat(amount);

        // Tier Logic
        let newTier = customer.tier || 'bronze';
        if (newPoints >= 1500) newTier = 'gold';
        else if (newPoints >= 500) newTier = 'silver';

        await supabase.from('customers').update({ 
            points: newPoints,
            visits: newVisits,
            total_spent: newTotalSpent,
            tier: newTier
        }).eq('id', customerId);
        
        console.log(`[Loyalty] Awarded ${pointsEarned} points to ${customerId}`);
        return pointsEarned;
    } catch (e) { 
        console.error("Award Points Fail:", e); 
        return 0;
    }
}

/**
 * Handles VIP renewal and breakage
 */
async function syncMembershipState(customer, supabase = defaultSupabase) {
    if (!customer) return customer;

    const isVip = customer.is_vip === true || (Array.isArray(customer.tags) && customer.tags.includes('VIP'));
    if (!isVip) return customer;

    const today = getHondurasDate();
    const updates = {};
    let stateChanged = false;

    // RULE: Monthly Rico Cash Sweep & Reload (500.00 every 30 days)
    const VIP_MONTHLY_RELOAD = 500.0;
    if (customer.next_renewal_date && today >= customer.next_renewal_date) {
        const breakage = parseFloat(customer.rico_balance) || 0;

        try {
            await supabase.from('membership_billing_events').insert({
                customer_id: customer.id,
                event_type: 'renewal_sweep',
                amount_swept: breakage,
                amount_deposited: VIP_MONTHLY_RELOAD
            });
        } catch (e) { console.error("[VIP] Failed to log billing event:", e.message); }

        updates.rico_balance = VIP_MONTHLY_RELOAD;
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        updates.next_renewal_date = nextDate.toISOString().split('T')[0];
        stateChanged = true;
    }

    if (stateChanged) {
        const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', customer.id)
            .select()
            .single();
        if (!error && data) return data;
    }

    return customer;
}

module.exports = {
    awardPoints,
    syncMembershipState,
    getHondurasDate
};
