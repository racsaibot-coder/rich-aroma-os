const fetch = require('node-fetch');

/**
 * Shared email service using Resend API.
 */
async function sendEmail({ to, subject, html, from }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn("[Email Service] RESEND_API_KEY not found. Skipping email.");
        return;
    }

    const recipients = Array.isArray(to) ? to : [to];

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: from || process.env.FROM_EMAIL || 'Rich Aroma <orders@richaromacoffee.com>',
                to: recipients,
                subject,
                html
            })
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("[Email Service] Resend Error:", data);
            return { error: true, details: data };
        }
        
        console.log("[Email Service] Sent successfully to:", recipients.join(', '));
        return data;
    } catch (err) {
        console.error("[Email Service] Runtime Error:", err.message);
        return { error: true, message: err.message };
    }
}

/**
 * Specific notification for Cali Distro orders.
 */
async function notifyCaliOrder(order, type = 'PAID') {
    const ownerEmail = process.env.OWNER_EMAIL || 'racs01@gmail.com';
    const extraEmail = 'boredneenee@gmail.com';
    
    const subject = `[CALI ${type}] Nuevo Pedido de Botellas - ${order.customer_name || 'Invitado'}`;
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: #C9A66B;">Rich Aroma Cali Distro</h2>
            <p>Se ha recibido un nuevo pedido <strong>${type}</strong>.</p>
            <hr />
            <p><strong>ID:</strong> ${order.id}</p>
            <p><strong>Cliente:</strong> ${order.customer_name}</p>
            <p><strong>Teléfono:</strong> ${order.customer_phone || 'No provisto'}</p>
            <p><strong>Total:</strong> $${order.total || '0.00'}</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 10px; margin-top: 10px;">
                <p><strong>Detalles:</strong></p>
                <pre>${order.notes || 'Sin notas'}</pre>
            </div>
            <p style="font-size: 10px; color: #aaa; margin-top: 20px;">
                Este es un mensaje automático del sistema Rich Aroma OS.
            </p>
        </div>
    `;

    return await sendEmail({
        to: [ownerEmail, extraEmail],
        subject,
        html
    });
}

/**
 * Generic notification for any order in the OS (Coffee, Food, or QuimiEats)
 */
async function notifyOrder(order, type = 'NEW') {
    const ownerEmail = process.env.OWNER_EMAIL || 'racs01@gmail.com';
    const restaurantName = order.restaurant_id === 'rich-aroma' ? 'Rich Aroma Coffee' : order.restaurant_id.toUpperCase();
    
    const subject = `[${restaurantName}] ${type} Pedido #${order.order_number || ''}`;
    
    let itemsHtml = (order.items || []).map(i => `
        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <span style="font-weight: bold;">${i.qty}x ${i.name}</span> 
            <span style="color: #666; font-size: 11px;">(L. ${parseFloat(i.price).toFixed(2)})</span>
        </div>
    `).join('');

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #C9A66B; margin: 0;">${restaurantName}</h2>
                <p style="color: #666; font-size: 12px; text-transform: uppercase;">Nuevo Pedido Recibido</p>
            </div>
            <div style="background: #fdfaf6; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <p style="margin: 5px 0;"><strong>ID:</strong> ${order.id}</p>
                <p style="margin: 5px 0;"><strong>Pago:</strong> ${order.payment_method || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Entrega:</strong> ${order.fulfillment || 'Pickup'}</p>
                ${order.scheduled_for ? `<p style="margin: 5px 0; color: #d97706;"><strong>PROGRAMADO:</strong> ${new Date(order.scheduled_for).toLocaleString()}</p>` : ''}
            </div>
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; text-transform: uppercase; color: #999; border-bottom: 2px solid #C9A66B; padding-bottom: 5px;">Detalle de Orden</h3>
                ${itemsHtml}
                <div style="text-align: right; padding-top: 15px;">
                    <p style="font-size: 18px; font-weight: bold;">Total: L. ${parseFloat(order.total).toFixed(2)}</p>
                </div>
            </div>
            ${order.notes ? `<div style="background: #eee; padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 20px;"><strong>Notas:</strong> ${order.notes}</div>` : ''}
            <p style="font-size: 10px; color: #aaa; text-align: center;">Rich Aroma OS • Quimistán, Honduras</p>
        </div>
    `;

    return await sendEmail({
        to: [ownerEmail],
        subject,
        html
    });
}

module.exports = {
    sendEmail,
    notifyCaliOrder,
    notifyOrder
};
