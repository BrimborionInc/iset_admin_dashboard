-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: iset_intake
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `iset_case`
--

DROP TABLE IF EXISTS `iset_case`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_number` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `application_id` bigint unsigned DEFAULT NULL,
  `client_id` bigint unsigned DEFAULT NULL,
  `assigned_to_user_id` bigint unsigned DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `stage` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_stage` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opened_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `next_action_due_at` datetime DEFAULT NULL,
  `risk_rating` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `portfolio_region_id` tinyint unsigned DEFAULT NULL,
  `open_task_count` int unsigned NOT NULL DEFAULT '0',
  `overdue_task_count` int unsigned NOT NULL DEFAULT '0',
  `open_intervention_count` int unsigned NOT NULL DEFAULT '0',
  `total_intervention_count` int unsigned NOT NULL DEFAULT '0',
  `created_by_staff_profile_id` bigint unsigned DEFAULT NULL,
  `updated_by_staff_profile_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_iset_case_case_number` (`case_number`),
  KEY `idx_iset_case_application_id` (`application_id`),
  KEY `idx_iset_case_assigned_to_user_id` (`assigned_to_user_id`),
  KEY `idx_iset_case_status` (`status`),
  KEY `idx_iset_case_client_id` (`client_id`),
  KEY `idx_iset_case_status_owner` (`status`,`assigned_to_user_id`),
  KEY `idx_iset_case_stage` (`stage`),
  KEY `idx_iset_case_priority` (`priority`),
  KEY `idx_iset_case_open_task_count` (`open_task_count`),
  KEY `idx_iset_case_next_action_due` (`next_action_due_at`),
  KEY `fk_iset_case_portfolio_region` (`portfolio_region_id`),
  KEY `fk_iset_case_created_by_profile` (`created_by_staff_profile_id`),
  KEY `fk_iset_case_updated_by_profile` (`updated_by_staff_profile_id`),
  CONSTRAINT `fk_iset_case_application_id` FOREIGN KEY (`application_id`) REFERENCES `iset_application` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_iset_case_client_id` FOREIGN KEY (`client_id`) REFERENCES `client` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_iset_case_created_by_profile` FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iset_case_portfolio_region` FOREIGN KEY (`portfolio_region_id`) REFERENCES `canada_region` (`region_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iset_case_updated_by_profile` FOREIGN KEY (`updated_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `iset_case`
--

LOCK TABLES `iset_case` WRITE;
/*!40000 ALTER TABLE `iset_case` DISABLE KEYS */;
INSERT INTO `iset_case` VALUES (1,NULL,1,1,165898,'approved','planning','backlog',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,'2025-10-27 18:35:04','2025-10-27 18:35:23'),(2,NULL,2,1,164692,'approved','planning','backlog',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL,'2025-10-27 20:31:53','2025-10-28 12:15:53');
/*!40000 ALTER TABLE `iset_case` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:24
