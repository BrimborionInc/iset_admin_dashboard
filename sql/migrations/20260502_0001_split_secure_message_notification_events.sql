-- Split secure-message notification configuration by message direction.
-- Applicant-to-staff portal messages now use applicant_secure_message_received.
-- Staff-to-applicant case-workspace messages now use staff_secure_message_sent.

UPDATE notification_setting
   SET event = 'staff_secure_message_sent',
       updated_at = CURRENT_TIMESTAMP
 WHERE event COLLATE utf8mb4_unicode_ci = 'message_received'
   AND LOWER(role) COLLATE utf8mb4_unicode_ci = 'applicant';

UPDATE notification_setting
   SET event = 'applicant_secure_message_received',
       updated_at = CURRENT_TIMESTAMP
 WHERE event COLLATE utf8mb4_unicode_ci = 'message_received'
   AND LOWER(role) COLLATE utf8mb4_unicode_ci <> 'applicant';
