/*
  # Add pharmaceutical catalogue columns to products table

  ## New Columns
  - brand_name   — trade/brand name (e.g. FOXIFUSE)
  - drug_name    — generic INN name (e.g. Ferric Carboxymaltose Injection)
  - strength     — e.g. 10ML, 500mg
  - packing      — e.g. 1 VIAL, 10 STRIPS
  - mrp          — Maximum Retail Price
  - price_to_stockist — stockist price
  - price_to_hospital — hospital/institutional price
  - approval_threshold — negotiation band, e.g. "+10% -5%"

  ## RLS
  - Adds INSERT + UPDATE policies for anon (app uses anon key, no Supabase Auth)
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_name         text,
  ADD COLUMN IF NOT EXISTS drug_name          text,
  ADD COLUMN IF NOT EXISTS strength           text,
  ADD COLUMN IF NOT EXISTS packing            text,
  ADD COLUMN IF NOT EXISTS mrp                numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_to_stockist  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_to_hospital  numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_threshold text;

-- Allow anon to insert new products (admin creates via UI)
CREATE POLICY "Anon can insert products"
  ON products FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update products
CREATE POLICY "Anon can update products"
  ON products FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Seed brand / catalogue data for existing products
UPDATE products SET
  brand_name          = 'AMOXIL',
  drug_name           = 'Amoxicillin Trihydrate Capsules',
  strength            = '500mg',
  packing             = '10 Capsules',
  mrp                 = 90.00,
  price_to_stockist   = 45.00,
  price_to_hospital   = 55.00,
  approval_threshold  = '+10% -5%'
WHERE sku = 'SKU-AMOX-500';

UPDATE products SET
  brand_name          = 'LIPITOR',
  drug_name           = 'Atorvastatin Calcium Tablets',
  strength            = '20mg',
  packing             = '10 Tablets',
  mrp                 = 240.00,
  price_to_stockist   = 120.00,
  price_to_hospital   = 150.00,
  approval_threshold  = '+8% -5%'
WHERE sku = 'SKU-ATOR-20';

UPDATE products SET
  brand_name          = 'BETALOC',
  drug_name           = 'Metoprolol Succinate Extended Release Tablets',
  strength            = '50mg',
  packing             = '10 Tablets',
  mrp                 = 190.00,
  price_to_stockist   = 95.00,
  price_to_hospital   = 115.00,
  approval_threshold  = '+10% -5%'
WHERE sku = 'SKU-METO-50';

UPDATE products SET
  brand_name          = 'AMLOKIND',
  drug_name           = 'Amlodipine Besylate Tablets',
  strength            = '5mg',
  packing             = '10 Tablets',
  mrp                 = 170.00,
  price_to_stockist   = 85.00,
  price_to_hospital   = 100.00,
  approval_threshold  = '+10% -8%'
WHERE sku = 'SKU-AMLO-5';

UPDATE products SET
  brand_name          = 'LEVERA',
  drug_name           = 'Levetiracetam Tablets',
  strength            = '500mg',
  packing             = '10 Tablets',
  mrp                 = 640.00,
  price_to_stockist   = 320.00,
  price_to_hospital   = 400.00,
  approval_threshold  = '+12% -5%'
WHERE sku = 'SKU-LEVE-500';

UPDATE products SET
  brand_name          = 'ARICEPT',
  drug_name           = 'Donepezil Hydrochloride Tablets',
  strength            = '10mg',
  packing             = '10 Tablets',
  mrp                 = 900.00,
  price_to_stockist   = 450.00,
  price_to_hospital   = 560.00,
  approval_threshold  = '+10% -5%'
WHERE sku = 'SKU-DONE-10';

UPDATE products SET
  brand_name          = 'SYNDOPA',
  drug_name           = 'Carbidopa + Levodopa Tablets',
  strength            = '25mg/250mg',
  packing             = '10 Tablets',
  mrp                 = 560.00,
  price_to_stockist   = 280.00,
  price_to_hospital   = 340.00,
  approval_threshold  = '+10% -5%'
WHERE sku = 'SKU-CARB-25';

UPDATE products SET
  brand_name          = 'TAXOL',
  drug_name           = 'Paclitaxel Concentrate for Infusion',
  strength            = '300mg/50mL',
  packing             = '1 Vial',
  mrp                 = 37000.00,
  price_to_stockist   = 18500.00,
  price_to_hospital   = 22000.00,
  approval_threshold  = '+5% -8%'
WHERE sku = 'SKU-PACL-300';

UPDATE products SET
  brand_name          = 'HERCEPTIN',
  drug_name           = 'Trastuzumab Lyophilised Powder for Injection',
  strength            = '440mg',
  packing             = '1 Vial',
  mrp                 = 124000.00,
  price_to_stockist   = 62000.00,
  price_to_hospital   = 75000.00,
  approval_threshold  = '+5% -5%'
WHERE sku = 'SKU-TRAS-440';

UPDATE products SET
  brand_name          = 'AVASTIN',
  drug_name           = 'Bevacizumab Concentrate for Infusion',
  strength            = '400mg/16mL',
  packing             = '1 Vial',
  mrp                 = 56000.00,
  price_to_stockist   = 28000.00,
  price_to_hospital   = 34000.00,
  approval_threshold  = '+5% -8%'
WHERE sku = 'SKU-BEVA-400';

UPDATE products SET
  brand_name          = 'GLUCOPHAGE',
  drug_name           = 'Metformin Hydrochloride Tablets',
  strength            = '500mg',
  packing             = '10 Tablets',
  mrp                 = 110.00,
  price_to_stockist   = 55.00,
  price_to_hospital   = 68.00,
  approval_threshold  = '+10% -8%'
WHERE sku = 'SKU-METF-500';

UPDATE products SET
  brand_name          = 'LANTUS',
  drug_name           = 'Insulin Glargine Injection',
  strength            = '100 IU/mL',
  packing             = '1 Vial (10mL)',
  mrp                 = 2400.00,
  price_to_stockist   = 1200.00,
  price_to_hospital   = 1500.00,
  approval_threshold  = '+8% -5%'
WHERE sku = 'SKU-INGL-100';

UPDATE products SET
  brand_name          = 'JARDIANCE',
  drug_name           = 'Empagliflozin Tablets',
  strength            = '10mg',
  packing             = '10 Tablets',
  mrp                 = 1750.00,
  price_to_stockist   = 875.00,
  price_to_hospital   = 1050.00,
  approval_threshold  = '+10% -5%'
WHERE sku = 'SKU-EMPA-10';

-- Add the FOXIFUSE example from the brief
INSERT INTO products (name, sku, division_id, unit_price, unit, brand_name, drug_name, strength, packing, mrp, price_to_stockist, price_to_hospital, approval_threshold)
SELECT
  'Ferric Carboxymaltose Injection',
  'SKU-FOXI-10',
  id,
  40.00,
  '1 Vial',
  'FOXIFUSE',
  'Ferric Carboxymaltose Injection',
  '10mL',
  '1 Vial',
  100.00,
  30.00,
  40.00,
  '+10% -5%'
FROM divisions WHERE code = 'DIAB' LIMIT 1
ON CONFLICT (sku) DO NOTHING;
