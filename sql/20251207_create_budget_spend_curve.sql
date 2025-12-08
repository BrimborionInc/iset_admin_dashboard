-- Spend curve configuration per fiscal year (guides planned expenditure phasing).

CREATE TABLE IF NOT EXISTS `budget_spend_curve` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `fiscal_year` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `month_num` tinyint unsigned NOT NULL,
  `pct_of_budget` decimal(5,2) NOT NULL DEFAULT 0.00,
  `rationale` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_spend_curve_year_month` (`fiscal_year`,`month_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default ISET spend curve (percentages sum to 100).
INSERT INTO `budget_spend_curve` (`fiscal_year`, `month_num`, `pct_of_budget`, `rationale`) VALUES
('default', 4, 3.00, 'Budget opens; few new starts; processing backlog'),
('default', 5, 4.00, 'Spring/summer training programs start'),
('default', 6, 6.00, 'Increasing applications; early fall program planning'),
('default', 7, 8.00, 'Wage subsidies + summer student employment peak'),
('default', 8, 12.00, 'Applications surge for Sept academic programs'),
('default', 9, 15.00, 'Largest spike: tuition payments + living allowances start'),
('default', 10, 12.00, 'Continued fall-term payments; program stabilization'),
('default', 11, 10.00, 'Moderate activity, follow-ups, continued supports'),
('default', 12, 6.00, 'Seasonal slowdown; few new intakes'),
('default', 1, 8.00, 'Winter academic term begins; another small spike'),
('default', 2, 8.00, 'Ongoing supports; some year-end project activity'),
('default', 3, 8.00, 'Heavy year-end reconciliation + last-month approvals');
