import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/order.html'

with open(file_path, 'r') as f:
    content = f.read()

# Add selectSecondaryPayment and promptTopUp functions if they are missing
if 'function selectSecondaryPayment' not in content:
    funcs = """
        function selectSecondaryPayment(method) {
            currentSecondaryPayment = method;
            renderPaymentOptions();
        }

        function promptTopUp(suggestedAmount) {
            const amount = prompt("¿Cuánto deseas recargar? (Lempiras)", suggestedAmount);
            if (!amount || isNaN(amount) || amount <= 0) return;
            
            const customerName = currentCustomer ? currentCustomer.name : 'Cliente';
            const msg = `¡Hola! Quiero hacer una recarga de Rico Cash por L.${amount} a nombre de ${customerName} para mi orden actual.`;
            const shopPhone = "50495200236";
            
            alert("A continuación te enviaremos a WhatsApp para que nos envíes el comprobante de la recarga. ¡Una vez aprobado por nosotros, podrás usar el saldo aquí mismo!");
            window.open(`https://wa.me/${shopPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
"""
    content = content.replace("function copyBankInfo", funcs + "\n        function copyBankInfo")

with open(file_path, 'w') as f:
    f.write(content)

print("order.html secondary functions injected.")
