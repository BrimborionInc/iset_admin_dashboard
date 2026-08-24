SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE `staff_profiles`;

SELECT `primary_role`, COUNT(*)
  FROM `staff_profiles`
 GROUP BY `primary_role`
 ORDER BY `primary_role`;
