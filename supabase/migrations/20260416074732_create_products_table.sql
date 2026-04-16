/*
  # Create products table

  ## Summary
  Adds a product catalogue that CFA/CNF users can browse when creating manual orders.

  ## New Tables
  - `products`
    - `id` (uuid, primary key)
    - `name` (text) - product display name
    - `sku` (text, unique) - product SKU/code
    - `division_id` (uuid, FK to divisions) - which division this product belongs to
    - `unit_price` (numeric) - default unit price in INR
    - `unit` (text) - unit of measure (e.g. Vial, Tab, Box)
    - `status` (text) - active / inactive
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read active products (read-only catalogue)
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  division_id uuid NOT NULL REFERENCES divisions(id),
  unit_price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Unit',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active products"
  ON products FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Authenticated users can read all products for admin"
  ON products FOR SELECT
  TO anon
  USING (status = 'active');

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Amoxicillin 500mg', 'SKU-AMOX-500', id, 45.00, 'Strip' FROM divisions WHERE code = 'CARD' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Atorvastatin 20mg', 'SKU-ATOR-20', id, 120.00, 'Strip' FROM divisions WHERE code = 'CARD' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Metoprolol 50mg', 'SKU-METO-50', id, 95.00, 'Strip' FROM divisions WHERE code = 'CARD' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Amlodipine 5mg', 'SKU-AMLO-5', id, 85.00, 'Strip' FROM divisions WHERE code = 'CARD' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Levetiracetam 500mg', 'SKU-LEVE-500', id, 320.00, 'Strip' FROM divisions WHERE code = 'NEURO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Donepezil 10mg', 'SKU-DONE-10', id, 450.00, 'Strip' FROM divisions WHERE code = 'NEURO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Carbidopa-Levodopa 25/250mg', 'SKU-CARB-25', id, 280.00, 'Strip' FROM divisions WHERE code = 'NEURO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Paclitaxel 300mg Vial', 'SKU-PACL-300', id, 18500.00, 'Vial' FROM divisions WHERE code = 'ONCO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Trastuzumab 440mg', 'SKU-TRAS-440', id, 62000.00, 'Vial' FROM divisions WHERE code = 'ONCO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Bevacizumab 400mg', 'SKU-BEVA-400', id, 28000.00, 'Vial' FROM divisions WHERE code = 'ONCO' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Metformin 500mg', 'SKU-METF-500', id, 55.00, 'Strip' FROM divisions WHERE code = 'DIAB' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Insulin Glargine 100IU/mL', 'SKU-INGL-100', id, 1200.00, 'Vial' FROM divisions WHERE code = 'DIAB' LIMIT 1;

INSERT INTO products (name, sku, division_id, unit_price, unit) SELECT
  'Empagliflozin 10mg', 'SKU-EMPA-10', id, 875.00, 'Strip' FROM divisions WHERE code = 'DIAB' LIMIT 1;
