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
-- Table structure for table `canada_region`
--

DROP TABLE IF EXISTS `canada_region`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `canada_region` (
  `region_id` tinyint unsigned NOT NULL,
  `code` char(2) NOT NULL,
  `name_en` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`region_id`),
  UNIQUE KEY `uq_canada_region_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `canada_region`
--

LOCK TABLES `canada_region` WRITE;
/*!40000 ALTER TABLE `canada_region` DISABLE KEYS */;
INSERT INTO `canada_region` VALUES (1,'AB','Alberta','2025-09-24 12:39:26','2025-09-24 22:36:54'),(2,'BC','British Columbia','2025-09-24 12:39:26','2025-09-24 22:36:54'),(3,'MB','Manitoba','2025-09-24 12:39:26','2025-09-24 22:36:54'),(4,'NB','New Brunswick','2025-09-24 12:39:26','2025-09-24 22:36:54'),(5,'NL','Newfoundland and Labrador','2025-09-24 12:39:26','2025-09-24 22:36:54'),(6,'NT','Northwest Territories','2025-09-24 12:39:26','2025-09-24 22:36:54'),(7,'NS','Nova Scotia','2025-09-24 12:39:26','2025-09-24 22:36:54'),(8,'NU','Nunavut','2025-09-24 12:39:26','2025-09-24 22:36:54'),(9,'ON','Ontario','2025-09-24 12:39:26','2025-09-24 22:36:54'),(10,'PE','Prince Edward Island','2025-09-24 12:39:26','2025-09-24 22:36:54'),(11,'QC','Quebec','2025-09-24 12:39:26','2025-09-24 22:36:54'),(12,'SK','Saskatchewan','2025-09-24 12:39:26','2025-09-24 22:36:54'),(13,'YT','Yukon','2025-09-24 12:39:26','2025-09-24 22:36:54'),(14,'XX','Test Region','2025-10-03 00:01:48','2025-10-03 00:01:48');
/*!40000 ALTER TABLE `canada_region` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:25
