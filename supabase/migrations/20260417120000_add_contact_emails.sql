-- Add contact emails for hospital POCs and field reps used in detail views

ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE field_reps
ADD COLUMN IF NOT EXISTS email text;

UPDATE hospitals
SET contact_email = CASE id
  WHEN '57964b26-f50b-42b1-a7cb-a085a7705cb1' THEN 'rajan.patel@apollo.example'
  WHEN '8ee6b46a-b760-4fd3-ba3d-b32fcd85762c' THEN 'suman.gupta@aiims.example'
  WHEN '595bcb2b-243c-47ac-8650-44962d171562' THEN 'nisha.verma@fortis.example'
  WHEN '9bdad112-db06-4ae2-8a6a-89dd01086e8c' THEN 'kiran.rao@manipal.example'
  WHEN 'f124808d-dad4-4060-88d7-3abb93710bd4' THEN 'sheela.menon@kokilaben.example'
  WHEN '11f37aac-7dda-4970-9afd-c6cf95419012' THEN 'ajay.saxena@max.example'
  WHEN 'f1712dc4-3077-429b-9eb5-099f7be04b71' THEN 'deepa.thomas@narayana.example'
  ELSE contact_email
END
WHERE contact_email IS NULL;

UPDATE field_reps
SET email = CASE id
  WHEN '5f265ebb-9834-48fc-aa52-2c07e189020b' THEN 'priya.singh@swishx.example'
  WHEN '4a20bb3f-e44f-4fe1-8820-a58d2bdc778c' THEN 'rahul.sharma@swishx.example'
  WHEN 'd91afbfc-b776-4fda-a9af-927dbc320b1a' THEN 'suresh.nair@swishx.example'
  WHEN 'f39737b5-7417-4a5e-a901-ae0a3d0653e0' THEN 'meena.iyer@swishx.example'
  WHEN 'f276d8f8-f203-45c7-a9c6-549350ad2a4c' THEN 'kavita.reddy@swishx.example'
  WHEN 'b03b609e-3271-47f4-8733-2c7d1922f9bb' THEN 'arun.desai@swishx.example'
  ELSE email
END
WHERE email IS NULL;
