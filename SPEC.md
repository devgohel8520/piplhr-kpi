# Dynamic KPI System - Specification

## 1. Concept & Vision

A sleek, professional KPI tracking dashboard that empowers users to define custom metrics, log daily achievements, and visualize performance trends. The interface feels like a premium enterprise tool—clean, data-focused, with subtle blue accents that guide the eye without overwhelming. Think modern SaaS dashboard with shadcn/ui-inspired components.

## 2. Design Language

### Aesthetic Direction
Minimalist enterprise dashboard with ShadCN-inspired components. Clean white/light background with blue primary accents for interactive elements and status indicators.

### Color Palette
- **Primary Background**: `#f8fafc` (slate-50)
- **Secondary Background**: `#ffffff` (white card surfaces)
- **Tertiary Background**: `#f1f5f9` (slate-100)
- **Hover Background**: `#e2e8f0` (slate-200)
- **Border**: `#e2e8f0` (slate-200)
- **Border Hover**: `#cbd5e1` (slate-300)
- **Primary Text**: `#0f172a` (slate-900)
- **Secondary Text**: `#475569` (slate-600)
- **Muted Text**: `#94a3b8` (slate-400)
- **Primary Blue**: `#2563eb` (blue-600)
- **Blue Hover**: `#1d4ed8` (blue-700)
- **Blue Subtle**: `#eff6ff` (blue-50)
- **Success Green**: `#22c55e` (green-500)
- **Success Subtle**: `#f0fdf4` (green-50)
- **Warning Yellow**: `#eab308` (yellow-500)
- **Warning Subtle**: `#fefce8` (yellow-50)
- **Danger Red**: `#ef4444` (red-500)
- **Danger Subtle**: `#fef2f2` (red-50)

### Typography
- **Font Family**: `Inter, -apple-system, BlinkMacSystemFont, sans-serif`
- **Headings**:
  - H1: 32px, 700 weight
  - H2: 24px, 600 weight
  - H3: 18px, 600 weight
- **Body**: 14px, 400 weight
- **Small/Caption**: 12px, 400 weight
- **Mono (numbers)**: `JetBrains Mono, monospace`

### Spatial System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- Card padding: 24px
- Card border-radius: 12px
- Button border-radius: 8px
- Input border-radius: 6px

### Motion Philosophy
- Transitions: 150ms ease for hovers, 200ms ease-out for modals
- Micro-interactions on buttons: subtle scale(0.98) on active
- Progress bars: smooth width transitions
- Modals: fade + scale from 0.95 to 1
- Cards: subtle shadow elevation on hover

## 3. Technical Architecture

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: pg (node-postgres)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

### Frontend
- **Type**: Single Page Application (SPA)
- **Styling**: Vanilla CSS with CSS Variables
- **JavaScript**: ES6+ modules
- **State Management**: Local state with API sync

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPIs table
CREATE TABLE kpis (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('number', 'percentage', 'boolean')),
  target DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entries table
CREATE TABLE entries (
  id SERIAL PRIMARY KEY,
  kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kpi_id, date)
);
```

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

#### KPIs
- `GET /api/kpis` - Get all KPIs for user
- `POST /api/kpis` - Create new KPI
- `PUT /api/kpis/:id` - Update KPI
- `DELETE /api/kpis/:id` - Delete KPI

#### Entries
- `GET /api/entries?kpi_id=X&start=DATE&end=DATE` - Get entries
- `POST /api/entries` - Create/update entry
- `DELETE /api/entries/:id` - Delete entry

## 4. Pages

### Landing Page
- Hero section with app description
- Features showcase
- Call-to-action buttons (Login/Signup)
- Navigation header

### Login Page
- Email and password inputs
- Form validation
- Error messages
- Link to signup
- Forgot password link (stretch)

### Signup Page
- Name, email, password, confirm password inputs
- Form validation
- Password requirements indicator
- Link to login

### Dashboard (KPI App)
- Navigation with user profile
- Dashboard view with KPI cards
- Daily entry view
- Reports view
- Manage KPIs view
- Logout functionality

## 5. Mobile Responsiveness

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Stack navigation vertically
- Single column layouts
- Hamburger menu for navigation
- Touch-friendly tap targets (min 44px)
- Responsive tables with horizontal scroll
- Condensed cards and stats
- Full-width forms and inputs

## 6. Security

- Password hashing with bcrypt (10 rounds)
- JWT tokens with 7-day expiry
- Protected API routes with middleware
- CORS configuration for frontend origin
- Input validation on all endpoints
- SQL injection prevention with parameterized queries
