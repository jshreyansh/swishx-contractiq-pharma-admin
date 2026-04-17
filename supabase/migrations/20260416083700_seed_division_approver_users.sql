-- Fix division approver user IDs to match hardcoded UUIDs in division_approvals seed
-- Delete the gen_random_uuid() rows and re-insert with specific UUIDs

DELETE FROM app_users WHERE email IN (
  'kavita.sharma.div@swishx.com',
  'meena.pillai.div@swishx.com',
  'suresh.iyer.div@swishx.com',
  'anand.mehta.div@swishx.com'
);

INSERT INTO app_users (id, name, email, role, division_id, region, warehouse_code) VALUES
  ('55323705-e0cf-461d-9212-90ae5d12471f', 'Dr. Kavita Sharma', 'kavita.sharma.div@swishx.com', 'division_approver', 'c23f5090-590b-45c2-be1f-550f030fcbf6', 'All', ''),
  ('55b6cc2d-e0c5-4abb-b253-1614c089457c', 'Dr. Meena Pillai',  'meena.pillai.div@swishx.com',  'division_approver', 'fde74d51-d274-48b2-9e78-58d5ed9449ea', 'All', ''),
  ('803f697e-eeae-44f1-bb28-7718f766cf57', 'Dr. Suresh Iyer',   'suresh.iyer.div@swishx.com',   'division_approver', '09209343-a409-4a48-b52c-2df1098921e7', 'All', ''),
  ('71a044fa-d32e-442c-8550-721f00fa0139', 'Dr. Anand Mehta',   'anand.mehta.div@swishx.com',   'division_approver', '0cc63e35-4b67-4f37-bc88-ebaa9d499773', 'All', '');
