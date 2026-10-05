-- ====================================================================
-- CAINTA PHOTOGRAPHY STUDIO MIS - LOCAL SQL DATABASE INITIALIZATION SCRIPT
-- Compatible with PostgreSQL and MySQL
-- Generated: August 14, 2026
-- ====================================================================

-- 1. CLEAN EXISTING TABLES (IN REVERSE DEPENDENCY ORDER)
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS photo_proofings;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS faqs;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS print_orders;
DROP TABLE IF EXISTS print_products;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS studios;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS booking_status_history;
DROP TABLE IF EXISTS payment_status_history;
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS media_files;
DROP TABLE IF EXISTS audit_events;

-- ====================================================================
-- 2. CREATE SCHEMAS & TABLES WITH CONSTRAINTS AND INDEXES
-- ====================================================================

-- Users Table (Admin & Studio Owner accounts only)
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, STUDIO_ADMIN, STUDIO_STAFF
    studio_id VARCHAR(50) NULL,  -- Only for STUDIO_ADMIN/STUDIO_STAFF
    contact_number VARCHAR(50) NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additive integrity and controlled-media tables are also available in migrations/001_integrity_foundation.sql.

-- Customers Table (Dedicated table for customer accounts)
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(50) NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Studios Table
CREATE TABLE studios (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_id VARCHAR(50) NOT NULL,
    logo VARCHAR(255) NOT NULL,
    cover_image VARCHAR(255) NOT NULL,
    location VARCHAR(150) NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 0.00,
    review_count INT DEFAULT 0,
    starting_price DECIMAL(10, 2) DEFAULT 0.00,
    categories TEXT NOT NULL, -- Comma-separated or JSON array of category names
    description TEXT NOT NULL,
    address VARCHAR(255) NOT NULL,
    contact_info VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    business_hours VARCHAR(100) NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, under_review, approved, rejected
    printing_available BOOLEAN DEFAULT FALSE,
    latitude DECIMAL(10, 6) NULL,
    longitude DECIMAL(10, 6) NULL,
    business_permit LONGTEXT NULL,
    valid_id LONGTEXT NULL,
    other_docs LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories Table
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services Table
CREATE TABLE services (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    image VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    available_days TEXT NOT NULL, -- Comma-separated e.g. "Monday,Tuesday"
    available_slots TEXT NOT NULL, -- Comma-separated e.g. "09:00 AM,10:00 AM"
    requirements TEXT NOT NULL, -- Comma-separated text list of instructions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Packages Table
CREATE TABLE packages (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    edited_photos_count INT NOT NULL,
    included_prints VARCHAR(150) NOT NULL,
    photographer_count INT DEFAULT 1,
    included_services TEXT NULL, -- Comma-separated related services
    terms_and_conditions TEXT NOT NULL,
    image VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Add-ons Table
CREATE TABLE addons (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    image VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Bookings Table
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    service_id VARCHAR(50) NOT NULL,
    package_id VARCHAR(50) NULL,
    booking_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL,
    addons TEXT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_notes TEXT NULL,
    requirements_doc VARCHAR(255) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    down_payment_amount DECIMAL(10, 2) DEFAULT 0.00,
    remaining_balance DECIMAL(10, 2) DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'Unpaid',
    final_payment_status VARCHAR(50) DEFAULT 'Pending',
    payment_option VARCHAR(50) DEFAULT 'Downpayment',
    payment_due_at TIMESTAMP NULL,
    cancellation_reason TEXT NULL,
    cancelled_by VARCHAR(50) NULL,
    cancelled_at TIMESTAMP NULL,
    agreed_to_terms TINYINT(1) NOT NULL DEFAULT 0,
    agreed_to_terms_at TIMESTAMP NULL,
    reschedule_request TEXT NULL,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    archived_at TIMESTAMP NULL,
    archived_by VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (package_id) REFERENCES packages(id)
);

-- Payments Table
CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    studio_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    amount DECIMAL(10, 2) NOT NULL,
    payment_type VARCHAR(30) NOT NULL DEFAULT 'Downpayment',
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) NOT NULL,
    proof_of_payment TEXT NULL,
    reference_number VARCHAR(100) NULL,
    payment_date TIMESTAMP NOT NULL,
    reviewed_by VARCHAR(50) NULL,
    reviewed_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Print Products Table
CREATE TABLE print_products (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    size VARCHAR(50) NOT NULL, -- e.g. "8R (8x10 in)"
    price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(255) NOT NULL,
    in_stock BOOLEAN DEFAULT TRUE,
    estimated_hours INT DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Print Orders Table
CREATE TABLE print_orders (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    product_id VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 1,
    uploaded_photo TEXT NOT NULL,
    print_design TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    proof_of_payment TEXT NULL,
    reference_number VARCHAR(100) NULL,
    shipping_address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES print_products(id)
);

-- Reviews Table (Customer Reviews — customer_id references customers table)
CREATE TABLE reviews (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    customer_name VARCHAR(100) NOT NULL,
    booking_id VARCHAR(50) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    reply TEXT NULL,
    reply_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Chatbot FAQs (Knowledge Base) Table
CREATE TABLE faqs (
    id VARCHAR(50) PRIMARY KEY,
    studio_id VARCHAR(50) NOT NULL, -- Specific studio ID or 'GLOBAL'
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- FAQ, Studio Info, Services, Booking, Policies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_email VARCHAR(100) NOT NULL,
    action TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50) NULL
);

-- Notifications Table (user_id references either users OR customers by convention; no strict FK to allow both)
CREATE TABLE notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,      -- Can be a users.id or customers.id
    studio_id VARCHAR(50) NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) DEFAULT 'App',
    recipient_contact VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Favorites Table (customer_id references customers table)
CREATE TABLE favorites (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    studio_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

-- Photo Proofing Galleries Table (customer_id references customers table)
CREATE TABLE photo_proofings (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) UNIQUE NOT NULL,
    studio_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,   -- References customers table
    photos TEXT NOT NULL,
    watermark_text VARCHAR(100) NOT NULL,
    watermark_position VARCHAR(50) DEFAULT 'center',
    watermark_opacity DECIMAL(3,2) DEFAULT 0.40,
    final_drive_link TEXT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_studios_owner ON studios(owner_id);
CREATE INDEX idx_services_studio ON services(studio_id);
CREATE INDEX idx_packages_studio ON packages(studio_id);
CREATE INDEX idx_addons_studio ON addons(studio_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_print_orders_status ON print_orders(status);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_faqs_studio ON faqs(studio_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);


-- ====================================================================
-- 3. INSERT HIGH-FIDELITY SEED DATA (SAME AS db.json ENGINES)
-- ====================================================================

-- 1. Users (Admin and Studio Owner accounts)
INSERT INTO users (id, email, password_hash, full_name, role, studio_id, contact_number, address, created_at) VALUES
('u-superadmin', 'admin@caintaphotography.com', '$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G', 'System Super Admin', 'SUPER_ADMIN', NULL, '+63 900 000 0000', 'Cainta Municipal Hall, Rizal', '2026-01-01 00:00:00'),
('u-aperture', 'captures@aperturestudio.com', '$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G', 'Aperture Studio Admin', 'STUDIO_ADMIN', 'st-aperture', '+63 920 888 7777', 'Ground Floor, Rublou Marketplace, Felix Avenue, Cainta, 1900 Rizal', '2026-01-15 01:30:00'),
('u-apex', 'shoot@apexstudios.ph', '$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G', 'Apex Studio Admin', 'STUDIO_ADMIN', 'st-apex', '+63 922 111 2233', 'Bypass Junction, Imelda Avenue, Cainta, 1900 Rizal', '2026-01-16 03:00:00'),
('u-lumina', 'info@luminaportraiture.ph', '$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G', 'Lumina Studio Admin', 'STUDIO_ADMIN', 'st-lumina', '+63 919 444 5555', '3rd Floor, Valley Golf Building, Ortigas Ave Extension, Cainta, 1900 Rizal', '2026-01-15 01:00:00'),
('U-NXFBJBZWS', 'danielpadilla140600@gmail.com', '$2b$10$KWzQUkhlejbbjajhZZSS3ONo1.Onq8MCGV6FDtQ1vWrH9TsHW7D6G', 'Ray Esteban', 'STUDIO_ADMIN', 'ST-3PTND5UV9', '09944839843', 'Narra St. Brgy San Roque Madera Homes Cainta Rizal', '2026-08-21 06:17:04');

-- 2. Customers (Dedicated customer accounts table)
INSERT INTO customers (id, email, password_hash, full_name, contact_number, address, created_at) VALUES
('U-1WG18P7RJ', 'shanangdelacruz55@gmail.com', '$2b$10$/kBD0tJHXk1eGLtz7cVROOYtnb89uW5ulk8SXnuH8N6jILso19jTm', 'STEVE DE LA CRUZ', '78578578', 'Narra St. Brgy San Roque Madera Homes Cainta Rizal', '2026-08-21 06:13:45');

-- 3. Studios (Referencing owner_id in users table)
INSERT INTO studios (id, name, owner_id, logo, cover_image, location, rating, review_count, starting_price, categories, description, address, contact_info, email, business_hours, is_approved, status, printing_available, latitude, longitude, created_at) VALUES
('st-aperture', 'Aperture Wedding & Lifestyle', 'u-aperture', 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&h=600&fit=crop', 'Felix Avenue, Cainta, Rizal', 4.90, 42, 3500.00, 'Wedding Photography,Portrait Photography,Birthday Photography', 'Aperture Wedding & Lifestyle specializes in candid, high-end fine art storyboards for weddings, pre-debuts, and birthdays.', 'Ground Floor, Rublou Marketplace, Felix Avenue, Cainta, 1900 Rizal', '+63 920 888 7777', 'captures@aperturestudio.com', '09:00 AM - 07:00 PM', TRUE, 'approved', TRUE, 14.595400, 121.108500, '2026-01-15 01:30:00'),
('st-apex', 'Apex Capture & Self-Shoot', 'u-apex', 'https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1520854221256-17451cc35953?w=1200&h=600&fit=crop', 'Imelda Avenue, Cainta, Rizal', 4.70, 28, 800.00, 'Self-Shoot Studio,Portrait Photography,ID/Passport Photography', 'The ultimate modern self-shoot studio in Rizal with wireless clickers and zero-pressure private booths.', 'Bypass Junction, Imelda Avenue, Cainta, 1900 Rizal', '+63 922 111 2233', 'shoot@apexstudios.ph', '10:00 AM - 08:00 PM', TRUE, 'approved', TRUE, 14.582500, 121.100200, '2026-01-16 03:00:00'),
('st-lumina', 'Lumina Portraiture Cainta', 'u-lumina', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&h=600&fit=crop', 'Ortigas Avenue Extension, Cainta, Rizal', 4.80, 34, 1500.00, 'Portrait Photography,Graduation Photography,Family Photography', 'Lumina Portraiture delivers premium, high-impact studio portraits and timeless graduation photos.', '3rd Floor, Valley Golf Building, Ortigas Ave Extension, Cainta, 1900 Rizal', '+63 919 444 5555', 'info@luminaportraiture.ph', '09:00 AM - 06:00 PM', TRUE, 'approved', TRUE, 14.588200, 121.127800, '2026-01-15 01:00:00'),
('st-memory', 'Cainta Memory Lens Studio', 'u-superadmin', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&h=600&fit=crop', 'Town Center, San Roque, Cainta, Rizal', 4.80, 19, 1200.00, 'Family Photography,Portrait Photography,Graduation Photography', 'Warm family portraits, baptismal photography, and official document pictures.', 'A. Bonifacio Avenue, Barangay San Roque, Cainta Town Center, 1900 Rizal', '+63 918 333 9988', 'contact@caintamemorylens.com', '08:30 AM - 06:30 PM', TRUE, 'approved', TRUE, 14.577200, 121.122400, '2026-01-18 02:00:00'),
('st-shuttercraft', 'ShutterCraft Studio Vista Verde', 'u-superadmin', 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=1200&h=600&fit=crop', 'Vista Verde, Cainta, Rizal', 4.90, 25, 1800.00, 'Portrait Photography,Self-Shoot Studio,Birthday Photography', 'Boutique creative studio inside Vista Verde Executive Village, Cainta.', 'Phase 1 Main Ave, Vista Verde Executive Village, Cainta, 1900 Rizal', '+63 917 888 1234', 'hello@shuttercraftcainta.com', '09:00 AM - 08:00 PM', TRUE, 'approved', TRUE, 14.601000, 121.112000, '2026-01-20 00:00:00'),
('ST-3PTND5UV9', 'Ray Studios', 'U-NXFBJBZWS', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=100&h=100&fit=crop', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&h=600&fit=crop', 'Cainta, Rizal', 5.00, 0, 1000.00, 'Portrait Photography', 'Newly registered photography studio.', 'Narra St. Brgy San Roque Madera Homes Cainta Rizal', '09944839843', 'danielpadilla140600@gmail.com', '09:00 AM - 06:00 PM', TRUE, 'approved', TRUE, NULL, NULL, '2026-08-21 06:17:04');

-- 4. Categories
INSERT INTO categories (id, name, description, created_at) VALUES
('cat-1', 'Portrait Photography', 'Professional close-up and profile pictures.', '2026-01-01 00:00:00'),
('cat-2', 'Graduation Photography', 'Celebrate milestones with premium cap and gown sessions.', '2026-01-01 00:00:00'),
('cat-3', 'Wedding Photography', 'Timeless storytelling of your special union.', '2026-01-01 00:00:00'),
('cat-4', 'Birthday Photography', 'Joyful celebrations captured beautifully.', '2026-01-01 00:00:00'),
('cat-5', 'Family Photography', 'Cherish precious bonding moments in crisp frames.', '2026-01-01 00:00:00'),
('cat-6', 'Self-Shoot Studio', 'Express yourself freely behind a private clicker.', '2026-01-01 00:00:00'),
('cat-7', 'ID/Passport Photography', 'Official, compliant photos in instant minutes.', '2026-01-01 00:00:00');

-- 5. Services
INSERT INTO services (id, studio_id, name, description, category, base_price, duration_minutes, image, is_active, available_days, available_slots, requirements, created_at) VALUES
('srv-lumina-port', 'st-lumina', 'Standard Corporate Portrait', 'High-end portraiture for LinkedIn, resumes, and corporate branding. Includes multiple lighting setup choices.', 'Portrait Photography', 1500.00, 30, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&fit=crop', TRUE, 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', '09:00 AM,10:00 AM,11:00 AM,01:00 PM,02:00 PM,03:00 PM,04:00 PM,05:00 PM', 'Dress smart/business formal,Booking deposit of 500 PHP', '2026-01-20 10:00:00'),
('srv-lumina-grad', 'st-lumina', 'Premium Graduation Package', 'Formal academic portrait session with toggled toga colors (standard colors for major Rizal colleges/universities).', 'Graduation Photography', 2200.00, 45, 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&fit=crop', TRUE, 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday', '09:00 AM,10:30 AM,01:00 PM,02:30 PM,04:00 PM,05:15 PM', 'Bring own hair accessories,Report 15 minutes before the slot', '2026-01-20 11:00:00'),
('srv-aperture-wedding', 'st-aperture', 'Exclusive Pre-Wedding Session', 'Romantic storytelling session inside our lifestyle sets. Perfect as preparation for wedding invitations.', 'Wedding Photography', 5000.00, 120, 'https://images.unsplash.com/photo-1519225495810-7517c296517d?w=600&fit=crop', TRUE, 'Wednesday,Thursday,Friday,Saturday,Sunday', '09:00 AM,01:00 PM,04:00 PM', 'Pre-consultation required,Up to 3 outfit changes', '2026-01-21 09:00:00'),
('srv-apex-self', 'st-apex', 'Unlimited Self-Shoot (2-4 Pax)', 'Have fun in our private booth. Choose background tones (Gray, White, or Cream). Use props freely.', 'Self-Shoot Studio', 800.00, 45, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&fit=crop', TRUE, 'Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday', '10:00 AM,11:00 AM,12:00 PM,02:00 PM,03:00 PM,04:00 PM,05:00 PM,06:00 PM,07:00 PM', 'Socks required in certain sets,Arrive on time', '2026-01-22 10:00:00');

-- Packages
INSERT INTO packages (id, studio_id, name, description, price, duration_minutes, edited_photos_count, included_prints, photographer_count, included_services, terms_and_conditions, image, is_active, created_at) VALUES
('pkg-lumina-port-gold', 'st-lumina', 'Corporate Gold Studio Bundle', 'The complete portrait suite for professionals looking to refresh their digital profiles.', 2500.00, 45, 3, 'One 8R Print, Two 4R Prints', 1, 'Standard Corporate Portrait', 'Rescheduling allowed up to 48 hours prior. Downpayment is non-refundable.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&fit=crop', TRUE, '2026-01-20 10:30:00'),
('pkg-lumina-grad-royal', 'st-lumina', 'Royal Academic Graduation Package', 'Full-coverage graduation portraits containing formal closeups, family frames, and a creative shoot.', 3800.00, 60, 5, 'One 10R Framed Print, Four Wallet-size Prints', 1, 'Premium Graduation Package', 'Includes toga and hood rental. Makeup not included.', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&fit=crop', TRUE, '2026-01-20 11:15:00'),
('pkg-aperture-wedding-silver', 'st-aperture', 'Elegance Pre-Wedding Album', 'Timeless wedding teaser session providing a high-quality wood frame and physical album.', 8500.00, 120, 15, 'One 16x20 Canvas Print, 20-Page Portrait Album', 2, 'Exclusive Pre-Wedding Session', 'Outdoor styling options available. Additional rates apply for travel out of Cainta.', 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&fit=crop', TRUE, '2026-01-21 09:30:00'),
('pkg-apex-self-unlimited', 'st-apex', 'Apex Elite Self-Shoot Block', 'Enjoy full control of the camera. Access all backdrops and get all digital files via link.', 1200.00, 60, 10, 'Four 4R grid sheets', 0, 'Unlimited Self-Shoot (2-4 Pax)', 'Time extension starts at 300 PHP / 15 mins.', 'https://images.unsplash.com/photo-1520854221256-17451cc35953?w=600&fit=crop', TRUE, '2026-01-22 10:15:00');

-- Addons
INSERT INTO addons (id, studio_id, name, price, description, created_at) VALUES
('add-1', 'st-lumina', 'Additional Retouched Photo', 300.00, 'Professional skin cleanup, lighting adjustment, and color styling.', '2026-01-20 10:45:00'),
('add-2', 'st-lumina', 'Professional Hair & Makeup', 1200.00, 'On-site artist for a clean, natural camera-ready look.', '2026-01-20 10:45:00'),
('add-3', 'st-aperture', 'Additional Hour of Studio Use', 1500.00, 'Extend your pre-wedding story layouts with extra sets.', '2026-01-21 09:45:00'),
('add-4', 'st-apex', 'Furry Friend/Pet Companion', 200.00, 'Bring your favorite pet to strike a pose inside the booth.', '2026-01-22 10:30:00');

-- Seed complete (Cleaned - users and user-generated data are managed through app workflows)
-- ====================================================================

