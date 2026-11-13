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
3. **npm** or **yarn**

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ResultManagementSystem
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

### 3. Set up environment variables

Copy the example environment file:

```bash
cp .env.example server/.env
```

Edit `server/.env` and update the database URL with your MySQL credentials:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/nsd_result_management"
PORT=5000
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your-session-secret-here-change-in-production
JWT_SECRET=your-jwt-secret-here-change-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### 4. Install dependencies

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

### 5. Run Prisma migrations

```bash
cd server
npx prisma migrate dev --name init
```

### 6. Seed the database

```bash
cd server
npm run prisma:seed
```

This will create:
- Admin user: `admin@newschooldhaka.edu` / `Admin@123`
- Sample teachers
- Sample students
- Academic sessions
- Classes, sections, and subjects
- Assessment categories
- Grading policy

## Development

### Start the backend server

```bash
cd server
npm run dev
```

The server will run on `http://localhost:5000`

### Start the frontend development server

In a new terminal:

```bash
cd client
npm run dev
```

The frontend will run on `http://localhost:5173`

## Production Build

### Build the frontend

```bash
cd client
npm run build
```

### Start the backend in production mode

```bash
cd server
npm start
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
- Enter marks for assigned assessments
- Save draft marks
- Submit marks for review
- View submission status

### Class Teacher
- View assigned class and section
- Enter total working days
- Enter student attendance
- Review attendance totals and percentages

## Features

- ✅ Secure authentication with JWT
- ✅ Role-based access control (Admin, Subject Teacher, Class Teacher)
- ✅ Academic session and semester management
- ✅ Class, section, and subject management
- ✅ Teacher assignments (subject and class teacher)
- ✅ Student management with Excel import preview and validation
- ✅ Assessment configuration with categories
- ✅ Marks entry with validation and draft saving
- ✅ Attendance management with percentage calculation
- ✅ Result calculation with configurable grading policies
- ✅ PDF marksheet generation with Puppeteer
- ✅ Bulk PDF downloads (ZIP) for entire classes
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
- ⏳ Additional pages (students, teachers, assessments, marks entry, etc.) - To be implemented

### Database (MySQL + Prisma)
- ✅ Complete Prisma schema with all models
- ✅ Database migrations ready (requires MySQL connection)
- ✅ Seed script with sample data
- ✅ Relationships and indexes

## Known Limitations

1. **MySQL Required**: The application requires MySQL to be running. Database migrations cannot be executed without MySQL.
2. **Frontend Pages**: Only basic dashboard pages are implemented. Full CRUD pages for students, teachers, assessments, marks entry, etc. need to be built.
3. **PDF Testing**: PDF generation requires Puppeteer which may need additional dependencies on some systems.
4. **Tests**: Automated tests have not been implemented yet.
5. **Audit Logging**: Audit log model exists but logging middleware is not fully implemented.

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
