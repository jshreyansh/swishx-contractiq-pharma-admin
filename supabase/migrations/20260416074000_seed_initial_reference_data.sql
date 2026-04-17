/*
  # Seed initial reference data with fixed UUIDs
  Inserts divisions, hospitals, stockists, field_reps, and app_users
  with the specific UUIDs expected by later seed migrations.
*/

-- Divisions
INSERT INTO divisions (id, name, code, approver_name, approver_email) VALUES
  ('0cc63e35-4b67-4f37-bc88-ebaa9d499773', 'Cardiology',    'CARDIO', 'Dr. Anand Mehta',   'anand.mehta@swishx.com'),
  ('14d0886b-cde3-4f0d-880e-992dbc304757', 'Diabetes',      'DIAB',   'Dr. Priya Nair',    'priya.nair@swishx.com'),
  ('09209343-a409-4a48-b52c-2df1098921e7', 'Neurology',     'NEURO',  'Dr. Suresh Iyer',   'suresh.iyer@swishx.com'),
  ('c23f5090-590b-45c2-be1f-550f030fcbf6', 'Oncology',      'ONCO',   'Dr. Kavita Sharma', 'kavita.sharma@swishx.com'),
  ('fde74d51-d274-48b2-9e78-58d5ed9449ea', 'Respiratory',   'RESP',   'Dr. Meena Pillai',  'meena.pillai@swishx.com')
ON CONFLICT (id) DO NOTHING;

-- Hospitals
INSERT INTO hospitals (id, name, city, state, contact_name, contact_phone) VALUES
  ('57964b26-f50b-42b1-a7cb-a085a7705cb1', 'Apollo Hospitals',          'Mumbai',    'Maharashtra', 'Dr. Rajan Patel',  '9800001001'),
  ('8ee6b46a-b760-4fd3-ba3d-b32fcd85762c', 'AIIMS Delhi',               'New Delhi', 'Delhi',       'Dr. Suman Gupta',  '9800001002'),
  ('595bcb2b-243c-47ac-8650-44962d171562', 'Fortis Healthcare',         'Gurugram',  'Haryana',     'Dr. Nisha Verma',  '9800001003'),
  ('9bdad112-db06-4ae2-8a6a-89dd01086e8c', 'Manipal Hospitals',         'Bangalore', 'Karnataka',   'Dr. Kiran Rao',    '9800001004'),
  ('f124808d-dad4-4060-88d7-3abb93710bd4', 'Kokilaben Dhirubhai Ambani','Mumbai',    'Maharashtra', 'Dr. Sheela Menon', '9800001005'),
  ('11f37aac-7dda-4970-9afd-c6cf95419012', 'Max Super Speciality',      'New Delhi', 'Delhi',       'Dr. Ajay Saxena',  '9800001006'),
  ('f1712dc4-3077-429b-9eb5-099f7be04b71', 'Narayana Health',           'Bangalore', 'Karnataka',   'Dr. Deepa Thomas', '9800001007')
ON CONFLICT (id) DO NOTHING;

-- Stockists
INSERT INTO stockists (id, name, city, region, warehouse_code) VALUES
  ('610751d5-7ab5-4a76-84ed-d0728ec65cc9', 'ABC Pharma Distributors', 'Mumbai',    'West',  'WH-MUM-01'),
  ('5295fbf9-e54b-4e95-b451-94159662f720', 'Apex Medical Supplies',   'Delhi',     'North', 'WH-DEL-01'),
  ('a778c3de-a755-4ef5-a729-53b4949452da', 'Karnataka Medicals',      'Bangalore', 'South', 'WH-BLR-01'),
  ('4e76a40a-46b8-4bdb-adf9-5c5c8ba8f8d3', 'National Drug House',    'Delhi',     'North', 'WH-DEL-02'),
  ('f8aa546b-4627-4671-83fb-271d32b2c5ff', 'Premier Pharma Corp',     'Chennai',   'South', 'WH-CHE-01')
ON CONFLICT (id) DO NOTHING;

-- Field Reps
INSERT INTO field_reps (id, name, phone, region, manager_name) VALUES
  ('5f265ebb-9834-48fc-aa52-2c07e189020b', 'Priya Singh',  '9900001001', 'West',  'Neeraj Sharma'),
  ('4a20bb3f-e44f-4fe1-8820-a58d2bdc778c', 'Rahul Sharma', '9900001002', 'North', 'Rajesh Kumar'),
  ('d91afbfc-b776-4fda-a9af-927dbc320b1a', 'Suresh Nair',  '9900001003', 'South', 'Vikram Bhat'),
  ('f39737b5-7417-4a5e-a901-ae0a3d0653e0', 'Meena Iyer',   '9900001004', 'North', 'Sunita Malhotra'),
  ('f276d8f8-f203-45c7-a9c6-549350ad2a4c', 'Kavita Reddy', '9900001005', 'South', 'Anand Krishnan'),
  ('b03b609e-3271-47f4-8733-2c7d1922f9bb', 'Arun Desai',   '9900001006', 'West',  'Rajesh Kumar')
ON CONFLICT (id) DO NOTHING;

-- App Users
INSERT INTO app_users (id, name, email, role, division_id, region, warehouse_code) VALUES
  ('79b67db3-32ca-4891-bafe-e1a304b03876', 'Ramesh CFA',      'ramesh.cfa@swishx.com',     'cfa',              null,                                   'North', 'WH-DEL-01'),
  ('c0b58925-c9da-4e5d-9d35-eb3f01bd06c3', 'Sunita CFA',      'sunita.cfa@swishx.com',     'cfa',              null,                                   'West',  'WH-MUM-01'),
  ('12affc3c-8625-425b-9774-b4f18e6e220d', 'Arvind Kapoor',   'arvind.kapoor@swishx.com',  'final_approver',   null,                                   'All',   ''),
  ('d40b8969-9f73-434a-bb62-3fd86146e16c', 'Meera Joshi',     'meera.joshi@swishx.com',    'final_approver',   null,                                   'All',   '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_users (name, email, role, division_id, region, warehouse_code) VALUES
  ('Vikram Desai',    'vikram.desai@swishx.com',    'admin',            null,                                   'All', ''),
  ('Dr. Anand Mehta', 'anand.mehta@swishx.com',     'division_approver','0cc63e35-4b67-4f37-bc88-ebaa9d499773', 'All', ''),
  ('Dr. Priya Nair',  'priya.nair.div@swishx.com',  'division_approver','14d0886b-cde3-4f0d-880e-992dbc304757', 'All', ''),
  ('Dr. Suresh Iyer', 'suresh.iyer.div@swishx.com', 'division_approver','09209343-a409-4a48-b52c-2df1098921e7', 'All', ''),
  ('Ops Viewer',      'ops.viewer@swishx.com',      'viewer',           null,                                   'All', '')
ON CONFLICT (email) DO NOTHING;

-- Division approver users referenced directly in division_approvals inserts
INSERT INTO app_users (id, name, email, role, division_id, region, warehouse_code) VALUES
  ('55323705-e0cf-461d-9212-90ae5d12471f', 'Dr. Kavita Sharma', 'kavita.sharma.div@swishx.com', 'division_approver', 'c23f5090-590b-45c2-be1f-550f030fcbf6', 'All', ''),
  ('55b6cc2d-e0c5-4abb-b253-1614c089457c', 'Dr. Meena Pillai',  'meena.pillai.div@swishx.com',  'division_approver', 'fde74d51-d274-48b2-9e78-58d5ed9449ea', 'All', ''),
  ('803f697e-eeae-44f1-bb28-7718f766cf57', 'Dr. Suresh Iyer',   'suresh.iyer.div@swishx.com',   'division_approver', '09209343-a409-4a48-b52c-2df1098921e7', 'All', ''),
  ('71a044fa-d32e-442c-8550-721f00fa0139', 'Dr. Anand Mehta',   'anand.mehta.div@swishx.com',   'division_approver', '0cc63e35-4b67-4f37-bc88-ebaa9d499773', 'All', '')
ON CONFLICT (id) DO NOTHING;
