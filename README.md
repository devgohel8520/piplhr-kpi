# KPI Dashboard

A modern KPI tracking application built with Vercel Serverless Functions and Neon PostgreSQL.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (SPA)
- **Backend**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL (cloud-hosted)
- **Auth**: JWT

## Features

- Custom KPIs (Number, Percentage, Yes/No)
- Daily value tracking
- Progress visualization
- Reports with time filters
- Responsive design
- User authentication

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/devgohel8520/piplhr-kpi.git
cd piplhr-kpi
```

### 2. Set up Neon PostgreSQL
1. Create a free account at [Neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string

### 3. Configure Environment Variables

**Local Development (.env)**
```env
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=your-secret-key
```

**Vercel Deployment**
Add these environment variables in Vercel dashboard:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `JWT_SECRET` - A secure random string

### 4. Local Development

```bash
npm install -g vercel
vercel dev
```

Then visit `http://localhost:3000`

### 5. Deploy to Vercel

```bash
vercel --prod
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### KPIs
- `GET /api/kpis` - Get all user KPIs
- `POST /api/kpis` - Create new KPI
- `PUT /api/kpis/:id` - Update KPI
- `DELETE /api/kpis/:id` - Delete KPI

### Entries
- `GET /api/entries` - Get entries (query: kpi_id, start, end)
- `POST /api/entries` - Create/update entry
- `DELETE /api/entries/:id` - Delete entry

## Project Structure

```
├── api/
│   └── index.js      # Vercel serverless functions
├── public/
│   └── index.html    # Frontend SPA
├── vercel.json       # Vercel configuration
└── package.json
```

## License

MIT
