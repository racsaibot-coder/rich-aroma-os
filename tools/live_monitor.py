import json
import os
import time
from datetime import datetime
import sys

DATA_FILE = '/Users/racs/clawd/projects/rich-aroma-os/data/orders.json'

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def load_orders():
    try:
        with open(DATA_FILE, 'r') as f:
            data = json.load(f)
            return data.get('orders', [])
    except Exception as e:
        return []

def print_dashboard():
    orders = load_orders()
    
    # Filter for today's orders (assuming those without a specific old date or created today)
    # For simplicity in this local tool, we'll just look at all orders or try to filter by recent
    # Let's count totals
    total_sales = 0
    order_count = len(orders)
    item_counts = {}
    
    for o in orders:
        total_sales += o.get('total', 0)
        for item in o.get('items', []):
            name = item.get('name', 'Unknown')
            qty = item.get('quantity', item.get('qty', 1))
            item_counts[name] = item_counts.get(name, 0) + qty

    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    clear_screen()
    print("="*50)
    print(f"☕ RICH AROMA - LIVE SOFT OPENING MONITOR")
    print(f"⏱  Last Updated: {datetime.now().strftime('%H:%M:%S')}")
    print("="*50)
    print(f"🛒 Total Orders: {order_count}")
    print(f"💰 Total Revenue: L. {total_sales:,.2f}")
    print(f"📈 Avg Ticket: L. {(total_sales/max(1, order_count)):,.2f}")
    print("-"*50)
    print("🔥 TOP SELLING ITEMS:")
    for name, count in top_items:
        print(f"   • {name}: {count}")
    print("="*50)
    print("Press Ctrl+C to exit. Refreshing every 10 seconds...")

def main():
    try:
        while True:
            print_dashboard()
            time.sleep(10)
    except KeyboardInterrupt:
        print("\nExiting monitor. Have a great shift!")
        sys.exit(0)

if __name__ == "__main__":
    main()