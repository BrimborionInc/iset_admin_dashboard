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
-- Table structure for table `queue_ticket_config`
--

DROP TABLE IF EXISTS `queue_ticket_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue_ticket_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prefix` varchar(2) NOT NULL,
  `label` varchar(100) NOT NULL,
  `service_type_id` int DEFAULT NULL,
  `priority_level` int DEFAULT '1',
  `applies_to_counter_type` enum('biometric','service','interview') DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prefix` (`prefix`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `queue_ticket_config_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_ticket_config`
--

LOCK TABLES `queue_ticket_config` WRITE;
/*!40000 ALTER TABLE `queue_ticket_config` DISABLE KEYS */;
INSERT INTO `queue_ticket_config` VALUES (1,'E','Emergency Biometric',1,0,'biometric',1,'2025-04-03 14:48:49','2025-04-03 14:48:49'),(2,'B','Biometric Collection',1,1,'biometric',1,'2025-04-03 14:48:49','2025-04-03 14:48:49'),(3,'S','Document Submission',2,1,'service',1,'2025-04-03 14:48:49','2025-04-03 14:48:49'),(4,'C','Document Collection',2,1,'service',1,'2025-04-03 14:48:49','2025-04-03 14:48:49'),(5,'I','Interview',3,1,'interview',1,'2025-04-03 14:48:49','2025-04-03 14:48:49');
/*!40000 ALTER TABLE `queue_ticket_config` ENABLE KEYS */;
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
