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
-- Table structure for table `location`
--

DROP TABLE IF EXISTS `location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `country_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `location_type_id` int DEFAULT '1',
  `biometric_counters` int DEFAULT '1',
  `combi_counters` int DEFAULT '0',
  `status` varchar(20) DEFAULT 'Active',
  `hub_and_spoke` int DEFAULT '3',
  `hub_vac_id` int DEFAULT NULL,
  `walkin_holdback` decimal(5,2) DEFAULT '10.00',
  `waiting_room_capacity` int DEFAULT '0',
  `service_counters` int DEFAULT '0',
  `bcs_spareholding` int DEFAULT '0',
  `staff_capacity` int DEFAULT '0',
  `facilities` varchar(255) DEFAULT '',
  `additional_notes` text,
  `manager_name` varchar(255) DEFAULT NULL,
  `manager_email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `alternative_number` varchar(20) DEFAULT NULL,
  `additional_contact_notes` text,
  `ircc_office_id` int DEFAULT NULL,
  `iset_full_name` varchar(255) DEFAULT NULL,
  `iset_code` varchar(50) DEFAULT NULL,
  `iset_status` varchar(20) DEFAULT NULL,
  `iset_province` varchar(50) DEFAULT NULL,
  `iset_indigenous_group` varchar(50) DEFAULT NULL,
  `iset_full_address` text,
  `iset_agreement_id` varchar(100) DEFAULT NULL,
  `iset_notes` text,
  PRIMARY KEY (`id`),
  KEY `fk_location_type` (`location_type_id`),
  KEY `fk_ircc_office` (`ircc_office_id`),
  CONSTRAINT `fk_ircc_office` FOREIGN KEY (`ircc_office_id`) REFERENCES `ircc_office` (`id`),
  CONSTRAINT `fk_location_type` FOREIGN KEY (`location_type_id`) REFERENCES `location_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-22  8:05:58
