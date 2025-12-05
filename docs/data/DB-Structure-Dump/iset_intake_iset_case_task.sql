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
-- Table structure for table `iset_case_task`
--

DROP TABLE IF EXISTS `iset_case_task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case_task` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_id` bigint unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to_staff_profile_id` bigint unsigned DEFAULT NULL,
  `assigned_to_user_id` int DEFAULT NULL,
  `due_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by_staff_profile_id` bigint unsigned DEFAULT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `updated_by_staff_profile_id` bigint unsigned DEFAULT NULL,
  `updated_by_user_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_case_task_case_status_due` (`case_id`,`status`,`due_at`),
  KEY `idx_case_task_assignee_status` (`assigned_to_staff_profile_id`,`status`,`due_at`),
  KEY `fk_case_task_assignee_user` (`assigned_to_user_id`),
  KEY `fk_case_task_created_by` (`created_by_staff_profile_id`),
  KEY `fk_case_task_updated_by` (`updated_by_staff_profile_id`),
  CONSTRAINT `fk_case_task_assignee_profile` FOREIGN KEY (`assigned_to_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_task_assignee_user` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_task_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_task_created_by` FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_task_updated_by` FOREIGN KEY (`updated_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05  9:10:15
