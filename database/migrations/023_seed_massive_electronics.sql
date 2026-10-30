-- Migration 023: Massive Electronics Seeding (40+ Products & 6 Categories for demo-store)
-- Automatically resolves tenant_id from store_settings where slug = 'demo-store'

DO $$
DECLARE
    v_tenant_id INTEGER;
    v_cat_pcs INTEGER;
    v_cat_laptops INTEGER;
    v_cat_monitors INTEGER;
    v_cat_peripherals INTEGER;
    v_cat_audio INTEGER;
    v_cat_smarthome INTEGER;
BEGIN
    -- 1. Resolve tenant_id for demo-store
    SELECT tenant_id INTO v_tenant_id FROM store_settings WHERE slug = 'demo-store' LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        v_tenant_id := 1;
    END IF;

    RAISE NOTICE 'Seeding massive electronics for tenant_id: %', v_tenant_id;

    -- 2. Insert 6 Categories
    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Custom PCs')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_pcs FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Custom PCs' LIMIT 1;

    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Laptops')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_laptops FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Laptops' LIMIT 1;

    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Monitors')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_monitors FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Monitors' LIMIT 1;

    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Peripherals')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_peripherals FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Peripherals' LIMIT 1;

    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Audio & Headsets')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_audio FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Audio & Headsets' LIMIT 1;

    INSERT INTO tbl_categories (tenant_id, name) VALUES (v_tenant_id, 'Smart Home')
    ON CONFLICT DO NOTHING;
    SELECT id INTO v_cat_smarthome FROM tbl_categories WHERE tenant_id = v_tenant_id AND name = 'Smart Home' LIMIT 1;

    -- 3. Insert Custom PCs (7 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_pcs, 'Titan X Pro Gaming Rig', 'កុំព្យូទ័រលេងហ្គេម Titan X Pro', 'RTX 4090, i9-14900K, 64GB DDR5 RAM, 2TB NVMe SSD. Ultimate performance for 4K gaming and AI rendering.', 'RTX 4090, i9-14900K, 64GB RAM', 3499.00, 2900.00, 15, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'CyberPower Blackout Edition', 'កុំព្យូទ័រ CyberPower Blackout', 'RTX 4080 Super, i7-14700KF, 32GB RAM, 1TB SSD. Liquid cooled custom loop.', 'RTX 4080 Super, i7-14700KF', 2499.00, 2100.00, 20, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'Apex Velocity Compact Rig', 'កុំព្យូទ័រ Apex Velocity', 'RTX 4070 Ti, Ryzen 7 7800X3D, 32GB RAM, 1TB NVMe. High refresh rate eSports beast.', 'RTX 4070 Ti, Ryzen 7 7800X3D', 1899.00, 1550.00, 25, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'Phantom Ultra Gaming Station', 'កុំព្យូទ័រ Phantom Ultra', 'RTX 4090, AMD Threadripper, 128GB RAM, 4TB RAID. Enterprise workstation and gaming powerhouse.', 'RTX 4090, Threadripper', 5299.00, 4500.00, 8, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'Neon Genesis RGB Desktop', 'កុំព្យូទ័រ Neon Genesis', 'RTX 4060 Ti, i5-14400F, 16GB RAM, 1TB SSD. Stunning RGB tempered glass chassis.', 'RTX 4060 Ti, i5-14400F', 1199.00, 950.00, 30, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'Horizon Mini-ITX Rig', 'កុំព្យូទ័រ Horizon Mini-ITX', 'RTX 4070, Ryzen 5 7600X, 32GB RAM, 1TB SSD. Space-saving portable powerhouse.', 'RTX 4070, Ryzen 5 7600X', 1499.00, 1200.00, 18, 'Active', true),
    (v_tenant_id, v_cat_pcs, 'Stealth Workstation Pro', 'កុំព្យូទ័រ Stealth Workstation', 'Quadro RTX 6000, Intel Xeon w9, 128GB ECC RAM. Engineered for 3D animation and CAD.', 'Quadro RTX 6000, Xeon w9', 4599.00, 3900.00, 10, 'Active', true);

    -- 4. Insert Laptops (7 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_laptops, 'Razer Blade 16 OLED', 'ឡាស្តុប Razer Blade 16', 'i9-14900HX, RTX 4090, 32GB RAM, 2TB SSD, 16" Dual-Mode Mini-LED display.', 'i9-14900HX, RTX 4090', 3299.00, 2750.00, 12, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'ASUS ROG Zephyrus G14', 'ឡាស្តុប ASUS ROG Zephyrus G14', 'Ryzen 9 8945HS, RTX 4070, 32GB RAM, 1TB SSD, 14" 3K OLED 120Hz.', 'Ryzen 9, RTX 4070', 1999.00, 1650.00, 22, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'MacBook Pro 16 M3 Max', 'ឡាស្តុប MacBook Pro 16', 'Apple M3 Max (16-core CPU, 40-core GPU), 64GB RAM, 1TB SSD. Space Black.', 'Apple M3 Max, 64GB RAM', 3499.00, 3000.00, 15, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'Lenovo Legion Pro 7i', 'ឡាស្តុប Lenovo Legion Pro 7i', 'i9-14900HX, RTX 4080, 32GB RAM, 1TB SSD, 16" 240Hz IPS.', 'i9-14900HX, RTX 4080', 2499.00, 2100.00, 18, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'MSI Raider GE78 HX', 'ឡាស្តុប MSI Raider GE78 HX', 'i9-14900HX, RTX 4090, 64GB RAM, 2TB SSD, Mystic Light bar.', 'i9-14900HX, RTX 4090', 2899.00, 2400.00, 10, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'Dell XPS 16 Creator Edition', 'ឡាស្តុប Dell XPS 16', 'Intel Core Ultra 7, RTX 4070, 32GB RAM, 1TB SSD, 4K+ Touch display.', 'Ultra 7, RTX 4070', 2199.00, 1850.00, 14, 'Active', true),
    (v_tenant_id, v_cat_laptops, 'Acer Predator Triton 17 X', 'ឡាស្តុប Acer Predator Triton', 'i9-13900HX, RTX 4090, 32GB RAM, 1TB SSD, CNC unibody chassis.', 'i9, RTX 4090', 3199.00, 2700.00, 8, 'Active', true);

    -- 5. Insert Monitors (7 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_monitors, 'Samsung Odyssey OLED G9 49"', 'អេក្រង់ Samsung Odyssey G9', '49" Dual Quad HD 5120x1440, 240Hz, 0.03ms response, Curved QD-OLED.', '49" 240Hz QD-OLED', 1599.00, 1300.00, 10, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'LG UltraGear 32GS95UE', 'អេក្រង់ LG UltraGear 32"', '32" 4K OLED dual-mode (4K 240Hz / FHD 480Hz), Pixel Sound technology.', '32" 4K 240Hz OLED', 1399.00, 1150.00, 14, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'ASUS ROG Swift PG32UCDM', 'អេក្រង់ ASUS ROG Swift 32"', '32" 4K UHD QD-OLED 240Hz gaming monitor with heatsink and G-Sync.', '32" 4K QD-OLED', 1299.00, 1050.00, 12, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'Dell Alienware AW3225QF', 'អេក្រង់ Alienware AW3225QF 32"', '32" 4K Curved QD-OLED 240Hz, Dolby Vision HDR, Dolby Atmos pass-through.', '32" 4K Curved OLED', 1199.00, 980.00, 16, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'Gigabyte M32U 4K Gaming Monitor', 'អេក្រង់ Gigabyte M32U 32"', '32" 4K IPS, 144Hz, 1ms, HDMI 2.1 for PS5 and Xbox Series X, KVM switch.', '32" 4K 144Hz IPS', 649.00, 520.00, 25, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'Acer Predator X28 4K IPS', 'អេក្រង់ Acer Predator X28', '28" UHD 3840x2160 IPS, 152Hz, NVIDIA Reflex Latency Analyzer.', '28" 4K 152Hz', 599.00, 480.00, 20, 'Active', true),
    (v_tenant_id, v_cat_monitors, 'ViewSonic Elite XG270QG', 'អេក្រង់ ViewSonic Elite 27"', '27" 1440p IPS, 165Hz, 1ms, NVIDIA G-Sync Ultimate with RGB lighting.', '27" 165Hz IPS', 449.00, 360.00, 22, 'Active', true);

    -- 6. Insert Peripherals (8 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_peripherals, 'Logitech G PRO X 2 Superlight', 'កណ្តុរ Logitech G PRO X 2', 'Wireless gaming mouse, HERO 2 sensor, 60g ultralight, LIGHTFORCE hybrid switches.', 'Logitech G PRO X 2', 159.99, 120.00, 40, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'Razer DeathAdder V3 Pro', 'កណ្តុរ Razer DeathAdder V3 Pro', 'Ergonomic wireless esports mouse, 30K optical sensor, 63g lightweight.', 'Razer DeathAdder V3', 149.99, 110.00, 35, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'Wooting 60HE Mechanical Keyboard', 'ក្ដារចុច Wooting 60HE', 'Hall Effect analog switches, adjustable actuation 0.1mm to 4.0mm, Rapid Trigger.', 'Wooting 60HE Keyboard', 175.00, 140.00, 25, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'Keychron Q1 Pro Wireless Keyboard', 'ក្ដារចុច Keychron Q1 Pro', 'CNC aluminum wireless custom mechanical keyboard, hot-swappable, QMK/VIA.', 'Keychron Q1 Pro', 210.00, 170.00, 20, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'SteelSeries Apex Pro Wireless Gen 3', 'ក្ដារចុច SteelSeries Apex Pro', 'OmniPoint 2.0 adjustable mechanical switches, smart OLED display, 2.4GHz.', 'SteelSeries Apex Pro Gen 3', 249.99, 200.00, 18, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'Elgato Stream Deck MK.2', 'ឧបករណ៍ Elgato Stream Deck MK.2', '15 customizable LCD keys for content creators, streamers, and smart home automation.', 'Elgato Stream Deck MK.2', 149.99, 115.00, 30, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'ASUS ROG Falchion RX Low Profile', 'ក្ដារចុច ASUS ROG Falchion 65%', '65% wireless optical mechanical gaming keyboard, touch panel, ROG RX switches.', 'ROG Falchion Low Profile', 169.99, 135.00, 22, 'Active', true),
    (v_tenant_id, v_cat_peripherals, 'Zowie EC2-CW Wireless Mouse', 'កណ្តុរ Zowie EC2-CW', 'Wireless ergonomic mouse for competitive esports, enhanced receiver with antenna.', 'Zowie EC2-CW Wireless', 139.99, 105.00, 28, 'Active', true);

    -- 7. Insert Audio & Headsets (7 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_audio, 'SteelSeries Arctis Nova Pro Wireless', 'កាស SteelSeries Arctis Nova Pro', 'High Fidelity dual-wireless gaming headset, Active Noise Cancellation, hot-swap batteries.', 'Arctis Nova Pro Wireless', 349.99, 280.00, 18, 'Active', true),
    (v_tenant_id, v_cat_audio, 'HyperX Cloud III Wireless', 'កាស HyperX Cloud III', 'Up to 120-hour battery life, signature comfort, DTS Headphone:X spatial audio.', 'HyperX Cloud III Wireless', 169.99, 130.00, 30, 'Active', true),
    (v_tenant_id, v_cat_audio, 'Razer BlackShark V2 Pro (2023)', 'កាស Razer BlackShark V2 Pro', 'TriForce Titanium 50mm drivers, HyperClear super wideband mic, 70-hour battery.', 'Razer BlackShark V2 Pro', 199.99, 150.00, 25, 'Active', true),
    (v_tenant_id, v_cat_audio, 'Sony INZONE H9 Wireless Headset', 'កាស Sony INZONE H9', '360 Spatial Sound for gaming, digital noise canceling, 32-hour battery.', 'Sony INZONE H9', 299.00, 240.00, 15, 'Active', true),
    (v_tenant_id, v_cat_audio, 'Shure SM7B Studio Microphone', 'មីក្រូហ្វូន Shure SM7B', 'Legendary studio vocal dynamic microphone for podcasting, streaming, and broadcast.', 'Shure SM7B Mic', 399.00, 320.00, 12, 'Active', true),
    (v_tenant_id, v_cat_audio, 'Audio-Technica ATH-M50xBT2', 'កាស Audio-Technica ATH-M50xBT2', 'Wireless over-ear studio headphones, legendary studio sound, multipoint pairing.', 'ATH-M50xBT2 Headphones', 199.00, 155.00, 20, 'Active', true),
    (v_tenant_id, v_cat_audio, 'Logitech G ASTRO A50 X Wireless', 'កាស Logitech G ASTRO A50 X', 'PLAYSYNC multiplatform audio switcher (Xbox, PS5, PC), 24-bit LIGHTSPEED wireless.', 'ASTRO A50 X Wireless', 379.99, 300.00, 10, 'Active', true);

    -- 8. Insert Smart Home (7 items)
    INSERT INTO tbl_products (tenant_id, category_id, name, name_kh, description_en, description_kh, price, cost, stock, status, is_published) VALUES
    (v_tenant_id, v_cat_smarthome, 'Philips Hue Color Starter Kit', 'ឈុតភ្លើង Philips Hue', 'A19 smart bulbs (4x) and Hue Bridge. 16 million colors, voice and app control.', 'Philips Hue Kit', 199.99, 150.00, 20, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Nanoleaf Shapes Triangles (9 Panels)', 'ភ្លើងជញ្ជាំງ Nanoleaf Triangles', 'Modular RGB LED light panels that react to touch and music rhythm.', 'Nanoleaf Triangles Kit', 199.99, 155.00, 15, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Elgato Key Light Air', 'ភ្លើងស្តូឌីយ៉ូ Elgato Key Light', 'Professional LED panel for streaming and video calls, app controlled, 1400 lumens.', 'Elgato Key Light Air', 129.99, 95.00, 25, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Govee RGBIC Neon LED Rope Light', 'ខ្សែភ្លើង Govee Neon', '3m smart LED neon strip light for gaming room decor, Alexa and Google Assistant.', 'Govee Neon Rope Light', 79.99, 55.00, 40, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Nest Cam Outdoor / Indoor Camera', 'កាមេរ៉ាសុវត្ថិភាព Nest Cam', 'Battery-powered smart security camera with 1080p HDR video and intelligent alerts.', 'Nest Cam Battery', 179.99, 135.00, 18, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Amazon Echo Show 8 (3rd Gen)', 'អេក្រង់ឆ្លាតវៃ Amazon Echo Show 8', 'HD smart display with spatial audio and smart home hub for voice control.', 'Echo Show 8', 149.99, 115.00, 22, 'Active', true),
    (v_tenant_id, v_cat_smarthome, 'Ring Video Doorbell Pro 2', 'កザーទ្វារ Ring Video Doorbell Pro 2', 'Advanced 150° Head-to-Toe HD video, 3D motion detection, and bird’s eye view.', 'Ring Doorbell Pro 2', 229.99, 180.00, 14, 'Active', true);

    RAISE NOTICE 'Successfully seeded 43 products across 6 electronics categories for tenant_id %!', v_tenant_id;
END $$;
