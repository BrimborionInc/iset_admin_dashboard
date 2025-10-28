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
-- Table structure for table `step`
--

DROP TABLE IF EXISTS `step`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `step` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `status` enum('draft','active','inactive') DEFAULT 'draft',
  `ui_meta` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `step`
--

LOCK TABLES `step` WRITE;
/*!40000 ALTER TABLE `step` DISABLE KEYS */;
INSERT INTO `step` VALUES (76,'Consent','active',NULL,'2025-09-02 11:10:24','2025-09-02 11:10:24'),(77,'Indigenous Declaration','active',NULL,'2025-09-02 11:50:27','2025-09-02 11:50:27'),(78,'Eligibility','active',NULL,'2025-09-02 12:12:38','2025-09-02 12:12:38'),(79,'Social Insurance Number','active',NULL,'2025-09-02 12:47:18','2025-09-02 12:47:18'),(80,'Name','active',NULL,'2025-09-02 12:50:29','2025-09-02 12:50:29'),(81,'Date of Birth','active',NULL,'2025-09-02 12:57:08','2025-09-02 12:57:08'),(82,'Gender','active',NULL,'2025-09-02 12:58:42','2025-09-02 12:58:42'),(83,'Contact Information','active',NULL,'2025-09-02 13:03:26','2025-09-02 13:03:26'),(84,'Emergency Contact','active',NULL,'2025-09-02 13:48:22','2025-09-02 13:48:22'),(85,'Indigenous Legal Identity','active',NULL,'2025-09-02 13:52:05','2025-09-02 13:52:05'),(86,'Registration Number','active',NULL,'2025-09-02 13:55:10','2025-09-02 13:55:10'),(87,'Home Community','active',NULL,'2025-09-02 13:56:08','2025-09-02 13:56:08'),(90,'Demographics','active',NULL,'2025-09-03 11:06:12','2025-09-03 11:06:12'),(91,'Disability and Social Assistance','active',NULL,'2025-09-03 11:28:19','2025-09-03 11:28:19'),(92,'Labour Force and Education History','active',NULL,'2025-09-03 11:49:02','2025-09-03 11:49:02'),(93,'Employment Goals and Barriers','active',NULL,'2025-09-03 11:50:41','2025-09-03 11:50:41'),(94,'Financial Supports Requested','active',NULL,'2025-09-03 11:55:45','2025-09-03 11:55:45'),(95,'Household Income','active',NULL,'2025-09-03 12:00:22','2025-09-03 12:00:22'),(97,'Household Expenses','active',NULL,'2025-09-03 12:15:53','2025-09-03 12:16:16'),(98,'Summary Page','active',NULL,'2025-09-03 12:17:26','2025-09-03 12:17:26'),(102,'Testing Options AI','active',NULL,'2025-09-05 12:45:30','2025-09-07 09:03:52'),(105,'ISET Document Upload','active',NULL,'2025-09-16 12:06:37','2025-09-16 12:06:37'),(112,'PPT_InCanada','active',NULL,'2025-09-18 13:13:21','2025-09-18 13:13:21'),(113,'PTT_HadAPassportBefore','active',NULL,'2025-09-18 13:23:31','2025-09-18 13:23:31'),(114,'Passport Opening Page','active',NULL,'2025-09-23 15:43:03','2025-09-23 15:43:03'),(115,'PPT-outside-canada','active',NULL,'2025-09-23 15:47:08','2025-09-23 15:47:24'),(116,'Untitled BlockStep','active',NULL,'2025-09-23 15:47:54','2025-09-23 15:47:54'),(117,'PPT-Passport Before','active',NULL,'2025-09-23 15:49:47','2025-10-07 13:53:53'),(118,'z_Character Countr','active',NULL,'2025-09-28 16:48:29','2025-09-28 16:48:29'),(119,'z_radio','active',NULL,'2025-09-28 17:16:21','2025-09-28 17:16:21'),(121,'Legal and Submission','active',NULL,'2025-09-29 11:31:22','2025-09-29 11:31:22'),(122,'Test new step','active',NULL,'2025-10-07 10:36:15','2025-10-07 10:36:15'),(123,'Urgency','active',NULL,'2025-10-07 13:56:53','2025-10-07 13:56:53'),(124,'VAC_which service','active',NULL,'2025-10-08 21:00:02','2025-10-08 21:00:02'),(125,'Bill','active',NULL,'2025-10-16 14:33:29','2025-10-16 14:33:29');
/*!40000 ALTER TABLE `step` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:31
