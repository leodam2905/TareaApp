# Tarea — Full-Stack Handyman App

A modern handyman marketplace with web (Next.js) + mobile (Expo React Native) frontends sharing a single PostgreSQL backend.

**Colors:** Sky Blue `#38BDF8` · Dark Blue `#1E3A8A` · White `#FFFFFF` · Ink Black `#0F172A`

---

## Project Structure

```
TareaApp/
├── apps/
│   ├── web/          # Next.js 14 (web + API + DB)
│   └── mobile/       # Expo React Native
└── package.json      # Workspace root
```

---

## Web App Setup (`apps/web`)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Steps

```bash
cd apps/web

# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Push schema to your database
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Database Studio
```bash
npm run db:studio
```

---

## Mobile App Setup (`apps/mobile`)

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator

### Steps

```bash
cd apps/mobile

# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL to point to your web server

# 3. Start Expo
npx expo start

# Press 'i' for iOS simulator, 'a' for Android
```

---

## Features

### Customer
- Browse services by category, search, filter by city
- View handyman profiles with ratings and hourly rates
- Book appointments with date/time picker
- Track booking status (Pending → Accepted → In Progress → Completed)
- Leave reviews after job completion
- Dashboard with spending stats

### Handyman
- Create and manage service listings
- Accept/decline booking requests
- Track active jobs and earnings
- View rating and review history
- Earnings dashboard with payment history

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Web Frontend | Next.js 14 (App Router) + Tailwind CSS |
| 3D + Animation | Three.js + React Three Fiber + Framer Motion |
| Mobile | Expo (React Native) + Reanimated |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + bcrypt (httpOnly cookies) |
| Forms | react-hook-form + Zod |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/services` | List services (filter by category, city) |
| POST | `/api/services` | Create service (handyman only) |
| GET | `/api/bookings` | List user's bookings |
| POST | `/api/bookings` | Create booking (customer only) |
| PATCH | `/api/bookings/:id` | Update booking status |
| POST | `/api/reviews` | Submit review |

---

## Environment Variables

### Web (`apps/web/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-long-secret-here
```

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```
