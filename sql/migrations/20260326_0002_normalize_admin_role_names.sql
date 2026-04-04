ALTER TABLE staff_profiles
  MODIFY COLUMN primary_role VARCHAR(64) NULL;

UPDATE staff_profiles
SET primary_role = CASE primary_role
  WHEN 'System_Administrator' THEN 'System Administrator'
  WHEN 'System Admin' THEN 'System Administrator'
  WHEN 'Program Administrator' THEN 'NWAC Administrator'
  WHEN 'ProgramAdmin' THEN 'NWAC Administrator'
  WHEN 'Program Admin' THEN 'NWAC Administrator'
  WHEN 'NWAC_Administrator' THEN 'NWAC Administrator'
  WHEN 'Regional Coordinator' THEN 'Regional Manager'
  WHEN 'RegionalCoordinator' THEN 'Regional Manager'
  WHEN 'Regional_Manager' THEN 'Regional Manager'
  WHEN 'Application Assessor' THEN 'ISET Coordinator'
  WHEN 'ApplicationAssessor' THEN 'ISET Coordinator'
  WHEN 'Adjudicator' THEN 'ISET Coordinator'
  WHEN 'Assessor' THEN 'ISET Coordinator'
  WHEN 'PTMA Staff' THEN 'ISET Coordinator'
  WHEN 'PTMAStaff' THEN 'ISET Coordinator'
  WHEN 'ISET_Coordinator' THEN 'ISET Coordinator'
  ELSE primary_role
END
WHERE primary_role IS NOT NULL;

UPDATE notification_setting
SET role = CASE role
  WHEN 'System_Administrator' THEN 'System Administrator'
  WHEN 'System Admin' THEN 'System Administrator'
  WHEN 'Program Administrator' THEN 'NWAC Administrator'
  WHEN 'ProgramAdmin' THEN 'NWAC Administrator'
  WHEN 'Program Admin' THEN 'NWAC Administrator'
  WHEN 'NWAC_Administrator' THEN 'NWAC Administrator'
  WHEN 'Regional Coordinator' THEN 'Regional Manager'
  WHEN 'RegionalCoordinator' THEN 'Regional Manager'
  WHEN 'Regional_Manager' THEN 'Regional Manager'
  WHEN 'Application Assessor' THEN 'ISET Coordinator'
  WHEN 'ApplicationAssessor' THEN 'ISET Coordinator'
  WHEN 'Adjudicator' THEN 'ISET Coordinator'
  WHEN 'Assessor' THEN 'ISET Coordinator'
  WHEN 'PTMA Staff' THEN 'ISET Coordinator'
  WHEN 'PTMAStaff' THEN 'ISET Coordinator'
  WHEN 'ISET_Coordinator' THEN 'ISET Coordinator'
  ELSE role
END
WHERE role IS NOT NULL;

UPDATE iset_runtime_config
SET v = CAST(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          CAST(v AS CHAR),
                          'System_Administrator',
                          'System Administrator'
                        ),
                        'Program Administrator',
                        'NWAC Administrator'
                      ),
                      'ProgramAdmin',
                      'NWAC Administrator'
                    ),
                    'Program Admin',
                    'NWAC Administrator'
                  ),
                  'NWAC_Administrator',
                  'NWAC Administrator'
                ),
                'Regional Coordinator',
                'Regional Manager'
              ),
              'RegionalCoordinator',
              'Regional Manager'
            ),
            'Regional_Manager',
            'Regional Manager'
          ),
          'Application Assessor',
          'ISET Coordinator'
        ),
        'ApplicationAssessor',
        'ISET Coordinator'
      ),
      'Adjudicator',
      'ISET Coordinator'
    ),
    'ISET_Coordinator',
    'ISET Coordinator'
  ) AS JSON
)
WHERE scope = 'admin'
  AND k = 'accessControlMatrix'
  AND v IS NOT NULL;
