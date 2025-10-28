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
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `iset_internal_notification`
--

LOCK TABLES `iset_internal_notification` WRITE;
/*!40000 ALTER TABLE `iset_internal_notification` DISABLE KEYS */;
INSERT INTO `iset_internal_notification` VALUES (1,'application_submitted','info','New application submitted','Application ISET-20251027-71FA20 has been submitted.','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 1, \"eventId\": \"eb49b182-5250-4910-ac37-23232001dbee\", \"eventType\": \"application_submitted\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:03',NULL,NULL),(2,'application_submitted','info','New application submitted','Application ISET-20251027-71FA20 has been submitted.','role','System Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"System Administrator\", \"caseId\": 1, \"eventId\": \"eb49b182-5250-4910-ac37-23232001dbee\", \"eventType\": \"application_submitted\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:03',NULL,NULL),(3,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-71FA20) to quebec.coordinator@awentech.ca.','role','System Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"System Administrator\", \"caseId\": 1, \"eventId\": \"7f9e2980-c5db-481a-851f-464b9a627345\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(4,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-71FA20) to quebec.coordinator@awentech.ca.','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 1, \"eventId\": \"7f9e2980-c5db-481a-851f-464b9a627345\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(5,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-71FA20) to quebec.coordinator@awentech.ca.','user',NULL,165898,1,0,NULL,NULL,'{\"role\": \"Regional Coordinator\", \"caseId\": 1, \"eventId\": \"7f9e2980-c5db-481a-851f-464b9a627345\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(6,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-71FA20) to quebec.coordinator@awentech.ca.','user',NULL,164772,1,0,NULL,NULL,'{\"role\": \"Application Assessor\", \"caseId\": 1, \"eventId\": \"7f9e2980-c5db-481a-851f-464b9a627345\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(7,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-71FA20) to quebec.coordinator@awentech.ca.','user',NULL,48,1,0,NULL,NULL,'{\"role\": \"applicant\", \"caseId\": 1, \"eventId\": \"7f9e2980-c5db-481a-851f-464b9a627345\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(8,'status_changed','info','Status changed','Status changed - Tracking ID: ISET-20251027-71FA20','user',NULL,165898,1,0,NULL,NULL,'{\"role\": \"Regional Coordinator\", \"caseId\": 1, \"eventId\": \"7507ab6c-1807-458a-8484-cfd1cd07357d\", \"eventType\": \"status_changed\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(9,'status_changed','info','Status changed','Status changed - Tracking ID: ISET-20251027-71FA20','user',NULL,164772,1,0,NULL,NULL,'{\"role\": \"Application Assessor\", \"caseId\": 1, \"eventId\": \"7507ab6c-1807-458a-8484-cfd1cd07357d\", \"eventType\": \"status_changed\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:17',NULL,NULL),(10,'status_changed','info','Status changed','Status changed - Tracking ID: ISET-20251027-71FA20','user',NULL,165898,1,0,NULL,NULL,'{\"role\": \"Regional Coordinator\", \"caseId\": 1, \"eventId\": \"e9c02260-9cc0-48fe-9a5e-d957c9a5e097\", \"eventType\": \"status_changed\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:23',NULL,NULL),(11,'status_changed','info','Status changed','Status changed - Tracking ID: ISET-20251027-71FA20','user',NULL,164772,1,0,NULL,NULL,'{\"role\": \"Application Assessor\", \"caseId\": 1, \"eventId\": \"e9c02260-9cc0-48fe-9a5e-d957c9a5e097\", \"eventType\": \"status_changed\", \"trackingId\": \"ISET-20251027-71FA20\"}',NULL,'2025-10-27 14:35:23',NULL,NULL),(12,'application_submitted','info','New application submitted','Application ISET-20251027-16831F has been submitted.','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"799b6fa1-c447-4b00-903c-b2b01fe8fa5b\", \"eventType\": \"application_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 16:31:52',NULL,NULL),(13,'application_submitted','info','New application submitted','Application ISET-20251027-16831F has been submitted.','role','System Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"System Administrator\", \"caseId\": 2, \"eventId\": \"799b6fa1-c447-4b00-903c-b2b01fe8fa5b\", \"eventType\": \"application_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 16:31:52',NULL,NULL),(14,'assessment_submitted','success','Assessment submitted','Assessment submitted - Tracking ID: ISET-20251027-16831F','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"d80701d8-61bc-4772-ad46-7343aef04d54\", \"eventType\": \"assessment_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 16:38:25',NULL,NULL),(15,'assessment_submitted','success','Assessment submitted','Assessment submitted - Tracking ID: ISET-20251027-16831F','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"3ae7a321-9b21-468f-9014-8816e3c4da55\", \"eventType\": \"assessment_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 17:43:30',NULL,NULL),(16,'assessment_submitted','success','Assessment submitted','Assessment submitted - Tracking ID: ISET-20251027-16831F','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"ec766363-4326-4f7c-a84f-8f6c8e70b629\", \"eventType\": \"assessment_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 17:43:39',NULL,NULL),(17,'nwac_review_submitted','info','NWAC review submitted','NWAC review submitted - Tracking ID: ISET-20251027-16831F','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"9575dd0b-9ad6-4fe9-8894-11658709b31e\", \"eventType\": \"nwac_review_submitted\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-27 17:43:39',NULL,NULL),(18,'nwac_review_submitted','info','NWAC review submitted','NWAC review submitted - Tracking ID: CASE-2','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"581e309d-c9dd-447e-bc9c-189d41e98aa9\", \"eventType\": \"nwac_review_submitted\", \"trackingId\": null}',NULL,'2025-10-27 17:43:39',NULL,NULL),(19,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-16831F) to bill@sillery.co.uk.','role','System Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"System Administrator\", \"caseId\": 2, \"eventId\": \"b1acabdb-0cbc-4a69-8967-9f31b1795755\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-28 08:15:53',NULL,NULL),(20,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-16831F) to bill@sillery.co.uk.','role','Program Administrator',NULL,1,0,NULL,NULL,'{\"role\": \"Program Administrator\", \"caseId\": 2, \"eventId\": \"b1acabdb-0cbc-4a69-8967-9f31b1795755\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-28 08:15:53',NULL,NULL),(21,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-16831F) to bill@sillery.co.uk.','user',NULL,164692,1,0,NULL,NULL,'{\"role\": \"Regional Coordinator\", \"caseId\": 2, \"eventId\": \"b1acabdb-0cbc-4a69-8967-9f31b1795755\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-28 08:15:53',NULL,NULL),(22,'case_assigned','info','Case assigned','Case assigned (ISET-20251027-16831F) to bill@sillery.co.uk.','user',NULL,48,1,0,NULL,NULL,'{\"role\": \"applicant\", \"caseId\": 2, \"eventId\": \"b1acabdb-0cbc-4a69-8967-9f31b1795755\", \"eventType\": \"case_assigned\", \"trackingId\": \"ISET-20251027-16831F\"}',NULL,'2025-10-28 08:15:53',NULL,NULL);
/*!40000 ALTER TABLE `iset_internal_notification` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:20
