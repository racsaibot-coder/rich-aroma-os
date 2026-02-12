import json
import random
import time
from collections import deque, defaultdict
import os
from datetime import datetime, timedelta

# --- CONFIGURATION ---
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
MENU_FILE = os.path.join(DATA_DIR, 'menu.json')

DAYS_TO_SIMULATE = 30
OPENING_HOUR = 7
CLOSING_HOUR = 17 # 5 PM

# Staff Config (processed items per minute approx)
SPEED_CASHIER = 1.5
SPEED_BARISTA = 0.8
SPEED_COOK = 0.5
SPEED_FLOATER = 0.6 # Slower than dedicated, but helps

# Creator Config
CREATOR_CHANCE = 0.05 # 5% of customers are creators
AVG_VIEWS_PER_POST = 1500

# --- LOAD MENU ---
try:
    with open(MENU_FILE, 'r') as f:
        MENU_DATA = json.load(f)
except FileNotFoundError:
    print("Warning: menu.json not found, using fallback menu.")
    MENU_DATA = {
        "categories": [
            {"id": "coffee", "items": [{"id": "espresso", "name": "Espresso", "price": 35}, {"id": "latte", "name": "Latte", "price": 55}]},
            {"id": "food", "items": [{"id": "bowl", "name": "Bowl", "price": 120}, {"id": "sandwich", "name": "Sandwich", "price": 90}]}
        ]
    }

MENU_ITEMS = {}
for cat in MENU_DATA['categories']:
    for item in cat['items']:
        item['category_id'] = cat['id']
        MENU_ITEMS[item['id']] = item

# --- CLASSES ---

class Customer:
    def __init__(self, id):
        self.id = id
        self.is_vip = False 
        self.rico_cash = 0
        self.credit_card_spent = 0
        self.is_creator = random.random() < CREATOR_CHANCE
        self.content_submitted = False

    def decide_membership(self):
        # ... existing logic ...
        if not self.is_vip and random.random() < 0.05:
            self.is_vip = True
            self.rico_cash += 500
            return True
        return False
    
    def engage_challenge(self):
        # If creator, 30% chance to participate in active challenge
        if self.is_creator and not self.content_submitted and random.random() < 0.30:
            self.content_submitted = True
            return True # Submitted content
        return False

    def generate_order(self, hour):
        items = []
        # Drink (Almost always)
        drink_cats = [c for c in MENU_DATA['categories'] if c['id'] in ['beverages', 'coffee']]
        if drink_cats:
            cat = random.choice(drink_cats)
            item = random.choice(cat['items'])
            items.append(item)

        # Food
        if 7 <= hour <= 10:
            if random.random() < 0.4:
                food_cats = [c for c in MENU_DATA['categories'] if c['id'] == 'extras'] or [c for c in MENU_DATA['categories'] if c['id'] == 'grill']
                if food_cats:
                    cat = random.choice(food_cats)
                    items.append(random.choice(cat['items']))
        elif 11 <= hour <= 14:
            if random.random() < 0.7:
                food_cats = [c for c in MENU_DATA['categories'] if c['id'] in ['bowls', 'grill', 'weekend']]
                if food_cats:
                    cat = random.choice(food_cats)
                    items.append(random.choice(cat['items']))
        
        return items

class Order:
    def __init__(self, id, customer, items, time_placed, hour_placed):
        self.id = id
        self.customer = customer
        self.items = items
        self.time_placed = time_placed
        self.hour_placed = hour_placed
        self.time_completed = None
        self.total = sum(item['price'] for item in items)
        
        self.drink_count = sum(1 for i in items if i['category_id'] in ['beverages', 'coffee'])
        self.food_count = sum(1 for i in items if i['category_id'] not in ['beverages', 'coffee', 'extras'])
        self.simple_count = len(items) - self.drink_count - self.food_count

    def process_payment(self):
        paid_cash = 0
        paid_rico = 0
        if self.customer.rico_cash > 0:
            if self.customer.rico_cash >= self.total:
                paid_rico = self.total
                self.customer.rico_cash -= self.total
            else:
                paid_rico = self.customer.rico_cash
                paid_cash = self.total - self.customer.rico_cash
                self.customer.rico_cash = 0
        else:
            paid_cash = self.total
            self.customer.credit_card_spent += self.total
        return paid_cash, paid_rico

class Staff:
    def __init__(self, role, speed):
        self.role = role
        self.speed = speed 
        self.busy_until = 0

class Shop:
    def __init__(self):
        self.day = 0
        self.cashier = Staff('Cashier', SPEED_CASHIER)
        self.barista = Staff('Barista', SPEED_BARISTA)
        self.cook = Staff('Cook', SPEED_COOK)

    def run_day(self, day_num):
        self.day = day_num
        
        revenue_real = 0
        revenue_rico = 0
        memberships_sold = 0
        item_sales = defaultdict(int)
        hourly_sales = defaultdict(float)
        hourly_item_counts = defaultdict(lambda: defaultdict(int))
        bottlenecks = defaultdict(int)
        
        # Creator Stats
        creators_visited = 0
        challenge_submissions = 0
        rico_cash_awarded = 0
        
        self.cashier.busy_until = 0
        self.barista.busy_until = 0
        self.cook.busy_until = 0
        
        orders_today = []
        customer_id_counter = 1
        
        for minute in range(0, (CLOSING_HOUR - OPENING_HOUR) * 60):
            current_hour = OPENING_HOUR + (minute // 60)
            
            # Traffic
            if 7 <= current_hour < 9: chance = 0.4
            elif 9 <= current_hour < 11: chance = 0.2
            elif 11 <= current_hour < 14: chance = 0.35
            elif 14 <= current_hour < 16: chance = 0.15
            else: chance = 0.1
            
            num_arrivals = 0
            if random.random() < chance:
                num_arrivals = random.randint(1, 3)
            
            for _ in range(num_arrivals):
                cust = Customer(f"D{day_num}-C{customer_id_counter}")
                customer_id_counter += 1
                
                if cust.decide_membership():
                    memberships_sold += 1
                    revenue_real += 500
                
                items = cust.generate_order(current_hour)
                if not items: continue
                
                order = Order(f"D{day_num}-O{len(orders_today)+1}", cust, items, minute, current_hour)
                orders_today.append(order)
                
                cash, rico = order.process_payment()
                revenue_real += cash
                revenue_rico += rico
                
                # Metrics
                hourly_sales[current_hour] += order.total
                for item in items:
                    item_sales[item['name']] += 1
                    hourly_item_counts[current_hour][item['name']] += 1
                
                # Staff Logic
                start_time = max(minute, self.cashier.busy_until)
                self.cashier.busy_until = start_time + (1.0 / self.cashier.speed)
                
                # Default completion (Grab & Go)
                completion_time = start_time
                if start_time - minute > 10: bottlenecks["Cashier"] += 1
                
                if order.drink_count > 0:
                    b_start = max(start_time, self.barista.busy_until)
                    b_finish = b_start + (order.drink_count / self.barista.speed)
                    self.barista.busy_until = b_finish
                    completion_time = max(completion_time, b_finish)
                    if b_start - start_time > 15: bottlenecks["Barista"] += 1
                
                if order.food_count > 0:
                    k_start = max(start_time, self.cook.busy_until)
                    k_finish = k_start + (order.food_count / self.cook.speed)
                    self.cook.busy_until = k_finish
                    completion_time = max(completion_time, k_finish)
                    if k_start - start_time > 20: bottlenecks["Cook"] += 1
                    
                order.time_completed = completion_time

        # End of Day Stats
        # Metrics
        orders_processed = [o for o in orders_today if o.time_completed is not None]
        
        # Calculate Sentiment
        wait_times = [(o.time_completed - o.time_placed) for o in orders_processed]
        avg_wait = sum(wait_times) / len(wait_times) if wait_times else 0
        
        satisfaction_score = 100
        if avg_wait > 5: satisfaction_score -= (avg_wait - 5) * 5
        satisfaction_score = max(0, min(100, int(satisfaction_score)))
        
        # Qualitative Feedback Generator
        customer_feedback = "Loved it! Fast service."
        if avg_wait > 15: customer_feedback = "Food was good but wait was insane."
        elif avg_wait > 10: customer_feedback = "A bit slow, but worth it."
        elif avg_wait > 7: customer_feedback = "Busy, but moving."
        
        pos_feedback = "POS Flow: Smooth. No issues."
        cashier_load = (bottlenecks["Cashier"] / len(orders_today)) * 100 if orders_today else 0
        if cashier_load > 10: pos_feedback = "POS Flow: Cashier got overwhelmed."

        return {
            "revenue_real": revenue_real,
            "revenue_rico": revenue_rico,
            "memberships": memberships_sold,
            "orders": len(orders_today),
            "item_sales": dict(item_sales),
            "hourly_sales": dict(hourly_sales),
            "hourly_item_counts": dict(hourly_item_counts),
            "customer_feedback": customer_feedback,
            "pos_feedback": pos_feedback,
            "avg_wait": avg_wait,
            "csat": satisfaction_score,
            "creator_stats": {
                "visitors": creators_visited,
                "submissions": challenge_submissions,
                "awarded": rico_cash_awarded,
                "est_views": challenge_submissions * AVG_VIEWS_PER_POST
            }
        }

# --- MAIN ---
if __name__ == "__main__":
    shop = Shop()
    total_stats = {"revenue_real": 0, "revenue_rico": 0, "memberships": 0, "orders": 0, "rico_awarded": 0}
    creator_stats = {"visitors": 0, "submissions": 0, "est_views": 0}
    
    weekly_item_sales = defaultdict(int)
    weekly_hourly_revenue = defaultdict(float)
    weekly_hourly_items = defaultdict(lambda: defaultdict(int))
    
    daily_sentiments = []
    
    for d in range(1, DAYS_TO_SIMULATE + 1):
        daily = shop.run_day(d)
        for k in total_stats:
            if k in daily: total_stats[k] += daily[k]
        
        # Aggregate creator stats
        if 'creator_stats' in daily:
            creator_stats["visitors"] += daily['creator_stats']['visitors']
            creator_stats["submissions"] += daily['creator_stats']['submissions']
            creator_stats["est_views"] += daily['creator_stats']['est_views']
            total_stats["rico_awarded"] += daily['creator_stats']['awarded']
        
        daily_sentiments.append(daily['csat'])
        
        for item, count in daily['item_sales'].items():
            weekly_item_sales[item] += count
            
        for h, rev in daily['hourly_sales'].items():
            weekly_hourly_revenue[h] += rev
            
        for h, items in daily['hourly_item_counts'].items():
            for item, count in items.items():
                weekly_hourly_items[h][item] += count
            
    print(f"RICH AROMA OS - {DAYS_TO_SIMULATE} DAY SIMULATION (STAFFED UP)")
    print("====================================================")
    print(f"Total Revenue (Cash): L{total_stats['revenue_real']:.2f}")
    print(f"Total Revenue (Rico): L{total_stats['revenue_rico']:.2f}")
    print(f"Total Orders: {total_stats['orders']}")
    
    print("\n--- CONTENT CREATOR IMPACT ---")
    print(f"Creators Visited: {creator_stats['visitors']}")
    print(f"Challenges Completed: {creator_stats['submissions']} (Rewards: L{total_stats['rico_awarded']} issued)")
    print(f"Est. TikTok Views Generated: {creator_stats['est_views']:,}")
    
    print("\n--- LOYALTY (RACS CASH) ---")
    print(f"Total Issued (Membership+Rewards): L{total_stats['memberships']*500 + total_stats['rico_awarded']}")
    print(f"Total Redeemed: L{total_stats['revenue_rico']}")
    print(f"Outstanding Liability: L{(total_stats['memberships']*500 + total_stats['rico_awarded']) - total_stats['revenue_rico']}")

    print("\n--- CUSTOMER EXPERIENCE (CSAT) ---")
    avg_csat = sum(daily_sentiments) / len(daily_sentiments)
    print(f"Average Satisfaction: {avg_csat:.1f}/100")
    print(f"Trend (Last 7 Days): {[int(s) for s in daily_sentiments[-7:]]}")
    
    print("\n--- TOP SELLING ITEMS ---")
    sorted_items = sorted(weekly_item_sales.items(), key=lambda x: x[1], reverse=True)[:5]
    for item, count in sorted_items:
        print(f"{item}: {count}")

