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
-- Table structure for table `service_type`
--

DROP TABLE IF EXISTS `service_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` varchar(20) DEFAULT 'active',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `service_owner_id` int DEFAULT NULL,
  `default_duration` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `service_owner_id` (`service_owner_id`),
  CONSTRAINT `service_type_ibfk_1` FOREIGN KEY (`service_owner_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_type`
--

LOCK TABLES `service_type` WRITE;
/*!40000 ALTER TABLE `service_type` DISABLE KEYS */;
INSERT INTO `service_type` VALUES (1,'Biometric Collection','Collection of biometric data for identity verification.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,10.00),(2,'Document Submission','Submission of required documents for processing.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,10.00),(3,'Interview','Personal interview as part of the visa or immigration process.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,60.00),(4,'Travel Document Scanning','Scanning of travel documents for verification.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,10.00),(5,'Application Assistance (In-Person)','In-person assistance with application processing.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,30.00),(6,'Application Assistance (Virtual)','Remote assistance with application processing.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,30.00),(7,'Buccal Swab','Collection of DNA sample via buccal swab for verification.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,60.00),(8,'Self-Service Workstation','Use of a self-service workstation for form submissions.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,30.00),(9,'Photography Services','Photography services for official documentation.','Active','2025-02-06 09:21:33','2025-08-29 11:14:10',NULL,60.00);
/*!40000 ALTER TABLE `service_type` ENABLE KEYS */;
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
