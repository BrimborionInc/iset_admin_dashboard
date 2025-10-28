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
-- Table structure for table `staff_profiles`
--

DROP TABLE IF EXISTS `staff_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cognito_sub` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `primary_role` enum('Program Administrator','Regional Coordinator','Application Assessor','System Administrator') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Application Assessor',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `region_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_profiles_cognito_sub` (`cognito_sub`),
  KEY `idx_staff_profiles_email` (`email`),
  KEY `idx_staff_profiles_primary_role` (`primary_role`),
  KEY `idx_staff_profiles_status` (`status`),
  KEY `idx_region` (`region_id`)
) ENGINE=InnoDB AUTO_INCREMENT=174594 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_profiles`
--

LOCK TABLES `staff_profiles` WRITE;
/*!40000 ALTER TABLE `staff_profiles` DISABLE KEYS */;
INSERT INTO `staff_profiles` VALUES (164692,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','bill@sillery.co.uk',NULL,NULL,'System Administrator','active',NULL,'2025-10-11 18:44:41','2025-10-11 18:44:41',NULL),(164772,'0c7d8518-8091-700a-13fb-93cfdf5b9923','aws@sillery.co.uk',NULL,NULL,'Program Administrator','active',NULL,'2025-10-12 13:56:51','2025-10-12 13:56:51',NULL),(165898,'0c7d25f8-e0a1-7074-ff1b-e1342c1c4198','quebec.coordinator@awentech.ca',NULL,NULL,'Regional Coordinator','active',NULL,'2025-10-14 15:14:08','2025-10-24 15:10:29',11),(165899,'4c9d7598-6071-701d-625d-37ce1909efe8','iset@awentech.ca',NULL,NULL,'Regional Coordinator','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:08',NULL),(165900,'9ccd95e8-3031-70c5-908c-285e3598c632','ontario.coordinator@awentech.ca',NULL,NULL,'Regional Coordinator','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:08',NULL),(165901,'7ced15f8-c061-70e7-b61c-3e45afdf056d','ontario.assessor2@awentech.ca',NULL,NULL,'Application Assessor','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:08',NULL),(165902,'7ccd9538-b081-7026-5a0f-23950b465c24','quebec.assessor1@awentech.ca',NULL,NULL,'Application Assessor','active',NULL,'2025-10-14 15:14:08','2025-10-24 14:52:50',11),(165903,'4c5d35e8-b041-7072-9809-232d8f0009f4','ontario.assessor3@awentech.ca',NULL,NULL,'Application Assessor','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:08',NULL),(165904,'cc2d85a8-a061-7012-ad9a-d3fc653d5487','ontario.assessor1@awentech.ca',NULL,NULL,'Application Assessor','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:52',9),(165905,'6c8db548-00b1-701d-8cb7-402037328ece','quebec.assessor2@awentech.ca',NULL,NULL,'Application Assessor','active',NULL,'2025-10-14 15:14:08','2025-10-14 15:14:08',NULL);
/*!40000 ALTER TABLE `staff_profiles` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:30
