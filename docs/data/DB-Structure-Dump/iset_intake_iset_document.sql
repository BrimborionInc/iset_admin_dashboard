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
-- Table structure for table `iset_document`
--

DROP TABLE IF EXISTS `iset_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_document` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `applicant_user_id` bigint unsigned DEFAULT NULL,
  `application_id` bigint unsigned DEFAULT NULL,
  `case_id` bigint unsigned DEFAULT NULL,
  `origin_message_id` bigint unsigned DEFAULT NULL,
  `source` enum('secure_message_attachment','application_submission','manual_upload','system_generated') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(512) NOT NULL,
  `mime_type` varchar(128) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `size_bytes` bigint unsigned DEFAULT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `document_category` varchar(64) DEFAULT NULL,
  `visibility` enum('internal','shared','external') NOT NULL DEFAULT 'internal',
  `linked_task_id` bigint unsigned DEFAULT NULL,
  `linked_intervention_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_file_path` (`file_path`),
  KEY `idx_applicant` (`applicant_user_id`),
  KEY `idx_case` (`case_id`),
  KEY `idx_application` (`application_id`),
  KEY `idx_origin_message` (`origin_message_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_iset_document_category` (`document_category`),
  KEY `idx_iset_document_visibility` (`visibility`),
  KEY `idx_iset_document_linked_task` (`linked_task_id`),
  KEY `idx_iset_document_linked_intervention` (`linked_intervention_id`),
  CONSTRAINT `fk_iset_document_intervention` FOREIGN KEY (`linked_intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_iset_document_task` FOREIGN KEY (`linked_task_id`) REFERENCES `iset_case_task` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05  9:10:10
