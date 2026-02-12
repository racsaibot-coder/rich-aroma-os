# Frontend Guidelines

## Design System: "Tropical Minimal"

### Colors
| Name | Hex | Usage |
|---|---|---|
| **Espresso** | `#1E1610` | Main Background |
| **Rich Gold** | `#C9A66B` | Primary Actions / Highlights |
| **Cream** | `#F5F0EB` | Text / Light Backgrounds |
| **Success** | `#22c55e` | Confirmation / Cash |
| **Danger** | `#ef4444` | Delete / Cancel |
| **Card BG** | `#1a1714` | Secondary Background |

### Typography
- **Family:** Inter (Google Fonts).
- **Weights:** 400 (Body), 600 (Headers), 700 (Prices/Totals).
- **Sizes:**
  - H1: 24px (Mobile), 32px (Desktop)
  - Body: 16px
  - Button: 18px

### Components
- **Buttons:**
  - Radius: `12px`
  - Padding: `1rem`
  - Effect: Active scale `0.98`
- **Cards (Menu/KDS):**
  - Radius: `16px`
  - Border: `1px solid rgba(255,255,255,0.05)`
  - Shadow: None (Flat/Dark mode optimized)
- **Modals:**
  - Backdrop: `rgba(0,0,0,0.8)` (Blur 4px)
  - Animation: Slide up from bottom (Mobile), Fade in (Desktop)

### Responsive Rules
- **Mobile First:** Design for 360px width.
- **Touch Targets:** Minimum 48x48px for all interactive elements.
- **Grid:**
  - Mobile: 2 columns
  - Tablet: 3 columns
  - Desktop: 4+ columns
