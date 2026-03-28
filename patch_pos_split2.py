import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html'

with open(file_path, 'r') as f:
    content = f.read()

# I see pos-v2.html uses setTender('cash') or 'card' or 'transfer'.
# We need to make sure the server payload sends the split information properly from the POS 
# But wait, the POS itself doesn't need to GENERATE split transactions usually, the ONLINE store does.
# We just need to make sure the POS history tab displays "Split Cash" or "Split Transfer" when viewing an order.
# Let's check how the active orders tab renders

