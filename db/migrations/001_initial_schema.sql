-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'processor', 'outlet_manager', 'warehouse_manager', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'dispatched', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fish_grade AS ENUM ('A', 'B', 'C');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fish_status AS ENUM ('received', 'processed', 'graded', 'stored', 'dispatched');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE condition_type AS ENUM ('excellent', 'good', 'fair', 'poor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Farmers table
CREATE TABLE IF NOT EXISTS farmers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    location VARCHAR(200) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0.0,
    reliability VARCHAR(20) DEFAULT 'fair',
    status VARCHAR(20) DEFAULT 'active',
    average_fish_size DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouse entries table
CREATE TABLE IF NOT EXISTS warehouse_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL,
    total_weight DECIMAL(10,2) NOT NULL,
    total_pieces INTEGER NOT NULL,
    received_by UUID REFERENCES users(id),
    condition condition_type NOT NULL,
    temperature DECIMAL(4,2),
    farmer_id UUID REFERENCES farmers(id),
    price_per_kg DECIMAL(10,2) NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fish inventory table
CREATE TABLE IF NOT EXISTS fish_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_entry_id UUID REFERENCES warehouse_entries(id),
    size INTEGER NOT NULL CHECK (size >= 0 AND size <= 10),
    weight DECIMAL(8,2) NOT NULL,
    grade fish_grade NOT NULL,
    status fish_status DEFAULT 'received',
    entry_date DATE NOT NULL,
    location VARCHAR(100),
    farmer_id UUID REFERENCES farmers(id),
    price_per_kg DECIMAL(10,2) NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    ready_for_dispatch BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing records table
CREATE TABLE IF NOT EXISTS processing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_entry_id UUID REFERENCES warehouse_entries(id),
    processing_date DATE NOT NULL,
    processed_by UUID REFERENCES users(id),
    pre_processing_weight DECIMAL(10,2) NOT NULL,
    post_processing_weight DECIMAL(10,2) NOT NULL,
    processing_waste DECIMAL(10,2) NOT NULL,
    processing_yield DECIMAL(5,2) NOT NULL,
    size_distribution JSONB NOT NULL,
    grading_results JSONB NOT NULL,
    final_value DECIMAL(12,2) NOT NULL,
    ready_for_dispatch_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    manager_name VARCHAR(200),
    manager_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outlet orders table
CREATE TABLE IF NOT EXISTS outlet_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID REFERENCES outlets(id),
    order_date DATE NOT NULL,
    requested_sizes INTEGER[] NOT NULL,
    requested_quantity INTEGER NOT NULL,
    requested_grade fish_grade,
    price_per_kg DECIMAL(10,2) NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    status order_status DEFAULT 'pending',
    confirmed_date DATE,
    dispatch_date DATE,
    completed_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispatch records table
CREATE TABLE IF NOT EXISTS dispatch_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_order_id UUID REFERENCES outlet_orders(id),
    fish_ids UUID[] NOT NULL,
    destination VARCHAR(200) NOT NULL,
    dispatch_date DATE NOT NULL,
    dispatched_by UUID REFERENCES users(id),
    total_weight DECIMAL(10,2) NOT NULL,
    total_pieces INTEGER NOT NULL,
    size_breakdown JSONB NOT NULL,
    total_value DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outlet receiving table
CREATE TABLE IF NOT EXISTS outlet_receiving (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispatch_id UUID REFERENCES dispatch_records(id),
    outlet_order_id UUID REFERENCES outlet_orders(id),
    received_date DATE NOT NULL,
    received_by UUID REFERENCES users(id),
    expected_weight DECIMAL(10,2) NOT NULL,
    actual_weight_received DECIMAL(10,2) NOT NULL,
    expected_pieces INTEGER NOT NULL,
    actual_pieces_received INTEGER NOT NULL,
    expected_value DECIMAL(12,2) NOT NULL,
    actual_value_received DECIMAL(12,2) NOT NULL,
    condition condition_type NOT NULL,
    size_discrepancies JSONB,
    discrepancy_notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create indexes with error handling for tables that might not exist
DO $$ 
DECLARE
    table_exists boolean;
BEGIN
    -- Check if fish_inventory table exists before creating indexes
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fish_inventory'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check if size column exists
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'fish_inventory' 
            AND column_name = 'size'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_fish_inventory_size ON fish_inventory(size);
        ELSE
            RAISE NOTICE 'size column does not exist in fish_inventory table, skipping index creation';
        END IF;
        
        -- Check if status column exists
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'fish_inventory' 
            AND column_name = 'status'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_fish_inventory_status ON fish_inventory(status);
        ELSE
            RAISE NOTICE 'status column does not exist in fish_inventory table, skipping index creation';
        END IF;
    ELSE
        RAISE NOTICE 'fish_inventory table does not exist, skipping index creation';
    END IF;
END $$;

DO $$ 
DECLARE
    table_exists boolean;
BEGIN
    -- Check if outlet_orders table exists before creating indexes
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'outlet_orders'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check if status column exists
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'outlet_orders' 
            AND column_name = 'status'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_outlet_orders_status ON outlet_orders(status);
        ELSE
            RAISE NOTICE 'status column does not exist in outlet_orders table, skipping index creation';
        END IF;
        
        -- Check if outlet_id column exists
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'outlet_orders' 
            AND column_name = 'outlet_id'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_outlet_orders_outlet_id ON outlet_orders(outlet_id);
        ELSE
            RAISE NOTICE 'outlet_id column does not exist in outlet_orders table, skipping index creation';
        END IF;
    ELSE
        RAISE NOTICE 'outlet_orders table does not exist, skipping index creation';
    END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_farmers_updated_at ON farmers;
CREATE TRIGGER update_farmers_updated_at BEFORE UPDATE ON farmers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_warehouse_entries_updated_at ON warehouse_entries;
CREATE TRIGGER update_warehouse_entries_updated_at BEFORE UPDATE ON warehouse_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_fish_inventory_updated_at ON fish_inventory;
CREATE TRIGGER update_fish_inventory_updated_at BEFORE UPDATE ON fish_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_processing_records_updated_at ON processing_records;
CREATE TRIGGER update_processing_records_updated_at BEFORE UPDATE ON processing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_outlets_updated_at ON outlets;
CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_outlet_orders_updated_at ON outlet_orders;
CREATE TRIGGER update_outlet_orders_updated_at BEFORE UPDATE ON outlet_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_dispatch_records_updated_at ON dispatch_records;
CREATE TRIGGER update_dispatch_records_updated_at BEFORE UPDATE ON dispatch_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_outlet_receiving_updated_at ON outlet_receiving;
CREATE TRIGGER update_outlet_receiving_updated_at BEFORE UPDATE ON outlet_receiving FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    user_id_val UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Try to get user_id from created_by, fallback to NULL if column doesn't exist
        BEGIN
            user_id_val := NEW.created_by;
        EXCEPTION
            WHEN undefined_column THEN
                user_id_val := NULL;
        END;
        
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
        VALUES (user_id_val, 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Try to get user_id from updated_by, fallback to created_by, then NULL
        BEGIN
            user_id_val := NEW.updated_by;
        EXCEPTION
            WHEN undefined_column THEN
                BEGIN
                    user_id_val := NEW.created_by;
                EXCEPTION
                    WHEN undefined_column THEN
                        user_id_val := NULL;
                END;
        END;
        
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
        VALUES (user_id_val, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Try to get user_id from updated_by, fallback to created_by, then NULL
        BEGIN
            user_id_val := OLD.updated_by;
        EXCEPTION
            WHEN undefined_column THEN
                BEGIN
                    user_id_val := OLD.created_by;
                EXCEPTION
                    WHEN undefined_column THEN
                        user_id_val := NULL;
                END;
        END;
        
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values)
        VALUES (user_id_val, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add foreign key constraints after all tables are created
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- No hardcoded users - all users should be created through the application interface
-- This ensures proper user management, security, and audit trails
