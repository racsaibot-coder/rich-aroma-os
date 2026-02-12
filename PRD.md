# Product Requirements Document (PRD)

## Overview
Rich Aroma OS is a bespoke, locally-hosted restaurant management system for "Rich Aroma" (Quimistán, Honduras). It consolidates POS, KDS, Inventory, Timeclock, and Loyalty into a single web-based platform running on a Mac Mini server.

## Goals
1. **Speed:** Sub-second order entry.
2. **Reliability:** Works offline (local server), syncs when online.
3. **Simplicity:** Zero training required for new staff.
4. **Visibility:** Real-time P&L and inventory tracking for owner (Oscar).

## Core Modules

### 1. Point of Sale (POS)
- **User:** Cashier / Waiter
- **Features:**
  - Visual Menu Grid (Images/Icons)
  - Quick Search
  - Modifiers (Milk, Sugar, Size)
  - Split Payments (Cash/Card/Rico Balance)
  - Discount Codes (Creator/Promo)
  - "Recipe Whisperer" (Tap for ingredients)
  - Offline Mode (Queue orders)

### 2. Kitchen Display System (KDS)
- **User:** Barista / Kitchen
- **Features:**
  - Real-time order ticker
  - Color-coded timers (Green -> Yellow -> Red)
  - "Bump" to complete
  - Recall completed orders
  - Item aggregation (e.g., "3 Lattes pending")

### 3. Inventory & Recipes
- **User:** Manager / Auto-System
- **Features:**
  - Ingredient-level tracking (deduct per item sold)
  - Low-stock alerts
  - Waste logging
  - Supplier management

### 4. Loyalty (Rico Balance)
- **User:** Customer / Cashier
- **Features:**
  - Phone number lookup
  - Prepaid balance (Load L500, get L50 bonus)
  - Points system (Tiered: Bronze, Silver, Gold)
  - Badges (Gamification)

### 5. Staff Management
- **User:** Staff
- **Features:**
  - PIN-based Timeclock (Clock In/Out)
  - Shift Scheduling
  - Performance tracking (Orders per hour)

## Non-Functional Requirements
- **Performance:** Load < 500ms.
- **Hardware:** Mac Mini (Server), iPads/Tablets (Clients).
- **Network:** Local Wi-Fi + Cloudflare Tunnel for remote access.
