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
-- Table structure for table `__migrations`
--

DROP TABLE IF EXISTS `__migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `appointment`
--

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `status` varchar(50) DEFAULT 'booked',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bilReference` varchar(50) DEFAULT NULL,
  `extraTime` enum('yes','no') DEFAULT 'no',
  `preferredLanguage` varchar(50) DEFAULT NULL,
  `interpreterNeeded` enum('yes','no') DEFAULT 'no',
  `interpreterLanguage` varchar(50) DEFAULT NULL,
  `additionalService1` varchar(100) DEFAULT NULL,
  `additionalService2` varchar(100) DEFAULT NULL,
  `additionalService3` varchar(100) DEFAULT NULL,
  `additionalNotes` text,
  `serviceType` int DEFAULT NULL,
  `booking_reference` varchar(10) DEFAULT NULL,
  `reason_code_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `appointment_ibfk_2` (`serviceType`),
  KEY `fk_reason_code` (`reason_code_id`),
  CONSTRAINT `appointment_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `appointment_ibfk_2` FOREIGN KEY (`serviceType`) REFERENCES `service_type` (`id`),
  CONSTRAINT `fk_reason_code` FOREIGN KEY (`reason_code_id`) REFERENCES `reason_code` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `booking`
--

DROP TABLE IF EXISTS `booking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appointment_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `relationship` varchar(50) DEFAULT NULL,
  `bilReference` varchar(50) DEFAULT NULL,
  `slot_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `booking_reference` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `slot_id` (`slot_id`),
  CONSTRAINT `booking_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`),
  CONSTRAINT `booking_ibfk_2` FOREIGN KEY (`slot_id`) REFERENCES `slot` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `canada_region`
--

DROP TABLE IF EXISTS `canada_region`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `canada_region` (
  `region_id` tinyint unsigned NOT NULL,
  `code` char(2) NOT NULL,
  `name_en` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`region_id`),
  UNIQUE KEY `uq_canada_region_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component`
--

DROP TABLE IF EXISTS `component`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `route_path` varchar(255) DEFAULT NULL,
  `is_editable` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component_template`
--

DROP TABLE IF EXISTS `component_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_key` varchar(100) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `type` varchar(50) NOT NULL,
  `label` varchar(100) NOT NULL,
  `description` text,
  `default_props` json NOT NULL,
  `prop_schema` json DEFAULT NULL,
  `export_njk_template` text,
  `status` varchar(20) DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `has_options` tinyint(1) NOT NULL DEFAULT '0',
  `option_schema` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_component_template_key_version` (`template_key`,`version`),
  KEY `ix_component_template_key` (`template_key`),
  KEY `ix_component_template_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `component_template_backup`
--

DROP TABLE IF EXISTS `component_template_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `component_template_backup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_key` varchar(100) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `type` varchar(50) NOT NULL,
  `label` varchar(100) NOT NULL,
  `description` text,
  `default_props` json NOT NULL,
  `prop_schema` json DEFAULT NULL,
  `export_njk_template` text,
  `status` varchar(20) DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `has_options` tinyint(1) NOT NULL DEFAULT '0',
  `option_schema` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_component_template_key_version` (`template_key`,`version`),
  KEY `ix_component_template_key` (`template_key`),
  KEY `ix_component_template_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `counter`
--

DROP TABLE IF EXISTS `counter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counter` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `service_type_id` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `location_id` (`location_id`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `counter_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`),
  CONSTRAINT `counter_ibfk_2` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `counter_session`
--

DROP TABLE IF EXISTS `counter_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `counter_session` (
  `id` int NOT NULL AUTO_INCREMENT,
  `counter_id` int NOT NULL,
  `user_id` int NOT NULL,
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `counter_id` (`counter_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `counter_session_ibfk_1` FOREIGN KEY (`counter_id`) REFERENCES `counter` (`id`),
  CONSTRAINT `counter_session_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `country`
--

DROP TABLE IF EXISTS `country`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `country` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `country_holiday_link`
--

DROP TABLE IF EXISTS `country_holiday_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `country_holiday_link` (
  `id` int NOT NULL AUTO_INCREMENT,
  `country_id` int NOT NULL,
  `holiday_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `country_id` (`country_id`),
  KEY `holiday_id` (`holiday_id`),
  CONSTRAINT `country_holiday_link_ibfk_1` FOREIGN KEY (`country_id`) REFERENCES `country` (`id`),
  CONSTRAINT `country_holiday_link_ibfk_2` FOREIGN KEY (`holiday_id`) REFERENCES `holiday` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `application_id` int DEFAULT NULL,
  `component_id` varchar(120) NOT NULL,
  `storage_key` varchar(512) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime` varchar(120) NOT NULL,
  `size_bytes` int NOT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `scan_status` enum('pending','clean','quarantined') NOT NULL DEFAULT 'pending',
  `uploaded_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `audit_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_app` (`application_id`),
  KEY `idx_component` (`component_id`),
  KEY `idx_scan` (`scan_status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `facility_requirement`
--

DROP TABLE IF EXISTS `facility_requirement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `facility_requirement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_type_id` int NOT NULL,
  `requirements_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `facility_requirement_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holiday`
--

DROP TABLE IF EXISTS `holiday`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holiday` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hub_and_spoke_link`
--

DROP TABLE IF EXISTS `hub_and_spoke_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hub_and_spoke_link` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `intake_workflow`
--

DROP TABLE IF EXISTS `intake_workflow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intake_workflow` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_type_id` int NOT NULL,
  `json_path` varchar(255) NOT NULL,
  `version` int NOT NULL,
  `status` enum('active','inactive','draft') DEFAULT 'draft',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `intake_workflow_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `intake_workflow_blockstep_link`
--

DROP TABLE IF EXISTS `intake_workflow_blockstep_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intake_workflow_blockstep_link` (
  `id` int NOT NULL AUTO_INCREMENT,
  `intake_workflow_id` int NOT NULL,
  `blockstep_id` int NOT NULL,
  `next_blockstep_id` int DEFAULT NULL,
  `next_intake_workflow_id` int DEFAULT NULL,
  `branching_logic` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intake_workflow_id` (`intake_workflow_id`),
  KEY `blockstep_id` (`blockstep_id`),
  KEY `next_blockstep_id` (`next_blockstep_id`),
  KEY `next_intake_workflow_id` (`next_intake_workflow_id`),
  CONSTRAINT `intake_workflow_blockstep_link_ibfk_1` FOREIGN KEY (`intake_workflow_id`) REFERENCES `intake_workflow` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intake_workflow_blockstep_link_ibfk_2` FOREIGN KEY (`blockstep_id`) REFERENCES `blockstep` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intake_workflow_blockstep_link_ibfk_3` FOREIGN KEY (`next_blockstep_id`) REFERENCES `blockstep` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intake_workflow_blockstep_link_ibfk_4` FOREIGN KEY (`next_intake_workflow_id`) REFERENCES `intake_workflow` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ircc_office`
--

DROP TABLE IF EXISTS `ircc_office`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ircc_office` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_application`
--

DROP TABLE IF EXISTS `iset_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint unsigned DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `version` int NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_iset_application_submission_id` (`submission_id`),
  KEY `idx_iset_application_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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

--
-- Table structure for table `iset_application_draft_dynamic`
--

DROP TABLE IF EXISTS `iset_application_draft_dynamic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application_draft_dynamic` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `workflow_id` varchar(64) NOT NULL DEFAULT 'iset-v1',
  `step_cursor` varchar(128) DEFAULT NULL,
  `draft_payload` json NOT NULL,
  `history` json DEFAULT NULL,
  `doc_refs` json DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_iset_app_draft_dynamic_updated_at` (`updated_at`),
  CONSTRAINT `fk_iset_application_draft_dynamic_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_application_file`
--

DROP TABLE IF EXISTS `iset_application_file`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application_file` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `document_type` varchar(64) NOT NULL DEFAULT '' COMMENT 'Type of document: status_card, govt_id, acceptance_letter, pay_stubs, spouse_pay_stubs, band_denial_letter, etc.',
  `status` enum('pending','processing','clean','quarantined','rejected') NOT NULL DEFAULT 'pending',
  `virus_scan_status` enum('pending','skipped','clean','malicious','error') NOT NULL DEFAULT 'pending',
  `detected_mime` varchar(128) NOT NULL DEFAULT '',
  `scan_notes` varchar(255) NOT NULL DEFAULT '',
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `iset_application_file_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_application_submission`
--

DROP TABLE IF EXISTS `iset_application_submission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application_submission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `workflow_id` varchar(64) NOT NULL DEFAULT 'iset-v1',
  `reference_number` varchar(32) NOT NULL,
  `status` enum('submitted','validated','ingested','errored') NOT NULL DEFAULT 'submitted',
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `intake_payload` json NOT NULL,
  `schema_snapshot` json DEFAULT NULL,
  `history` json DEFAULT NULL,
  `doc_refs` json DEFAULT NULL,
  `locale` varchar(8) DEFAULT NULL,
  `source_ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_iset_app_sub_ref` (`reference_number`),
  KEY `idx_iset_app_sub_user` (`user_id`),
  KEY `idx_iset_app_sub_submitted_at` (`submitted_at`),
  KEY `idx_iset_app_sub_workflow` (`workflow_id`),
  KEY `idx_iset_app_sub_status` (`status`),
  CONSTRAINT `fk_iset_app_sub_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_application_version`
--

DROP TABLE IF EXISTS `iset_application_version`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_application_version` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `version` int NOT NULL,
  `payload_json` json NOT NULL,
  `change_summary` text COLLATE utf8mb4_unicode_ci,
  `created_by_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `restored_from_version` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_application_version` (`application_id`,`version`),
  KEY `idx_application_version_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_case`
--

DROP TABLE IF EXISTS `iset_case`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `application_id` bigint unsigned NOT NULL,
  `assigned_to_user_id` bigint unsigned DEFAULT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_iset_case_application_id` (`application_id`),
  KEY `idx_iset_case_assigned_to_user_id` (`assigned_to_user_id`),
  KEY `idx_iset_case_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `iset_document`
--

DROP TABLE IF EXISTS `iset_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_document` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `applicant_user_id` bigint unsigned DEFAULT NULL,
  `application_id` bigint unsigned DEFAULT NULL,
  `case_id` bigint unsigned DEFAULT NULL,
  `origin_message_id` bigint unsigned DEFAULT NULL,
  `source` enum('secure_message_attachment','application_submission','manual_upload','system_generated') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(512) NOT NULL,
  `mime_type` varchar(128) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `size_bytes` bigint unsigned DEFAULT NULL,
  `checksum_sha256` char(64) DEFAULT NULL,
  `status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_file_path` (`file_path`),
  KEY `idx_applicant` (`applicant_user_id`),
  KEY `idx_case` (`case_id`),
  KEY `idx_application` (`application_id`),
  KEY `idx_origin_message` (`origin_message_id`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_event_entry`
--

DROP TABLE IF EXISTS `iset_event_entry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_event_entry` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('info','success','warning','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `source` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` json NOT NULL,
  `tracking_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correlation_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `captured_by` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `captured_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ingested_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_event_entry_subject` (`subject_type`,`subject_id`,`captured_at`),
  KEY `idx_event_entry_type_captured` (`event_type`,`captured_at`),
  KEY `idx_event_entry_captured_at` (`captured_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_event_outbox`
--

DROP TABLE IF EXISTS `iset_event_outbox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_event_outbox` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `status` enum('pending','delivering','delivered','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `next_attempt_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_event_outbox_status_next` (`status`,`next_attempt_at`),
  KEY `fk_event_outbox_entry` (`event_id`),
  CONSTRAINT `fk_event_outbox_entry` FOREIGN KEY (`event_id`) REFERENCES `iset_event_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_event_receipt`
--

DROP TABLE IF EXISTS `iset_event_receipt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_event_receipt` (
  `event_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `read_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`event_id`,`recipient_id`),
  KEY `idx_event_receipt_read_at` (`read_at`),
  CONSTRAINT `fk_event_receipt_entry` FOREIGN KEY (`event_id`) REFERENCES `iset_event_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_internal_notification`
--

DROP TABLE IF EXISTS `iset_internal_notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_internal_notification` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_key` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `audience_type` enum('global','role','user') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'role',
  `audience_role` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audience_user_id` bigint unsigned DEFAULT NULL,
  `dismissible` tinyint(1) NOT NULL DEFAULT '1',
  `requires_ack` tinyint(1) NOT NULL DEFAULT '0',
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_iset_internal_notification_audience_role` (`audience_type`,`audience_role`),
  KEY `idx_iset_internal_notification_user` (`audience_type`,`audience_user_id`),
  KEY `idx_iset_internal_notification_active` (`starts_at`,`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_internal_notification_dismissal`
--

DROP TABLE IF EXISTS `iset_internal_notification_dismissal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_internal_notification_dismissal` (
  `notification_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `dismissed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`,`user_id`),
  KEY `idx_iset_internal_notification_dismissal_user` (`user_id`),
  CONSTRAINT `fk_internal_notification_dismissal_notification` FOREIGN KEY (`notification_id`) REFERENCES `iset_internal_notification` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_migration`
--

DROP TABLE IF EXISTS `iset_migration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_migration` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `checksum` char(64) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `duration_ms` int NOT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '1',
  `error_snippet` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_filename_checksum` (`filename`,`checksum`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `iset_runtime_config`
--

DROP TABLE IF EXISTS `iset_runtime_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_runtime_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `scope` varchar(32) NOT NULL,
  `k` varchar(128) NOT NULL,
  `v` json DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_scope_key` (`scope`,`k`),
  KEY `idx_scope` (`scope`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jordan_application`
--

DROP TABLE IF EXISTS `jordan_application`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jordan_application` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `tracking_id` varchar(64) NOT NULL,
  `application_json` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tracking_id` (`tracking_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jordan_application_draft`
--

DROP TABLE IF EXISTS `jordan_application_draft`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jordan_application_draft` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `application_json` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `language`
--

DROP TABLE IF EXISTS `language`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `language` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `location_language_link`
--

DROP TABLE IF EXISTS `location_language_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_language_link` (
  `location_id` int NOT NULL,
  `language_id` int NOT NULL,
  `status` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`location_id`,`language_id`),
  KEY `language_id` (`language_id`),
  CONSTRAINT `location_language_link_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`) ON DELETE CASCADE,
  CONSTRAINT `location_language_link_ibfk_2` FOREIGN KEY (`language_id`) REFERENCES `language` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `location_service_link`
--

DROP TABLE IF EXISTS `location_service_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_service_link` (
  `location_id` int NOT NULL,
  `service_id` int NOT NULL,
  PRIMARY KEY (`location_id`,`service_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `location_service_link_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`) ON DELETE CASCADE,
  CONSTRAINT `location_service_link_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `service_type` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `location_type`
--

DROP TABLE IF EXISTS `location_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `message_attachment`
--

DROP TABLE IF EXISTS `message_attachment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_attachment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `case_id` bigint unsigned DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  `application_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `message_id` (`message_id`),
  KEY `idx_message_attachment_case_id` (`case_id`),
  CONSTRAINT `message_attachment_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `recipient_id` int NOT NULL,
  `case_id` bigint unsigned DEFAULT NULL,
  `application_id` bigint unsigned DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `status` enum('unread','read','archived','replied') DEFAULT 'unread',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted` tinyint(1) DEFAULT '0',
  `urgent` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `recipient_id` (`recipient_id`),
  KEY `idx_messages_case_id` (`case_id`),
  KEY `idx_messages_application_id` (`application_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification_template`
--

DROP TABLE IF EXISTS `notification_template`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` enum('Email','SMS','Robo-Caller') NOT NULL,
  `status` enum('Draft','For Review','For Approval','Approved','Released','Superseded','Archived') NOT NULL DEFAULT 'Draft',
  `language` varchar(10) NOT NULL DEFAULT 'en',
  `subject` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_template` (`name`,`type`,`language`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `operating_hours`
--

DROP TABLE IF EXISTS `operating_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operating_hours` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `day_of_week` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  `open_time` time NOT NULL,
  `close_time` time NOT NULL,
  PRIMARY KEY (`id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `operating_hours_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=244 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `option_data_sources`
--

DROP TABLE IF EXISTS `option_data_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `option_data_sources` (
  `id` varchar(50) NOT NULL,
  `label` varchar(100) NOT NULL,
  `description` text,
  `endpoint` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `organization`
--

DROP TABLE IF EXISTS `organization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` enum('First Nations','Inuit','Métis','National') NOT NULL,
  `province_or_territory` varchar(50) DEFAULT NULL,
  `is_national` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `description` text,
  `phone` varchar(25) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ptma`
--

DROP TABLE IF EXISTS `ptma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ptma` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` enum('PTMA','Hub') DEFAULT NULL,
  `region` varchar(100) NOT NULL,
  `indigenous_type` enum('First Nations','Métis','Inuit','Mixed','Other') NOT NULL,
  `province_code` char(2) DEFAULT NULL,
  `website_url` varchar(255) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `iset_full_name` varchar(255) DEFAULT NULL,
  `iset_code` varchar(50) DEFAULT NULL,
  `iset_status` varchar(20) DEFAULT NULL,
  `iset_province` varchar(50) DEFAULT NULL,
  `iset_indigenous_group` varchar(50) DEFAULT NULL,
  `iset_full_address` text,
  `iset_agreement_id` varchar(100) DEFAULT NULL,
  `iset_notes` text,
  `contact_name` varchar(255) DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `contact_notes` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `queue`
--

DROP TABLE IF EXISTS `queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slot_id` int NOT NULL,
  `location_id` int NOT NULL,
  `ticket_number` varchar(10) DEFAULT NULL,
  `status` enum('waiting','serving','complete','missed') DEFAULT 'waiting',
  `check_in_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `called_time` timestamp NULL DEFAULT NULL,
  `service_start_time` timestamp NULL DEFAULT NULL,
  `service_end_time` timestamp NULL DEFAULT NULL,
  `requeued` tinyint(1) DEFAULT '0',
  `counter_id` int DEFAULT NULL,
  `booking_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `slot_id` (`slot_id`),
  KEY `location_id` (`location_id`),
  KEY `counter_id` (`counter_id`),
  KEY `booking_id` (`booking_id`),
  CONSTRAINT `queue_ibfk_2` FOREIGN KEY (`slot_id`) REFERENCES `slot` (`id`),
  CONSTRAINT `queue_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`),
  CONSTRAINT `queue_ibfk_4` FOREIGN KEY (`counter_id`) REFERENCES `counter` (`id`),
  CONSTRAINT `queue_ibfk_5` FOREIGN KEY (`booking_id`) REFERENCES `booking` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `queue_event_log`
--

DROP TABLE IF EXISTS `queue_event_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue_event_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `queue_id` int NOT NULL,
  `event_type` enum('check_in','called','no_show','requeued','complete') NOT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `performed_by` int DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `queue_id` (`queue_id`),
  KEY `performed_by` (`performed_by`),
  CONSTRAINT `queue_event_log_ibfk_1` FOREIGN KEY (`queue_id`) REFERENCES `queue` (`id`),
  CONSTRAINT `queue_event_log_ibfk_2` FOREIGN KEY (`performed_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `reason_code`
--

DROP TABLE IF EXISTS `reason_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reason_code` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_type_id` int NOT NULL,
  `code` varchar(255) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `reason_code_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role`
--

DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `RoleID` int NOT NULL AUTO_INCREMENT,
  `RoleName` varchar(255) NOT NULL,
  `RoleDescription` text,
  PRIMARY KEY (`RoleID`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `service_type_component_link`
--

DROP TABLE IF EXISTS `service_type_component_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_type_component_link` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_type_id` int NOT NULL,
  `component_id` int NOT NULL,
  `step_number` int NOT NULL,
  `predecessor_step_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  KEY `component_id` (`component_id`),
  KEY `predecessor_step_id` (`predecessor_step_id`),
  CONSTRAINT `service_type_component_link_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`),
  CONSTRAINT `service_type_component_link_ibfk_2` FOREIGN KEY (`component_id`) REFERENCES `component` (`id`),
  CONSTRAINT `service_type_component_link_ibfk_3` FOREIGN KEY (`predecessor_step_id`) REFERENCES `service_type_component_link` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sla_stage_target`
--

DROP TABLE IF EXISTS `sla_stage_target`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sla_stage_target` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `stage_key` varchar(64) NOT NULL,
  `display_name` varchar(128) NOT NULL,
  `target_hours` int unsigned NOT NULL,
  `description` text,
  `applies_to_role` varchar(128) DEFAULT NULL,
  `active_from` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active_to` datetime DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(128) NOT NULL DEFAULT 'system',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(128) NOT NULL DEFAULT 'system',
  PRIMARY KEY (`id`),
  KEY `idx_sla_stage_target_stage` (`stage_key`),
  KEY `idx_sla_stage_target_role` (`applies_to_role`),
  KEY `idx_sla_stage_target_active` (`stage_key`,`applies_to_role`,`active_to`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `slot`
--

DROP TABLE IF EXISTS `slot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `slot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `location_id` int NOT NULL,
  `counter_type` varchar(50) NOT NULL,
  `counter_number` int NOT NULL,
  `date` date NOT NULL,
  `time` time NOT NULL,
  `is_booked` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=533 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `staff_profiles`
--

DROP TABLE IF EXISTS `staff_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cognito_sub` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `primary_role` enum('Program Administrator','Regional Coordinator','Application Assessor','System Administrator') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Application Assessor',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `region_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_profiles_cognito_sub` (`cognito_sub`),
  KEY `idx_staff_profiles_email` (`email`),
  KEY `idx_staff_profiles_primary_role` (`primary_role`),
  KEY `idx_staff_profiles_status` (`status`),
  KEY `idx_region` (`region_id`)
) ENGINE=InnoDB AUTO_INCREMENT=66879 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
) ENGINE=InnoDB AUTO_INCREMENT=122 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `step_component`
--

DROP TABLE IF EXISTS `step_component`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `step_component` (
  `id` int NOT NULL AUTO_INCREMENT,
  `step_id` int NOT NULL,
  `position` int NOT NULL,
  `template_id` int NOT NULL,
  `props_overrides` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_step_position` (`step_id`,`position`),
  KEY `ix_step_component_step` (`step_id`),
  KEY `ix_step_component_template` (`template_id`),
  CONSTRAINT `fk_step_component_step` FOREIGN KEY (`step_id`) REFERENCES `step` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_step_component_template` FOREIGN KEY (`template_id`) REFERENCES `component_template` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=1542 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_config`
--

DROP TABLE IF EXISTS `system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `key` varchar(128) NOT NULL,
  `value_json` json NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `updated_by` varchar(128) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_config_audit`
--

DROP TABLE IF EXISTS `system_config_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `key` varchar(128) NOT NULL,
  `prev_json` json DEFAULT NULL,
  `next_json` json NOT NULL,
  `actor` varchar(128) DEFAULT NULL,
  `diff_summary` varchar(512) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_system_config_audit_key_created` (`key`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_counter`
--

DROP TABLE IF EXISTS `ticket_counter`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_counter` (
  `location_id` int NOT NULL,
  `current_ticket_number` int DEFAULT '0',
  PRIMARY KEY (`location_id`),
  CONSTRAINT `ticket_counter_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `cognito_sub` varchar(64) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `suspended` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(50) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `preferred_language` varchar(50) NOT NULL,
  `notification_preferences` json DEFAULT NULL,
  `ptma_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `cognito_sub` (`cognito_sub`),
  KEY `fk_user_ptma` (`ptma_id`),
  CONSTRAINT `fk_user_ptma` FOREIGN KEY (`ptma_id`) REFERENCES `ptma` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_role_link`
--

DROP TABLE IF EXISTS `user_role_link`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_role_link` (
  `UserID` int NOT NULL,
  `RoleID` int NOT NULL,
  PRIMARY KEY (`UserID`,`RoleID`),
  KEY `RoleID` (`RoleID`),
  CONSTRAINT `user_role_link_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_role_link_ibfk_2` FOREIGN KEY (`RoleID`) REFERENCES `role` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_session_audit`
--

DROP TABLE IF EXISTS `user_session_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_session_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(128) NOT NULL,
  `session_key` varchar(160) NOT NULL,
  `issued_at` datetime NOT NULL,
  `last_seen_at` datetime NOT NULL,
  `ip_hash` char(64) NOT NULL,
  `user_agent_hash` char(64) NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_session` (`session_key`)
) ENGINE=InnoDB AUTO_INCREMENT=21325 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `value_added_service`
--

DROP TABLE IF EXISTS `value_added_service`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `value_added_service` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_type_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_included` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `service_type_id` (`service_type_id`),
  CONSTRAINT `value_added_service_ibfk_1` FOREIGN KEY (`service_type_id`) REFERENCES `service_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow`
--

DROP TABLE IF EXISTS `workflow`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `status` enum('draft','active','inactive') DEFAULT 'draft',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

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
-- Table structure for table `workflow_route_option`
--

DROP TABLE IF EXISTS `workflow_route_option`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_route_option` (
  `workflow_id` int NOT NULL,
  `source_step_id` int NOT NULL,
  `option_value` varchar(190) NOT NULL,
  `next_step_id` int NOT NULL,
  PRIMARY KEY (`workflow_id`,`source_step_id`,`option_value`),
  KEY `fk_wfro_source_step` (`source_step_id`),
  KEY `fk_wfro_next_step` (`next_step_id`),
  CONSTRAINT `fk_wfro_next_step` FOREIGN KEY (`next_step_id`) REFERENCES `step` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfro_source_step` FOREIGN KEY (`source_step_id`) REFERENCES `step` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfro_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `workflow` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_step`
--

DROP TABLE IF EXISTS `workflow_step`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_step` (
  `workflow_id` int NOT NULL,
  `step_id` int NOT NULL,
  `is_start` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`workflow_id`,`step_id`),
  KEY `fk_wfstep_step` (`step_id`),
  KEY `ix_wfstep_is_start` (`is_start`),
  CONSTRAINT `fk_wfstep_step` FOREIGN KEY (`step_id`) REFERENCES `step` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_wfstep_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `workflow` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'iset_intake'
--
/*!50003 DROP PROCEDURE IF EXISTS `CheckBILUsage` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `CheckBILUsage`(
    IN input_bilReference VARCHAR(50)
)
BEGIN
    DECLARE bil_count INT;

    
    SELECT COUNT(*) INTO bil_count
    FROM (
        SELECT bilReference FROM appointment WHERE bilReference = input_bilReference
        UNION ALL
        SELECT bilReference FROM booking WHERE bilReference = input_bilReference
    ) AS combined;

    
    IF bil_count > 0 THEN
        SELECT 'BIL Reference already used' AS status;
    ELSE
        SELECT 'BIL Reference is available' AS status;
    END IF;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `CheckInUser` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `CheckInUser`(
    IN p_booking_id INT,
    IN p_slot_id INT,
    IN p_location_id INT,
    IN p_ticket_number VARCHAR(10)
)
BEGIN
    INSERT INTO queue (
        booking_id,
        slot_id,
        location_id,
        ticket_number,
        status,
        check_in_time
    )
    VALUES (
        p_booking_id,
        p_slot_id,
        p_location_id,
        p_ticket_number,
        'waiting',
        NOW()
    );
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `GenerateTicketNumber` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GenerateTicketNumber`(
    IN p_service_type_id INT,
    IN p_location_id INT
)
BEGIN
    DECLARE v_prefix VARCHAR(5);
    DECLARE v_next_number INT;
    DECLARE v_ticket_number VARCHAR(10);

    
    SELECT prefix INTO v_prefix
    FROM queue_ticket_config
    WHERE service_type_id = p_service_type_id
      AND active = TRUE
    ORDER BY priority_level ASC
    LIMIT 1;

    
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number, 2) AS UNSIGNED)), 0) + 1
    INTO v_next_number
    FROM queue
    WHERE location_id = p_location_id
      AND ticket_number LIKE CONCAT(v_prefix, '%')
      AND DATE(check_in_time) = CURDATE();

    
    SET v_ticket_number = CONCAT(v_prefix, LPAD(v_next_number, 3, '0'));

    
    SELECT v_ticket_number AS ticketNumber;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `PurgeAppointments` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `PurgeAppointments`()
BEGIN
    
    SET FOREIGN_KEY_CHECKS = 0;

    
    UPDATE slot 
    SET is_booked = 0
    WHERE id IN (SELECT slot_id FROM booking);

    
    DELETE FROM queue;
    DELETE FROM booking;

    
    DELETE FROM appointment;
    DELETE FROM ticket_counter;

    
    ALTER TABLE queue AUTO_INCREMENT = 1;
    ALTER TABLE booking AUTO_INCREMENT = 1;
    ALTER TABLE appointment AUTO_INCREMENT = 1;
    ALTER TABLE ticket_counter AUTO_INCREMENT = 1;

    
    SET FOREIGN_KEY_CHECKS = 1;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `PurgeSlots` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `PurgeSlots`()
BEGIN
    
    SET FOREIGN_KEY_CHECKS = 0;

    
    CREATE TEMPORARY TABLE temp_deleted_count (count INT);

    
    DELETE FROM queue WHERE slot_id IN (SELECT id FROM slot);
    DELETE FROM booking WHERE slot_id IN (SELECT id FROM slot);

    
    DELETE FROM slot;
    INSERT INTO temp_deleted_count (count) VALUES (ROW_COUNT());

    
    ALTER TABLE slot AUTO_INCREMENT = 1;

    
    SET FOREIGN_KEY_CHECKS = 1;

    
    SELECT count FROM temp_deleted_count;

    
    DROP TEMPORARY TABLE temp_deleted_count;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-04 20:40:43
