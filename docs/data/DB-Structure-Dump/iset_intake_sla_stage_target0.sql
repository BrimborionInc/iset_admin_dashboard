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
-- Table structure for table `sla_stage_target`
--

DROP TABLE IF EXISTS `sla_stage_target`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sla_stage_target` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_key` varchar(64) NOT NULL,
  `display_name` varchar(128) NOT NULL,
  `target_hours` int unsigned NOT NULL,
  `description` text,
  `applies_to_role` varchar(128) DEFAULT NULL,
  `active_from` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active_to` datetime DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(128) NOT NULL DEFAULT 'system',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(128) NOT NULL DEFAULT 'system',
  PRIMARY KEY (`id`),
  KEY `idx_sla_stage_target_stage` (`stage_key`),
  KEY `idx_sla_stage_target_role` (`applies_to_role`),
  KEY `idx_sla_stage_target_active` (`stage_key`,`applies_to_role`,`active_to`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sla_stage_target`
--

LOCK TABLES `sla_stage_target` WRITE;
/*!40000 ALTER TABLE `sla_stage_target` DISABLE KEYS */;
INSERT INTO `sla_stage_target` VALUES (1,'intake_triage','Intake triage',24,'Time to first open and triage new application.',NULL,'2025-10-02 13:20:28',NULL,1,'2025-10-02 13:20:28','system','2025-10-02 13:20:28','system'),(2,'assignment','Assignment',72,'Time to assign a coordinator or assessor after triage.',NULL,'2025-10-02 13:20:28',NULL,1,'2025-10-02 13:20:28','system','2025-10-02 13:20:28','system'),(3,'assessment','Assessment',240,'Working time for assessors to complete review (10 days).',NULL,'2025-10-02 13:20:28',NULL,1,'2025-10-02 13:20:28','system','2025-10-02 13:20:28','system'),(4,'program_decision','Program decision',48,'Decision turnaround once assessment is complete.',NULL,'2025-10-02 13:20:28',NULL,1,'2025-10-02 13:20:28','system','2025-10-02 13:20:28','system');
/*!40000 ALTER TABLE `sla_stage_target` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:29
