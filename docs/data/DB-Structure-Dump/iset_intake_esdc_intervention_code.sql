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
-- Table structure for table `esdc_intervention_code`
--

DROP TABLE IF EXISTS `esdc_intervention_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `esdc_intervention_code` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` tinyint unsigned NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schema_version` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.4',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_esdc_intervention_code_version` (`code`,`schema_version`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `esdc_intervention_code`
--

LOCK TABLES `esdc_intervention_code` WRITE;
/*!40000 ALTER TABLE `esdc_intervention_code` DISABLE KEYS */;
INSERT INTO `esdc_intervention_code` VALUES (1,1,'Career research & exploration','1.4',1,1,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(2,2,'Diagnostic assessment','1.4',1,2,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(3,3,'Employment counselling','1.4',1,3,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(4,4,'Skills development – essential skills','1.4',1,4,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(5,5,'Skills development – academic upgrading','1.4',1,5,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(6,6,'Work experience – job creation partnerships','1.4',1,6,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(7,7,'Work experience – wage subsidy','1.4',1,7,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(8,8,'Work experience – student employment','1.4',1,8,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(9,9,'Occupational skills training – certificate','1.4',1,9,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(10,10,'Occupational skills training – diploma','1.4',1,10,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(11,11,'Occupational skills training – degree','1.4',1,11,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(12,12,'Occupational skills training – apprenticeship','1.4',1,12,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(13,13,'Occupational skills training – vocational','1.4',1,13,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(14,14,'Self-employment','1.4',1,14,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(15,15,'Job search preparation strategies','1.4',1,15,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(16,16,'Job starts supports','1.4',1,16,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(17,17,'Employer referral','1.4',1,17,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(18,18,'Employment retention supports','1.4',1,18,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(19,19,'Referral to agencies','1.4',1,19,'2025-10-28 16:01:32','2025-10-28 16:01:32'),(20,20,'Pre-career development','1.4',1,20,'2025-10-28 16:01:32','2025-10-28 16:01:32');
/*!40000 ALTER TABLE `esdc_intervention_code` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:21
