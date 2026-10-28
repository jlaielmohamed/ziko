-- 1. TABLES SETUP
-- -----------------------------------------------------

-- Table for services
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Table for general shop configuration
CREATE TABLE IF NOT EXISTS overview (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    barbers TEXT[] DEFAULT '{ "Wassime", "Yacine" }',
    business_hours JSONB DEFAULT '{
        "0": ["10:00", "22:00"],
        "1": ["10:00", "22:00"],
        "2": ["10:00", "22:00"],
        "3": null,
        "4": ["10:00", "22:00"],
        "5": ["10:00", "22:00"],
        "6": ["10:00", "22:00"]
    }'::jsonb,
    shop_settings JSONB DEFAULT '{
        "shopName": "Ziko Hairstyle",
        "location": "Sfax, Tunisia",
        "phone": "+216 29 090 385",
        "email": "mohamedjlaiel4000@gmail.com",
        "instagram": "https://www.instagram.com/ziko_hairstyle/"
    }'::jsonb
);

-- Table for blocked dates
CREATE TABLE IF NOT EXISTS blocked_dates (
    date DATE PRIMARY KEY
);

-- Table for bookings
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    created_at TEXT,
    created_iso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    service_id TEXT REFERENCES services(id),
    service_name TEXT,
    price DECIMAL,
    appointment_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'Requested', -- Requested, Confirmed, Completed, Cancelled
    barber TEXT,
    lang TEXT DEFAULT 'en',
    calendar_event_id TEXT
);

-- Table for admin users
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id)
);

-- 2. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE overview ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Public: Can read services, overview, and blocked dates
CREATE POLICY "Public Read Services" ON services FOR SELECT USING (true);
CREATE POLICY "Public Read Overview" ON overview FOR SELECT USING (true);
CREATE POLICY "Public Read Blocked Dates" ON blocked_dates FOR SELECT USING (true);

-- Public: Can create appointments, but not edit others'
CREATE POLICY "Public Insert Appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Read Appointments" ON appointments FOR SELECT USING (true);

-- Admins: Full access to everything
CREATE POLICY "Admin Full Access Services" ON services FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Full Access Overview" ON overview FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Full Access Blocked" ON blocked_dates FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Full Access Appts" ON appointments FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
CREATE POLICY "Admin Read Own User" ON admin_users FOR SELECT USING (auth.uid() = user_id);

-- 3. ADMIN FUNCTION (RPC)
-- -----------------------------------------------------
-- This function allows the admin panel to save all settings in one call
CREATE OR REPLACE FUNCTION save_shop_config(
    p_services JSONB,
    p_barbers TEXT[],
    p_business_hours JSONB,
    p_shop_settings JSONB,
    p_blocked_dates TEXT[]
) RETURNS void AS $$
BEGIN
    -- Update Overview
    UPDATE overview
    SET barbers = p_barbers,
        business_hours = p_business_hours,
        shop_settings = p_shop_settings
    WHERE id = true;

    -- Sync Services (Delete and Re-insert for simplicity)
    DELETE FROM services;
    INSERT INTO services (id, name, duration_minutes, price, description, sort_order)
    SELECT (val->>'id'), (val->>'name'), (val->>'duration_minutes')::int, (val->>'price')::decimal, (val->>'description'), (row_number() OVER ())-1
    FROM jsonb_array_elements(p_services) AS val;

    -- Sync Blocked Dates
    DELETE FROM blocked_dates;
    INSERT INTO blocked_dates (date)
    SELECT CAST(val AS DATE) FROM unnest(p_blocked_dates) AS val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. INITIAL DATA
-- -----------------------------------------------------
INSERT INTO overview (id, barbers, business_hours, shop_settings)
VALUES (true, '{ "Wassime", "Yacine" }',
'{ "0": ["10:00", "22:00"], "1": ["10:00", "22:00"], "2": ["10:00", "22:00"], "3": null, "4": ["10:00", "22:00"], "5": ["10:00", "22:00"], "6": ["10:00", "22:00"] }',
'{ "shopName": "Ziko Hairstyle", "location": "Sfax, Tunisia", "phone": "+216 29 090 385", "email": "mohamedjlaiel4000@gmail.com" }')
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, name, duration_minutes, price, description, sort_order) VALUES
('haircut', 'Haircut', 30, 15, 'A clean, considered cut shaped around you.', 0),
('beard', 'Beard Trim', 20, 8, 'Clean lines and a balanced shape, finished right.', 1),
('both', 'Haircut + Beard', 45, 20, 'The full refresh: cut, beard and a polished finish.', 2),
('kids', 'Kids'' Cut', 25, 10, 'A comfortable, patient cut for younger clients.', 3)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    duration_minutes = EXCLUDED.duration_minutes,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;
