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
        if (!res.ok) throw new Error(JSON.stringify(data));
        
        console.log("[Email Service] Sent successfully to:", recipients.join(', '));
        return data;
    } catch (err) {
        console.error("[Email Service] Failed:", err.message);
        return null;
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

module.exports = {
    sendEmail,
    notifyCaliOrder
};
