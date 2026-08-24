SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE `iset_runtime_config`;

SELECT `scope`, `k`, `v`, `updated_at`
  FROM `iset_runtime_config`
 WHERE (`scope` = 'admin' AND `k` = 'accessControlMatrix')
    OR (`scope` = 'finance' AND `k` = 'payment.approval.rules')
 ORDER BY `scope`, `k`;
