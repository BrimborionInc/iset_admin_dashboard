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
-- Table structure for table `blockstep`
--

DROP TABLE IF EXISTS `blockstep`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blockstep` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `config_path` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `step_json` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=136 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blockstep`
--

LOCK TABLES `blockstep` WRITE;
/*!40000 ALTER TABLE `blockstep` DISABLE KEYS */;
INSERT INTO `blockstep` VALUES (102,'SIN Number','nunjucks','blocksteps/blockstep_sin-number_v1.njk','active',NULL,'2025-04-15 08:46:22','2025-08-07 16:15:02'),(108,'Full Name','nunjucks','blocksteps/blockstep_full-name_v1.njk','active',NULL,'2025-04-15 09:07:03','2025-04-15 09:07:03'),(109,'Date of Birth','nunjucks','blocksteps/blockstep_date-of-birth_v1.njk','active',NULL,'2025-04-15 09:08:01','2025-04-15 09:08:01'),(110,'Gender','nunjucks','blocksteps/blockstep_gender_v1.njk','active',NULL,'2025-04-15 09:14:59','2025-04-15 09:14:59'),(111,'Indigenous Group','nunjucks','blocksteps/blockstep_indigenous-group_v1.njk','active',NULL,'2025-04-15 09:18:18','2025-04-15 09:18:18'),(112,'Home Community','nunjucks','blocksteps/blockstep_home-community_v1.njk','active',NULL,'2025-04-15 09:20:03','2025-04-15 09:20:03'),(113,'First Nations Number','nunjucks','blocksteps/blockstep_first-nations-number_v1.njk','active',NULL,'2025-04-15 09:26:33','2025-04-15 09:26:33'),(114,'Visible Minority','nunjucks','blocksteps/blockstep_visible-minority_v1.njk','active',NULL,'2025-04-15 09:32:22','2025-04-15 09:32:22'),(115,'Preferred Language','nunjucks','blocksteps/blockstep_preferred-language_v1.njk','active',NULL,'2025-04-15 09:33:56','2025-04-15 09:33:56'),(116,'Marital Status','nunjucks','blocksteps/blockstep_marital-status_v1.njk','active',NULL,'2025-04-15 09:36:51','2025-04-15 09:36:51'),(117,'Dependent Children?','nunjucks','blocksteps/blockstep_dependent-children_v1.njk','active',NULL,'2025-04-15 09:42:27','2025-04-15 09:42:27'),(118,'Disability Status','nunjucks','blocksteps/blockstep_disability-status_v1.njk','active',NULL,'2025-04-15 09:43:20','2025-04-15 09:43:20'),(119,'Social Assistance','nunjucks','blocksteps/blockstep_social-assistance_v1.njk','active',NULL,'2025-04-15 09:46:41','2025-04-15 09:46:41'),(120,'Employment Status','nunjucks','blocksteps/blockstep_employment-status_v1.njk','active',NULL,'2025-04-15 09:50:43','2025-04-15 09:50:43'),(121,'Education (redo)','nunjucks','blocksteps/blockstep_education-redo_v1.njk','active',NULL,'2025-04-15 09:58:05','2025-04-15 09:58:05'),(122,'Highest Education Year','nunjucks','blocksteps/blockstep_highest-education-year_v1.njk','active',NULL,'2025-04-15 10:00:57','2025-04-15 10:00:57'),(123,'Highest Education Location','nunjucks','blocksteps/blockstep_highest-education-location_v1.njk','active',NULL,'2025-04-15 10:03:06','2025-04-15 10:03:06'),(124,'Home Address','nunjucks','blocksteps/blockstep_home-address_v1.njk','active',NULL,'2025-04-15 10:06:37','2025-04-15 10:06:37'),(125,'Mailing Address','nunjucks','blocksteps/blockstep_mailing-address_v1.njk','active',NULL,'2025-04-15 10:08:12','2025-04-15 10:08:12'),(126,'Daytime Phone','nunjucks','blocksteps/blockstep_daytime-phone_v1.njk','active',NULL,'2025-04-15 10:09:58','2025-04-15 10:09:58'),(127,'Alternate Phone','nunjucks','blocksteps/blockstep_alternate-phone_v1.njk','active',NULL,'2025-04-15 10:11:18','2025-04-15 10:11:18'),(128,'Email Address','nunjucks','blocksteps/blockstep_email-address_v1.njk','active',NULL,'2025-04-15 10:12:13','2025-04-15 10:12:13'),(129,'Emergency Contact','nunjucks','blocksteps/blockstep_emergency-contact_v1.njk','active',NULL,'2025-04-15 10:14:00','2025-04-15 10:14:00'),(130,'Long-term Employment Goals','nunjucks','blocksteps/blockstep_long-term-goals_v1.njk','active',NULL,'2025-04-15 10:15:44','2025-04-15 10:16:27'),(131,'Employment Barriers','nunjucks','blocksteps/blockstep_employment-barriers_v1.njk','active',NULL,'2025-04-15 10:16:54','2025-04-15 10:16:54'),(132,'Target Employer or Program','nunjucks','blocksteps/blockstep_target-employer-or-program_v1.njk','active',NULL,'2025-04-15 10:21:59','2025-04-15 10:21:59'),(133,'Financial Supports','nunjucks','blocksteps/blockstep_financial-supports_v1.njk','active',NULL,'2025-04-15 10:24:28','2025-04-15 10:24:28'),(134,'Childcare Support','nunjucks','blocksteps/blockstep_childcare-support_v1.njk','active',NULL,'2025-04-15 10:28:53','2025-04-15 10:28:53'),(135,'Other Funding','nunjucks','blocksteps/blockstep_untitled-blockstep_v1.njk','active',NULL,'2025-04-15 10:31:10','2025-04-15 10:31:40');
/*!40000 ALTER TABLE `blockstep` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:17
