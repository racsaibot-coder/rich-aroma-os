import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html'

with open(file_path, 'r') as f:
    content = f.read()

# We need to update the Orders tab to show Split Cash / Split Transfer clearly
# Look for where orders are rendered in the History/Online Orders tab.
# We'll search for renderOrders or similar

# It seems KDS might not display the payment method. Let's find renderOrders
