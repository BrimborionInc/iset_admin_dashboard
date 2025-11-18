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
-- Table structure for table `iset_application_draft`
--

DROP TABLE IF EXISTS `iset_application_draft`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application_draft` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `eligibility_is_indigenous` tinyint(1) DEFAULT NULL,
  `eligibility_gender` tinyint(1) DEFAULT NULL,
  `eligibility_citizenship` tinyint(1) DEFAULT NULL,
  `eligibility_age` tinyint(1) DEFAULT NULL,
  `eligibility_employment_status` tinyint(1) DEFAULT NULL,
  `eligibility_pursuing_training` tinyint(1) DEFAULT NULL,
  `eligibility_funding_gap` tinyint(1) DEFAULT NULL,
  `eligibility_previous_default` tinyint(1) DEFAULT NULL,
  `sin_number` varchar(20) DEFAULT NULL,
  `indigenous_group` varchar(100) DEFAULT NULL,
  `indigenous_registration_number` varchar(100) DEFAULT NULL,
  `indigenous_home_community` varchar(100) DEFAULT NULL,
  `education_location` varchar(100) DEFAULT NULL,
  `employment_goals` text,
  `has_target_employer` tinyint(1) DEFAULT NULL,
  `target_employer` varchar(100) DEFAULT NULL,
  `document_refs` json DEFAULT NULL,
  `history` json DEFAULT NULL,
  `title` varchar(10) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `middle_names` varchar(100) DEFAULT NULL,
  `preferred_name` varchar(100) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(32) DEFAULT NULL,
  `street_address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `province` varchar(32) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `mailing_address` varchar(255) DEFAULT NULL,
  `daytime_phone` varchar(32) DEFAULT NULL,
  `alternate_phone` varchar(32) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(32) DEFAULT NULL,
  `emergency_contact_relationship` varchar(64) DEFAULT NULL,
  `visible_minority` tinyint(1) DEFAULT NULL,
  `preferred_language` varchar(32) DEFAULT NULL,
  `marital_status` varchar(32) DEFAULT NULL,
  `spouse_name` varchar(100) DEFAULT NULL,
  `has_dependents` tinyint(1) DEFAULT NULL,
  `children_ages` varchar(64) DEFAULT NULL,
  `has_disability` tinyint(1) DEFAULT NULL,
  `disability_description` text,
  `receives_social_assistance` tinyint(1) DEFAULT NULL,
  `social_assistance_topup` varchar(32) DEFAULT NULL,
  `labour_force_status` varchar(32) DEFAULT NULL,
  `education_level` varchar(64) DEFAULT NULL,
  `education_year_completed` varchar(8) DEFAULT NULL,
  `employment_barriers` json DEFAULT NULL,
  `barriers_other_text` varchar(255) DEFAULT NULL,
  `identified_path` varchar(32) DEFAULT NULL,
  `financial_support_types` json DEFAULT NULL,
  `support_other_detail` varchar(255) DEFAULT NULL,
  `childcare_requested` tinyint(1) DEFAULT NULL,
  `childcare_funding_source` varchar(64) DEFAULT NULL,
  `receives_other_funding` tinyint(1) DEFAULT NULL,
  `other_funding_details` varchar(255) DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `form_complete` tinyint(1) DEFAULT '0',
  `docs_uploaded` tinyint(1) DEFAULT '0',
  `employment_income` decimal(10,2) DEFAULT NULL,
  `spousal_income` decimal(10,2) DEFAULT NULL,
  `social_assistance` decimal(10,2) DEFAULT NULL,
  `child_tax_benefit` decimal(10,2) DEFAULT NULL,
  `jordans_principle` decimal(10,2) DEFAULT NULL,
  `band_funding` decimal(10,2) DEFAULT NULL,
  `other_income_desc` varchar(255) DEFAULT NULL,
  `other_income_amount` decimal(10,2) DEFAULT NULL,
  `rent_mortgage` decimal(10,2) DEFAULT NULL,
  `utilities` decimal(10,2) DEFAULT NULL,
  `groceries` decimal(10,2) DEFAULT NULL,
  `transit_pass` decimal(10,2) DEFAULT NULL,
  `childcare` decimal(10,2) DEFAULT NULL,
  `other_expenses_desc` varchar(255) DEFAULT NULL,
  `other_expenses_amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_draft` (`user_id`),
  CONSTRAINT `iset_application_draft_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-17 19:39:50
