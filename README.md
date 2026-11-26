# The New School Dhaka - Result Management System

A complete, database-driven school result management system built with React, Node.js, Express, MySQL, and Prisma.

## Technology Stack

### Frontend
- React
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- React Query

### Backend
- Node.js
- Express.js
- RESTful API
- Prisma ORM
- MySQL

### Supporting Libraries
- ExcelJS (Excel import/export)
- Puppeteer (PDF generation)
- Archiver (ZIP downloads)
- bcrypt (password hashing)
- JWT (authentication)
- Vitest & Supertest (testing)

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MySQL** (v8.0 or higher)
3. **npm**
4. **Puppeteer** downloads its own Chromium on `npm install`; on Linux you may need extra system libraries (`npx puppeteer browsers install chrome` if PDF generation fails)

## Installation (fresh clone from Git)

### 1. Clone the repository

```bash
git clone <repository-url>
cd "Result Management System"
```

### 2. Install MySQL and create database

#### Windows (using MySQL Installer)
1. Download and install MySQL from https://dev.mysql.com/downloads/installer/
2. During installation, set a root password (e.g., `password`)
3. Start MySQL service from Services or use MySQL Workbench

#### Create the database

Using MySQL Command Line Client or MySQL Workbench:

```sql
CREATE DATABASE nsd_result_management;
```

### 3. Install dependencies

There are **three** `package.json` files — install all of them:

```bash
# Root (runs server + client together with `npm start`)
npm install

# Backend
cd server
npm install
cd ..

# Frontend
cd client
npm install
cd ..
```

### 4. Set up environment variables

Both `.env` files are git-ignored, so you must create them manually.

**Backend** — copy the example and edit `server/.env`:

```bash
cp .env.example server/.env   # Windows: copy .env.example server/.env
```

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/nsd_result_management"
PORT=5000
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your-session-secret-here-change-in-production
JWT_SECRET=your-jwt-secret-here-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

**Frontend** — create `client/.env` with the API URL:

```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Set up the database

```bash
cd server

# Create all tables from the committed Prisma migrations
npx prisma migrate deploy

# (Generate the Prisma client — migrate deploy does not do this)
npx prisma generate

# Seed demo data (admin user, sessions, classes, subjects, etc.)
npm run prisma:seed
```

The seed creates the admin login:

- **Email:** `admin@newschooldhaka.edu`
- **Password:** `Admin@123`

> Optional demo data scripts: `npm run prisma:demo-marks` and `npm run prisma:demo-exam` (in `server/`).

### 6. Run the application

**Run both at once** (from the project root):

```bash
npm start
```

**Or run separately:**

```bash
cd server && npm run dev   # backend  -> http://localhost:5000
cd client && npm run dev   # frontend -> http://localhost:5173
```

Open http://localhost:5173 and log in with the seeded admin account.

## Production Build

The backend does **not** serve the frontend — build the client and host `client/dist` separately (any static host or reverse proxy), with `/api` requests proxied to the backend.

### Build the frontend

```bash
cd client
npm run build      # outputs to client/dist
npm run preview    # or serve dist/ locally to check the build
```

Before building, set `client/.env` so `VITE_API_URL` points at the deployed backend, e.g.:

```env
VITE_API_URL=https://your-domain.com/api
```

### Start the backend in production mode

```bash
cd server
NODE_ENV=production npm start
```

## Database Management

### View database with Prisma Studio

```bash
cd server
npm run prisma:studio
```

### Reset database (CAUTION: deletes all data)

```bash
cd server
npx prisma migrate reset
```

### Create a new migration

```bash
cd server
npx prisma migrate dev --name migration_name
```

### Backup database

```bash
mysqldump -u root -p nsd_result_management > backup.sql
```

### Restore database

```bash
mysql -u root -p nsd_result_management < backup.sql
```

## Testing

### Run backend tests

```bash
cd server
npm test
```

## Project Structure

```
nsd-result-management/
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/           # API services
│   │   ├── components/    # Reusable components
│   │   ├── layouts/       # Layout components
│   │   ├── pages/         # Page components
│   │   ├── features/      # Feature modules
│   │   ├── hooks/         # Custom hooks
│   │   ├── routes/        # Route configurations
│   │   └── utils/         # Utility functions
│   └── package.json
├── server/                # Node.js backend
│   ├── prisma/
│   │   ├── schema.prisma # Prisma schema
│   │   ├── migrations/    # Database migrations
│   │   └── seed.js        # Seed script
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── middleware/    # Express middleware
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # Route controllers
│   │   ├── services/      # Business logic
│   │   ├── validators/    # Request validators
│   │   ├── templates/     # PDF templates
│   │   ├── utils/         # Utility functions
│   │   ├── jobs/          # Background jobs
│   │   ├── app.js         # Express app
│   │   └── server.js      # Server entry point
│   ├── tests/             # Backend tests
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

## User Roles

### Admin
- Manage teacher accounts
- Manage students
- Import students from Excel
- Create academic sessions and semesters
- Manage classes and sections
- Manage subjects
- Assign teachers to classes and subjects
- Configure examinations and assessments
- Generate marksheets
- Manage attendance totals
- Configure school branding
- Review audit logs

### Subject Teacher
- View assigned classes, sections, and subjects
- Enter marks for assigned assessments (per-student form with status/date)
- Enter Term Exam marks per subject — Grade 4+: Class Work (40) + Term Exam (60); Grade 1-3: CT/CW/HW + Attendance
- Save marks with validation

### Class Teacher
- View assigned class and section
- Enter total working days
- Enter student attendance
- Enter exam/assessment marks and per-student remarks for primary classes
- Review attendance totals and percentages

## Features

- ✅ Secure authentication with JWT
- ✅ Role-based access control (Admin, Subject Teacher, Class Teacher)
- ✅ Academic session and semester management
- ✅ Class, section, and subject management
- ✅ Teacher assignments (subject and class teacher)
- ✅ Student management with Excel import preview and validation
- ✅ Assessment configuration with categories
- ✅ Marks entry with validation (student-select form, mobile-friendly)
- ✅ Term Exam marks module — direct Class Work/Term Exam entry per subject
- ✅ Attendance management with percentage calculation
- ✅ Semester result calculation (assessment-based + direct-entry override)
- ✅ Grading policies and GPA
- ✅ PDF marksheet generation with Puppeteer
- ✅ Semester Examination Report cards (per student / whole class ZIP)
- ✅ Bulk PDF downloads (ZIP) for entire classes
- ✅ Excel import/export
- ✅ Responsive design with Tailwind CSS

## Implementation Status

### Backend (Node.js + Express + Prisma)
- ✅ Authentication system with JWT
- ✅ User management (admin, teachers)
- ✅ Academic management (sessions, semesters, classes, sections, subjects)
- ✅ Teacher assignments (subject and class teacher)
- ✅ Student management with CRUD operations
- ✅ Excel import with validation and preview
- ✅ Assessment categories and assessments
- ✅ Marks entry with validation
- ✅ Attendance management
- ✅ Result calculation service
- ✅ PDF generation with Puppeteer
- ✅ ZIP generation for bulk downloads
- ✅ Comprehensive API routes
- ✅ Request validation
- ✅ Error handling middleware

### Frontend (React + Vite + Tailwind)
- ✅ Project setup with Vite
- ✅ Tailwind CSS configuration
- ✅ React Router setup
- ✅ Axios API client
- ✅ Login page
- ✅ Main layout with sidebar navigation
- ✅ Admin dashboard
- ✅ Teacher dashboard
- ✅ Class teacher dashboard
- ✅ Admin pages (sessions, classes, sections, subjects, students, teachers, assessments, results, PDF generation, Excel import)
- ✅ Teacher pages (assessment marks entry, term exam marks entry)
- ✅ Class teacher pages (attendance, exam marks & remarks, student subjects, marksheet preview)
- ✅ Role-based dashboards and navigation

### Database (MySQL + Prisma)
- ✅ Complete Prisma schema with all models
- ✅ Database migrations ready (requires MySQL connection)
- ✅ Seed script with sample data
- ✅ Relationships and indexes

## Known Limitations

1. **MySQL Required**: The application requires MySQL to be running. Database migrations cannot be executed without MySQL.
2. **PDF Dependencies**: Puppeteer bundles Chromium, but on some Linux servers extra system libraries may be required for PDF generation.
3. **Tests**: Only minimal automated tests exist (`server/tests`); most verification is manual.

## Troubleshooting

### MySQL Connection Error

If you get "Can't reach database server at localhost:3306":

1. Ensure MySQL service is running:
   - Windows: Check Services for "MySQL80" or similar
   - Or start from MySQL Workbench

2. Verify credentials in `server/.env`

3. Test connection:
   ```bash
   mysql -u root -p
   ```

### Prisma Migration Error

If migrations fail:

1. Drop and recreate database:
   ```sql
   DROP DATABASE nsd_result_management;
   CREATE DATABASE nsd_result_management;
   ```

2. Run migrations again:
   ```bash
   npx prisma migrate dev --name init
   ```

### Port Already in Use

If port 5000 is in use:
- Change `PORT` in `server/.env`
- Or stop the process using port 5000

## Security Notes

- Change default passwords in production
- Use strong secrets for JWT and session
- Enable HTTPS in production
- Use environment-specific configurations
- Never commit `.env` files
- Regular database backups

## License

ISC
