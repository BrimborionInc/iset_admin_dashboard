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
-- Table structure for table `iset_case_assessment`
--

DROP TABLE IF EXISTS `iset_case_assessment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case_assessment` (
  `case_id` bigint unsigned NOT NULL,
  `date_of_assessment` date DEFAULT NULL,
  `overview` text COLLATE utf8mb4_unicode_ci,
  `employment_goals` text COLLATE utf8mb4_unicode_ci,
  `previous_iset` tinyint(1) DEFAULT NULL,
  `previous_iset_details` text COLLATE utf8mb4_unicode_ci,
  `employment_barriers` json DEFAULT NULL,
  `local_area_priorities` json DEFAULT NULL,
  `other_funding_details` text COLLATE utf8mb4_unicode_ci,
  `esdc_eligibility` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intervention_start_date` date DEFAULT NULL,
  `intervention_end_date` date DEFAULT NULL,
  `institution` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `program_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `itp_payload` json DEFAULT NULL,
  `wage_payload` json DEFAULT NULL,
  `recommendation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `justification` text COLLATE utf8mb4_unicode_ci,
  `nwac_review` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nwac_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`case_id`),
  CONSTRAINT `fk_iset_case_assessment_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `iset_case_assessment`
--

LOCK TABLES `iset_case_assessment` WRITE;
/*!40000 ALTER TABLE `iset_case_assessment` DISABLE KEYS */;
INSERT INTO `iset_case_assessment` VALUES (2,'2025-10-27','Summarize the client\'s application, background, and the specific request or intervention being considered. Include any relevant context from the application form.','Describe the client\'s short- and long-term employment goals as discussed during assessment. Reference the goals stated in the application form if available.',NULL,NULL,'[\"Lack of Work Experience\"]','[\"Literacy\"]','Describe any other funding the client has received or applied for in relation to this intervention.','EI Active Claim','2025-10-27','2025-10-30','Awentech','ISET Test Program','{\"books\": \"$ 120.00\", \"living\": \"$ 52.00\", \"tuition\": \"$ 100.00\", \"materials\": \"$ 10.00\"}','{\"mercs\": \"$ 20.00\", \"other\": \"5\", \"wages\": \"$ 100.00\", \"nonwages\": \"$ 10.00\"}','recommend','I like this application ','agree',NULL,'2025-10-27 20:38:25','2025-10-27 21:43:39');
/*!40000 ALTER TABLE `iset_case_assessment` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:34
