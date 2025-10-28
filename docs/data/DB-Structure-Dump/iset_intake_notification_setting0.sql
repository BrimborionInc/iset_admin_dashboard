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
-- Table structure for table `notification_setting`
--

DROP TABLE IF EXISTS `notification_setting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_setting` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL,
  `template_id` int DEFAULT NULL,
  `language` varchar(16) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `email_alert` tinyint(1) NOT NULL DEFAULT '0',
  `bell_alert` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `template_id` (`template_id`),
  CONSTRAINT `notification_setting_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `notification_template` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_setting`
--

LOCK TABLES `notification_setting` WRITE;
/*!40000 ALTER TABLE `notification_setting` DISABLE KEYS */;
INSERT INTO `notification_setting` VALUES (1,'user_registered','applicant',1,'en',1,1,0,'2025-06-16 12:04:51','2025-06-17 08:15:32'),(2,'application_submitted','Program Administrator',NULL,'en',1,0,1,'2025-09-23 13:56:32','2025-09-30 21:18:13'),(12,'case_reassigned','Program Administrator',NULL,'en',1,0,1,'2025-09-29 15:37:29','2025-09-30 21:18:52'),(13,'case_reassigned','Regional Coordinator',NULL,'en',1,0,1,'2025-09-29 15:37:29','2025-09-30 21:18:52'),(14,'assessment_submitted','Application Assessor',NULL,'en',1,0,1,'2025-09-29 15:37:29','2025-10-14 08:40:02'),(15,'status_changed','Program Administrator',NULL,'en',0,0,0,'2025-09-29 15:37:29','2025-09-30 21:18:31'),(16,'application_approved','Program Administrator',2,'en',1,0,0,'2025-09-29 15:37:29','2025-09-29 15:37:29'),(17,'application_rejected','Program Administrator',2,'en',1,0,0,'2025-09-29 15:37:29','2025-09-29 15:37:29'),(18,'application_submitted','System Administrator',NULL,'en',1,0,1,'2025-09-30 20:47:32','2025-09-30 21:18:13'),(19,'case_assigned','System Administrator',NULL,'en',1,0,1,'2025-09-30 21:18:31','2025-09-30 21:18:31'),(20,'case_assigned','Program Administrator',NULL,'en',1,0,1,'2025-09-30 21:18:31','2025-09-30 21:18:31'),(21,'case_assigned','Regional Coordinator',NULL,'en',1,0,1,'2025-09-30 21:18:31','2025-09-30 21:18:31'),(22,'case_assigned','Application Assessor',NULL,'en',1,0,1,'2025-09-30 21:18:31','2025-09-30 21:18:31'),(23,'case_assigned','applicant',NULL,'en',1,0,1,'2025-09-30 21:18:31','2025-09-30 21:18:31'),(24,'case_reassigned','System Administrator',NULL,'en',1,0,1,'2025-09-30 21:18:52','2025-09-30 21:18:52'),(25,'case_reassigned','Application Assessor',NULL,'en',1,0,1,'2025-09-30 21:18:52','2025-09-30 21:18:52'),(26,'case_reassigned','applicant',NULL,'en',1,0,1,'2025-09-30 21:18:52','2025-09-30 21:18:52'),(27,'application_submitted','applicant',1,'en',1,1,0,'2025-10-07 17:11:30','2025-10-07 17:11:30'),(28,'message_received','System Administrator',NULL,'en',1,0,1,'2025-10-07 17:12:16','2025-10-07 17:12:16'),(29,'message_received','Program Administrator',NULL,'en',1,0,1,'2025-10-07 17:12:16','2025-10-07 17:12:16'),(30,'message_received','Regional Coordinator',NULL,'en',1,0,1,'2025-10-07 17:12:16','2025-10-07 17:12:16'),(31,'message_received','applicant',NULL,'en',1,1,1,'2025-10-07 17:12:16','2025-10-07 17:12:16'),(32,'message_received','Application Assessor',NULL,'en',1,0,1,'2025-10-07 17:12:16','2025-10-07 17:12:16'),(33,'status_changed','Regional Coordinator',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(34,'status_changed','Application Assessor',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(35,'nwac_review_submitted','Program Administrator',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(36,'assessment_submitted','Program Administrator',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(37,'assessment_submitted','Regional Coordinator',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(38,'nwac_review_submitted','Regional Coordinator',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02'),(39,'nwac_review_submitted','Application Assessor',NULL,'en',1,0,1,'2025-10-14 08:40:02','2025-10-14 08:40:02');
/*!40000 ALTER TABLE `notification_setting` ENABLE KEYS */;
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
