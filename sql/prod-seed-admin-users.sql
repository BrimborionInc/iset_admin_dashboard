START TRANSACTION;

INSERT INTO staff_profiles (cognito_sub, email, name, display_name, primary_role, region_id)
VALUES
('8c0d6588-0041-7059-9410-5f375ff0bd0a','sstacey@nwac.ca','Shelley Stacey','Shelley Stacey','NWAC Administrator',NULL),
('ec7db5e8-70f1-709b-af6e-3f908a7af17c','mcoppola@nwac.ca','Madison Coppola','Madison Coppola','NWAC Administrator',NULL),

('3cfd45b8-c031-70e2-5244-89d4f241672d','acurtis@nwac.ca','Amanda Curtis','Amanda Curtis','Regional Manager',7),
('1c9d35d8-f091-7077-2ca2-eae3e127a4a0','emarion@nwac.ca','Emilie Marion','Emilie Marion','Regional Manager',11),
('7c9d05a8-2031-70d7-a92d-361a9da67d61','lkuzma@nwac.ca','Luanne Kuzma','Luanne Kuzma','Regional Manager',1),

('7c6db598-30d1-70df-8029-9dfb14cd1fab','k.hyde@keepersofthecircle.com','Kelly Hyde','Kelly Hyde','ISET Coordinator',9),
('dc0dd558-f0b1-7019-7a16-b3b1772c72dd','iset@mmvi.ca','Deb Sinclair','Deb Sinclair','ISET Coordinator',3),
('8c1d75f8-5061-703a-18bb-32447da05f54','sewasiuk@iaaw.ca','Stormy','Stormy','ISET Coordinator',1),
('6c0d0558-30d1-7027-fd77-96dd65016770','isets@nativewomens.com','Michelle LeMouel','Michelle LeMouel','ISET Coordinator',6)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  name = VALUES(name),
  display_name = VALUES(display_name),
  primary_role = VALUES(primary_role),
  region_id = VALUES(region_id);

DELETE FROM staff_region
WHERE staff_profile_id IN (
  SELECT id FROM staff_profiles WHERE cognito_sub IN (
    '3cfd45b8-c031-70e2-5244-89d4f241672d',
    '1c9d35d8-f091-7077-2ca2-eae3e127a4a0',
    '7c9d05a8-2031-70d7-a92d-361a9da67d61'
  )
);

INSERT INTO staff_region (staff_profile_id, region_id)
SELECT id, 7  FROM staff_profiles WHERE cognito_sub='3cfd45b8-c031-70e2-5244-89d4f241672d' UNION ALL
SELECT id, 4  FROM staff_profiles WHERE cognito_sub='3cfd45b8-c031-70e2-5244-89d4f241672d' UNION ALL
SELECT id, 10 FROM staff_profiles WHERE cognito_sub='3cfd45b8-c031-70e2-5244-89d4f241672d' UNION ALL
SELECT id, 5  FROM staff_profiles WHERE cognito_sub='3cfd45b8-c031-70e2-5244-89d4f241672d' UNION ALL
SELECT id, 9  FROM staff_profiles WHERE cognito_sub='3cfd45b8-c031-70e2-5244-89d4f241672d' UNION ALL

SELECT id, 11 FROM staff_profiles WHERE cognito_sub='1c9d35d8-f091-7077-2ca2-eae3e127a4a0' UNION ALL
SELECT id, 3  FROM staff_profiles WHERE cognito_sub='1c9d35d8-f091-7077-2ca2-eae3e127a4a0' UNION ALL
SELECT id, 12 FROM staff_profiles WHERE cognito_sub='1c9d35d8-f091-7077-2ca2-eae3e127a4a0' UNION ALL
SELECT id, 8  FROM staff_profiles WHERE cognito_sub='1c9d35d8-f091-7077-2ca2-eae3e127a4a0' UNION ALL

SELECT id, 1  FROM staff_profiles WHERE cognito_sub='7c9d05a8-2031-70d7-a92d-361a9da67d61' UNION ALL
SELECT id, 2  FROM staff_profiles WHERE cognito_sub='7c9d05a8-2031-70d7-a92d-361a9da67d61' UNION ALL
SELECT id, 13 FROM staff_profiles WHERE cognito_sub='7c9d05a8-2031-70d7-a92d-361a9da67d61' UNION ALL
SELECT id, 6  FROM staff_profiles WHERE cognito_sub='7c9d05a8-2031-70d7-a92d-361a9da67d61'
ON DUPLICATE KEY UPDATE updated_at = staff_region.updated_at;

COMMIT;
