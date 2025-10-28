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
-- Table structure for table `workflow_route`
--

DROP TABLE IF EXISTS `workflow_route`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_route` (
  `workflow_id` int NOT NULL,
  `source_step_id` int NOT NULL,
  `mode` enum('linear','by_option') NOT NULL,
  `field_key` varchar(100) DEFAULT NULL,
  `default_next_step_id` int DEFAULT NULL,
  PRIMARY KEY (`workflow_id`,`source_step_id`),
  KEY `fk_wfr_source_step` (`source_step_id`),
  KEY `fk_wfr_default_next` (`default_next_step_id`),
  KEY `ix_wfr_mode` (`mode`),
  KEY `ix_wfr_field_key` (`field_key`),
  CONSTRAINT `fk_wfr_default_next` FOREIGN KEY (`default_next_step_id`) REFERENCES `step` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfr_source_step` FOREIGN KEY (`source_step_id`) REFERENCES `step` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfr_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `workflow` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_route`
--

LOCK TABLES `workflow_route` WRITE;
/*!40000 ALTER TABLE `workflow_route` DISABLE KEYS */;
INSERT INTO `workflow_route` VALUES (21,76,'linear',NULL,77),(21,77,'linear',NULL,78),(21,78,'linear',NULL,79),(21,79,'linear',NULL,80),(21,80,'linear',NULL,81),(21,81,'linear',NULL,82),(21,82,'linear',NULL,83),(21,83,'linear',NULL,84),(21,84,'linear',NULL,85),(21,85,'linear',NULL,86),(21,86,'linear',NULL,87),(21,87,'linear',NULL,90),(21,90,'linear',NULL,91),(21,91,'linear',NULL,92),(21,92,'linear',NULL,93),(21,93,'linear',NULL,94),(21,94,'linear',NULL,95),(21,95,'linear',NULL,97),(21,97,'linear',NULL,98),(21,98,'linear',NULL,105),(21,105,'linear',NULL,121),(35,112,'linear',NULL,123),(35,114,'linear',NULL,112),(35,123,'linear',NULL,117);
/*!40000 ALTER TABLE `workflow_route` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:22
