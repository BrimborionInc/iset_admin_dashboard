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
-- Table structure for table `iset_case_action_plan`
--

DROP TABLE IF EXISTS `iset_case_action_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case_action_plan` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `version` int NOT NULL DEFAULT '1',
  `owner_staff_profile_id` bigint unsigned DEFAULT NULL,
  `owner_user_id` int DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  `review_date` date DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `result_code` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_date` date DEFAULT NULL,
  `outcome_summary` text COLLATE utf8mb4_unicode_ci,
  `closure_notes` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `metadata_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_case_action_plan_case_status` (`case_id`,`status`),
  KEY `fk_case_action_plan_owner_profile` (`owner_staff_profile_id`),
  KEY `fk_case_action_plan_owner_user` (`owner_user_id`),
  CONSTRAINT `fk_case_action_plan_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_action_plan_owner_profile` FOREIGN KEY (`owner_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_action_plan_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_case_action_plan_result_date` CHECK (((`result_date` is null) or (`effective_date` is null) or (`result_date` >= `effective_date`))),
  CONSTRAINT `chk_case_action_plan_status` CHECK ((`status` in (_utf8mb4'draft',_utf8mb4'active',_utf8mb4'closed',_utf8mb4'archived')))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `iset_case_action_plan`
--

LOCK TABLES `iset_case_action_plan` WRITE;
/*!40000 ALTER TABLE `iset_case_action_plan` DISABLE KEYS */;
INSERT INTO `iset_case_action_plan` VALUES (1,2,'Skills Development','closed',1,164692,NULL,'2025-10-28','2025-10-31','2025-10-28 10:01:27','2025-10-28 10:02:05','ready_for_work','2025-10-31','This is the outcome summary','These are the closure notes.','Testing the action plan','{\"summary\": \"Testing the action plan\"}','2025-10-28 12:25:45','2025-10-28 14:02:05',NULL),(2,2,'Plan 2','active',1,164692,NULL,'2025-10-28','2025-10-30','2025-10-28 10:11:26',NULL,NULL,NULL,NULL,NULL,'Plan 2','{\"summary\": \"Plan 2\"}','2025-10-28 14:11:16','2025-10-28 17:21:05',NULL);
/*!40000 ALTER TABLE `iset_case_action_plan` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:26
