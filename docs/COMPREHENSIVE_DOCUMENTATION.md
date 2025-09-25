# 🐟 RioFish Fish Management System - Comprehensive Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Setup Instructions](#setup-instructions)
4. [User Management & Authentication](#user-management--authentication)
5. [Database Schema](#database-schema)
6. [Core Modules](#core-modules)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Development Guide](#development-guide)
10. [Deployment](#deployment)

---

## Project Overview

The RioFish Fish Management System is a comprehensive Progressive Web Application (PWA) designed for managing fish farming, processing, sorting, and distribution operations. The system provides role-based access control, inventory management, order processing, and complete audit trails.

### Key Features
- 🎯 **Role-Based Access Control (RBAC)** - 6 user roles with granular permissions
- 🐟 **Complete Fish Lifecycle Management** - From farming to distribution
- 📊 **Real-time Inventory Tracking** - Size-based inventory with safe order dispatch
- 🔄 **Processing & Sorting Workflow** - Mandatory sorting step with size classification
- 📈 **Comprehensive Reporting** - Analytics and audit trails
- 🔐 **Enterprise Security** - Row-level security and audit logging
- 📱 **Progressive Web App** - Works on desktop and mobile devices

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **UI Components**: Radix UI, Lucide React
- **State Management**: React Context API
- **Database**: PostgreSQL with Row Level Security (RLS)

---

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Supabase      │    │   Database      │
│   (React PWA)   │◄──►│   (Backend)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Workflow
```
Fish Entry → Processing → Sorting (Size 0-10) → Inventory → Orders → Dispatch
```

### User Roles & Permissions
1. **Administrator** - Full system access and user management
2. **Fish Processor** - Processing operations and quality control
3. **Fish Farmer** - Farming operations and harvest management
4. **Outlet Manager** - Sales management and customer relations
5. **Warehouse Manager** - Inventory control and logistics
6. **Viewer** - Read-only access to system data

---

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Git

### Quick Start

1. **Clone and Install**
```bash
git clone <repository-url>
cd fish-management
npm install
```

2. **Environment Setup**
```bash
# Create environment file
cp .env.example .env

# Edit .env with your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Database Setup**
```bash
# Run database migrations
npm run setup-db

# Create initial users
npm run setup-users
```

4. **Start Development Server**
```bash
npm run dev
```

5. **Access Application**
- Open http://localhost:5173
- Login with default admin credentials:
  - Email: `admin@riofish.com`
  - Password: `admin123`

### Manual Database Setup

If automated setup fails, run these SQL files in order:
1. `db/migrations/001_initial_schema.sql`
2. `db/migrations/002_role_management.sql`
3. `db/migrations/003_fix_auth_integration.sql`

---

## User Management & Authentication

### Authentication System
The system uses Supabase Auth with JWT tokens and includes:
- Secure user authentication
- Session management
- Profile management
- Role-based access control

### User Creation Process

#### Method 1: Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Fill in email and password
4. Check "Auto Confirm User"
5. Create user
6. Edit profile in the app to assign role

#### Method 2: SQL Script
```sql
-- Create user with profile
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (gen_random_uuid(), 'user@example.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());
```

### Permission System
Permissions follow the pattern: `action:resource`

**Actions**: `read`, `write`, `delete`, `admin`, `export`, `audit`
**Resources**: `users`, `inventory`, `processing`, `sales`, `logistics`, `farming`, `audit`, `system`

**Examples**:
- `read:inventory` - Can view inventory data
- `write:processing` - Can create and modify processing records
- `admin:*` - Full administrative access

---

## Database Schema

### Core Tables

#### Users & Authentication
- `profiles` - Extended user profiles linked to Supabase Auth
- `user_roles` - Role definitions with permissions
- `user_sessions` - Active session tracking
- `audit_logs` - Comprehensive audit trail

#### Fish Management
- `fish_inventory` - Current fish inventory by size
- `warehouse_entries` - Fish entry records
- `processing_records` - Fish processing operations
- `sorting_batches` - Fish sorting operations
- `sorted_fish_items` - Individual sorted fish items
- `sorting_results` - Aggregated sorting results

#### Orders & Sales
- `outlet_orders` - Outlet order records
- `order_items` - Individual items within orders
- `dispatch_records` - Order dispatch tracking

#### Configuration
- `size_class_thresholds` - Fish size classification (0-10)
- `system_config` - System-wide configuration

### Key Relationships
```
profiles (1) ←→ (many) warehouse_entries
profiles (1) ←→ (many) processing_records
processing_records (1) ←→ (1) sorting_batches
sorting_batches (1) ←→ (many) sorted_fish_items
outlet_orders (1) ←→ (many) order_items
```

---

## Core Modules

### 1. Inventory Management System

#### Features
- Size-based inventory tracking (sizes 0-10)
- Safe order dispatch (prevents overselling)
- Complete audit trail
- Real-time stock levels

#### Key Functions
```sql
-- Add stock to inventory
SELECT add_stock(size, quantity, entry_type, reference_id, notes);

-- Dispatch order safely
SELECT dispatch_order(order_id);

-- Get current inventory
SELECT * FROM get_inventory_totals();
```

### 2. Fish Sorting Module

#### Workflow
```
Processing → Sorting (Size Classification) → Inventory
```

#### Size Classes (0-10)
- Class 0: 0-99.99g (Extra Small)
- Class 1: 100-199.99g (Very Small)
- Class 2: 200-299.99g (Small)
- Class 3: 300-499.99g (Small-Medium)
- Class 4: 500-699.99g (Medium)
- Class 5: 700-999.99g (Medium-Large)
- Class 6: 1000-1499.99g (Large)
- Class 7: 1500-1999.99g (Very Large)
- Class 8: 2000-2999.99g (Extra Large)
- Class 9: 3000-4999.99g (Jumbo)
- Class 10: 5000g+ (Giant)

#### Key Functions
```sql
-- Create sorting batch
SELECT create_sorting_batch(processing_record_id, batch_number, sorted_by);

-- Add sorted fish item
SELECT add_sorted_fish_item(batch_id, weight_grams, length_cm, grade, notes);

-- Complete sorting batch
SELECT complete_sorting_batch(batch_id);
```

### 3. Order Management System

#### Features
- Outlet order creation and management
- Safe order dispatch with stock validation
- Order status tracking
- Complete order history

#### Order Status Flow
```
Pending → Dispatched/Failed
```

### 4. Processing Management

#### Features
- Fish processing workflow
- Quality control tracking
- Processing yield management
- Integration with sorting module

### 5. Reporting & Analytics

#### Available Reports
- Inventory reports (by size, weight, time period)
- Processing reports (yields, quality metrics)
- Order reports (sales, dispatch status)
- User activity reports
- Audit trail reports

---

## API Reference

### Frontend Services

#### FishService (`src/services/database.ts`)
```typescript
// Inventory operations
await fishService.getInventory();
await fishService.addStock(data);
await fishService.updateStock(id, data);

// Processing operations
await fishService.getProcessingRecords();
await fishService.createProcessingRecord(data);

// Sorting operations
await fishService.getSortingBatches();
await fishService.createSortingBatch(data);
```

#### SortingService (`src/services/sortingService.ts`)
```typescript
// Size class management
await sortingService.getSizeClassThresholds();
await sortingService.updateSizeClassThresholds(thresholds);

// Sorting operations
await sortingService.createSortingBatch(data);
await sortingService.addSortedFishItem(data);
await sortingService.completeSortingBatch(batchId);
```

### Database Functions

#### Inventory Functions
- `add_stock(size, quantity, entry_type, reference_id, notes)`
- `dispatch_order(order_id)`
- `get_inventory_totals()`
- `get_inventory_history(size, limit)`

#### Sorting Functions
- `get_size_class_for_weight(weight_grams)`
- `create_sorting_batch(processing_record_id, batch_number, sorted_by)`
- `add_sorted_fish_item(batch_id, weight_grams, length_cm, grade, notes)`
- `complete_sorting_batch(batch_id)`

#### Order Functions
- `create_order(outlet_name, items, notes)`
- `get_order_details(order_id)`
- `get_orders_by_status(status)`

---

## Troubleshooting

### Common Issues

#### 1. Authentication Issues
**Problem**: Users can't sign in
**Solutions**:
- Verify Supabase credentials in `.env`
- Check if user exists in Supabase Dashboard
- Ensure user profile is created in `profiles` table

#### 2. Permission Denied Errors
**Problem**: 403 Forbidden errors
**Solutions**:
- Check user role assignment
- Verify RLS policies
- Ensure proper permission configuration

#### 3. Database Connection Issues
**Problem**: Can't connect to database
**Solutions**:
- Verify Supabase URL and keys
- Check network connectivity
- Ensure database migrations are run

#### 4. Sorting Module Issues
**Problem**: "Processing record already sorted"
**Solutions**:
- Check if sorting batch exists for processing record
- Use `getProcessingRecordsReadyForSorting()` to find unsorted records

### Debug Queries

```sql
-- Check user permissions
SELECT * FROM get_user_permissions('user-id');

-- Check inventory levels
SELECT * FROM get_inventory_totals();

-- Check sorting batches
SELECT * FROM sorting_batches ORDER BY created_at DESC;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

---

## Development Guide

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── AuthContext.tsx # Authentication context
│   ├── UserManagement.tsx # User management
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Authentication hook
│   ├── usePermissions.ts # Permission management
│   └── ...
├── services/           # API services
│   ├── database.ts     # Database operations
│   ├── sortingService.ts # Sorting operations
│   └── ...
├── types/              # TypeScript type definitions
├── lib/                # Utility libraries
└── styles/             # CSS styles
```

### Adding New Features

1. **Create Database Schema**
   - Add tables to migration files
   - Create RLS policies
   - Add necessary functions

2. **Create TypeScript Types**
   - Define interfaces in `types/index.ts`
   - Update service types

3. **Create Service Functions**
   - Add methods to appropriate service files
   - Include error handling and validation

4. **Create React Components**
   - Build UI components
   - Add permission checks
   - Integrate with services

5. **Update Navigation**
   - Add menu items with proper permissions
   - Update routing

### Code Standards

- Use TypeScript for all new code
- Follow React best practices
- Include proper error handling
- Add permission checks for all operations
- Write comprehensive tests
- Document all functions and components

---

## Deployment

### Production Setup

1. **Environment Configuration**
```env
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
```

2. **Build Application**
```bash
npm run build
```

3. **Deploy to Hosting**
- Upload `build/` folder to your hosting provider
- Configure redirects for SPA routing
- Set up HTTPS

### cPanel Deployment

1. **Upload Files**
   - Upload all files to public_html
   - Ensure proper file permissions

2. **Database Setup**
   - Run migration scripts in Supabase
   - Configure production database

3. **Configuration**
   - Update environment variables
   - Test all functionality

### Security Considerations

- Never expose service role keys to frontend
- Use RLS policies for data protection
- Regular security audits
- Monitor audit logs
- Keep dependencies updated

---

## Support & Maintenance

### Regular Maintenance Tasks

1. **Database Maintenance**
   - Monitor query performance
   - Update statistics
   - Clean up old audit logs

2. **Security Updates**
   - Update dependencies regularly
   - Review user permissions
   - Monitor audit logs

3. **Backup Strategy**
   - Regular database backups
   - Test restore procedures
   - Document recovery processes

### Getting Help

1. Check this documentation first
2. Review troubleshooting section
3. Check Supabase logs
4. Contact development team

---

## Changelog

### Version 1.0.0
- Initial release with core functionality
- Role-based access control
- Inventory management system
- Fish sorting module
- Order management
- Comprehensive reporting

---

*This documentation is maintained by the RioFish development team. For updates or questions, please contact the development team.*
