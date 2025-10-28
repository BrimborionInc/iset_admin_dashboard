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

--
-- Dumping data for table `location`
--

LOCK TABLES `location` WRITE;
/*!40000 ALTER TABLE `location` DISABLE KEYS */;
INSERT INTO `location` VALUES (1,'Ahmedabad','123 Ashram Road, Near Riverfront, Ahmedabad, Gujarat, India',1,'2025-01-22 20:44:57','2025-03-17 18:06:06',1,1,0,'Active',3,NULL,10.00,10,1,1,3,'accessible-parking','Notes about this location','Lila Rivers',NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,'Mumbai','456 Marine Drive, Churchgate, Mumbai, Maharashtra, India',1,'2025-01-22 20:44:57','2025-02-15 14:36:38',1,2,1,'Active',3,NULL,5.00,15,1,1,7,'private-room,accessible-parking,step-free-access',NULL,'Chrisjen Avasarala','example@example.com','4449889798464','12341234','My Notes',1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,'Bengaluru','789 MG Road, Near Brigade Road, Bengaluru, Karnataka, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,1,0,'Active',3,NULL,10.00,15,1,1,3,'',NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,'Chennai','101 Mount Road, Anna Salai, Chennai, Tamil Nadu, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,2,1,'Active',3,NULL,10.00,30,2,1,5,'private-room,step-free-access,accessible-parking',NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,'Hyderabad','202 Banjara Hills, Road No. 12, Hyderabad, Telangana, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,2,1,'Active',3,NULL,10.00,10,1,1,5,'',NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,'Pune','303 FC Road, Shivajinagar, Pune, Maharashtra, India',1,'2025-01-22 20:44:57','2025-02-23 00:12:16',3,1,0,'Active',2,2,0.00,10,1,1,3,'accessible-parking,step-free-access,private-room','Additional Notes','Boris','boris@example.com',NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,'Chandigarh','404 Sector 17, Near Plaza, Chandigarh, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,1,0,'Active',3,NULL,10.00,10,1,1,3,'',NULL,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(8,'Jalandhar','505 Model Town, Near Bus Stand, Jalandhar, Punjab, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,1,0,'Active',3,NULL,10.00,10,1,1,3,'step-free-access',NULL,NULL,NULL,NULL,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,'Kolkata','606 Park Street, Near Park Circus, Kolkata, West Bengal, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,3,0,'Active',3,NULL,10.00,25,5,2,12,'step-free-access',NULL,NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,'New Delhi','707 Connaught Place, Rajiv Chowk, New Delhi, India',1,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,5,2,'Active',3,NULL,12.00,50,5,1,20,'private-room,step-free-access,accessible-parking','My Notes about Delhi',NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,'Ludhiana','808 Ferozepur Road, Near Mall Road, Ludhiana, Punjab, India',1,'2025-01-22 20:44:57','2025-02-26 18:50:46',2,1,0,'Active',3,NULL,10.00,10,1,1,3,'private-room,step-free-access,accessible-parking',NULL,NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,'Kathmandu','909 Durbar Marg, Near Thamel, Kathmandu, Nepal',2,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,1,0,'Active',3,NULL,10.00,15,2,1,5,'step-free-access',NULL,NULL,NULL,NULL,NULL,NULL,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,'Islamabad','1010 Blue Area, Near Jinnah Avenue, Islamabad, Pakistan',3,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,5,0,'Active',3,NULL,10.00,40,4,2,15,'private-room,step-free-access,accessible-parking',NULL,NULL,NULL,NULL,NULL,NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(14,'Karachi','1111 Clifton, Near Sea View, Karachi, Sindh, Pakistan',3,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,2,0,'Active',3,NULL,10.00,20,2,1,9,'step-free-access',NULL,NULL,NULL,NULL,NULL,NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(15,'Lahore','1212 Gulberg, Near Liberty Market, Lahore, Punjab, Pakistan',3,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,2,0,'Active',3,NULL,10.00,20,2,1,6,'',NULL,NULL,NULL,NULL,NULL,NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,'Colombo','1313 Galle Road, Near Bambalapitiya, Colombo, Sri Lanka',4,'2025-01-22 20:44:57','2025-02-04 16:32:50',1,3,0,'Active',3,NULL,10.00,30,2,1,9,'private-room,step-free-access,accessible-parking',NULL,NULL,NULL,NULL,NULL,NULL,5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(19,'Test VAC','1 Buckingham Palace Road, London',5,'2025-02-09 16:46:26','2025-03-07 18:51:44',4,1,0,'Active',3,NULL,0.00,0,0,0,0,'','This is a test VAC','Bill the Manager','manager@example.com','111-111-1111','',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `location` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:29
