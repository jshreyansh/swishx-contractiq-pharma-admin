/*
  # Seed full catalogue data for existing products
  # Also splits approval_threshold into two numeric columns for +/- independently
*/

-- Split the text threshold into two separate numeric columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS threshold_plus  numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS threshold_minus numeric DEFAULT 5;

-- ── Cardiology ────────────────────────────────────────────────────────────────

UPDATE products SET
  brand_name          = 'AMLIP',
  drug_name           = 'Amlodipine Besylate Tablets',
  strength            = '10mg',
  packing             = '10 Tablets',
  mrp                 = 220.00,
  price_to_stockist   = 110.00,
  price_to_hospital   = 140.00,
  threshold_plus      = 10,
  threshold_minus     = 5
WHERE sku = 'SKU-AMLO-10';

UPDATE products SET
  brand_name          = 'BETALOC XL',
  drug_name           = 'Metoprolol Succinate Extended Release Tablets',
  strength            = '100mg',
  packing             = '10 Tablets',
  mrp                 = 370.00,
  price_to_stockist   = 185.00,
  price_to_hospital   = 230.00,
  threshold_plus      = 10,
  threshold_minus     = 5
WHERE sku = 'SKU-METO-100';

UPDATE products SET
  brand_name          = 'CLOPILET',
  drug_name           = 'Clopidogrel Bisulfate Tablets',
  strength            = '75mg',
  packing             = '10 Tablets',
  mrp                 = 420.00,
  price_to_stockist   = 210.00,
  price_to_hospital   = 265.00,
  threshold_plus      = 10,
  threshold_minus     = 8
WHERE sku = 'SKU-CLOP-75';

UPDATE products SET
  brand_name          = 'LIPITOR',
  drug_name           = 'Atorvastatin Calcium Tablets',
  strength            = '40mg',
  packing             = '10 Tablets',
  mrp                 = 290.00,
  price_to_stockist   = 145.00,
  price_to_hospital   = 180.00,
  threshold_plus      = 8,
  threshold_minus     = 5
WHERE sku = 'SKU-ATOR-40';

-- ── Respiratory ───────────────────────────────────────────────────────────────

UPDATE products SET
  brand_name          = 'VENTOLIN',
  drug_name           = 'Salbutamol Sulphate Metered Dose Inhaler',
  strength            = '100mcg/dose',
  packing             = '1 Inhaler (200 doses)',
  mrp                 = 640.00,
  price_to_stockist   = 320.00,
  price_to_hospital   = 400.00,
  threshold_plus      = 10,
  threshold_minus     = 5
WHERE sku = 'SKU-SALB-100';

UPDATE products SET
  brand_name          = 'BUDECORT',
  drug_name           = 'Budesonide Metered Dose Inhaler',
  strength            = '400mcg/dose',
  packing             = '1 Inhaler (200 doses)',
  mrp                 = 1360.00,
  price_to_stockist   = 680.00,
  price_to_hospital   = 850.00,
  threshold_plus      = 10,
  threshold_minus     = 8
WHERE sku = 'SKU-BUDE-400';

UPDATE products SET
  brand_name          = 'MONTAIR',
  drug_name           = 'Montelukast Sodium Tablets',
  strength            = '10mg',
  packing             = '10 Tablets',
  mrp                 = 190.00,
  price_to_stockist   = 95.00,
  price_to_hospital   = 120.00,
  threshold_plus      = 10,
  threshold_minus     = 5
WHERE sku = 'SKU-MONT-10';

-- ── FOXIFUSE (update threshold columns too) ───────────────────────────────────

UPDATE products SET
  threshold_plus  = 10,
  threshold_minus = 5
WHERE sku = 'SKU-FOXI-10';
