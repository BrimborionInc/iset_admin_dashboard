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
-- Dumping data for table `iset_event_entry`
--

LOCK TABLES `iset_event_entry` WRITE;
/*!40000 ALTER TABLE `iset_event_entry` DISABLE KEYS */;
INSERT INTO `iset_event_entry` VALUES ('377a215f-3447-4d55-a5d7-892533c9a43c','case_lifecycle','status_changed','info','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"to\": \"pending_approval\", \"from\": \"submitted\", \"tracking_id\": \"ISET-20251027-16831F\"}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:30.331','2025-10-27 21:43:30.331'),('3ae7a321-9b21-468f-9014-8816e3c4da55','assessment','assessment_submitted','success','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"Assessment submitted by coordinator.\", \"tracking_id\": \"ISET-20251027-16831F\", \"evaluator_name\": null}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:30.339','2025-10-27 21:43:30.339'),('581e309d-c9dd-447e-bc9c-189d41e98aa9','assessment','nwac_review_submitted','info','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"NWAC review submitted.\", \"timestamp\": \"2025-10-27T21:43:39.691Z\", \"nwac_review\": \"agree\"}','CASE-2',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:39.701','2025-10-27 21:43:39.701'),('6949f74f-9702-4b98-abae-33c256c4554d','case_lifecycle','status_changed','info','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"to\": \"approved\", \"from\": \"pending_approval\", \"tracking_id\": \"ISET-20251027-16831F\"}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:39.401','2025-10-27 21:43:39.401'),('7507ab6c-1807-458a-8484-cfd1cd07357d','case_lifecycle','status_changed','info','admin','case','1','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"to\": \"in_review\", \"from\": \"submitted\", \"tracking_id\": \"ISET-20251027-71FA20\"}','ISET-20251027-71FA20',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 18:35:17.331','2025-10-27 18:35:17.331'),('799b6fa1-c447-4b00-903c-b2b01fe8fa5b','application_lifecycle','application_submitted','success','portal','case','2','applicant','48',NULL,'{\"ip\": \"::1\", \"message\": \"Application submitted.\", \"user_agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\", \"workflow_id\": \"iset-v1\", \"submission_id\": 2, \"reference_number\": \"ISET-20251027-16831F\"}','ISET-20251027-16831F',NULL,'48','2025-10-27 20:31:52.852','2025-10-27 20:31:52.852'),('7f9e2980-c5db-481a-851f-464b9a627345','case_lifecycle','case_assigned','info','admin','case','1','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"Case assigned to quebec.coordinator@awentech.ca.\", \"tracking_id\": \"ISET-20251027-71FA20\", \"to_assignee_id\": 165898, \"from_assignee_id\": null, \"to_assignee_name\": null, \"to_assignee_email\": \"quebec.coordinator@awentech.ca\", \"from_assignee_name\": null, \"from_assignee_email\": null}','ISET-20251027-71FA20',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 18:35:17.295','2025-10-27 18:35:17.295'),('9575dd0b-9ad6-4fe9-8894-11658709b31e','assessment','nwac_review_submitted','info','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"NWAC review submitted.\", \"tracking_id\": \"ISET-20251027-16831F\", \"evaluator_name\": null}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:39.651','2025-10-27 21:43:39.651'),('b1acabdb-0cbc-4a69-8967-9f31b1795755','case_lifecycle','case_assigned','info','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"Case assigned to bill@sillery.co.uk.\", \"tracking_id\": \"ISET-20251027-16831F\", \"to_assignee_id\": 164692, \"from_assignee_id\": null, \"to_assignee_name\": null, \"to_assignee_email\": \"bill@sillery.co.uk\", \"from_assignee_name\": null, \"from_assignee_email\": null}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-28 12:15:53.388','2025-10-28 12:15:53.388'),('d80701d8-61bc-4772-ad46-7343aef04d54','assessment','assessment_submitted','success','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"Assessment submitted by coordinator.\", \"tracking_id\": \"ISET-20251027-16831F\", \"evaluator_name\": null}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 20:38:25.369','2025-10-27 20:38:25.369'),('e9c02260-9cc0-48fe-9a5e-d957c9a5e097','case_lifecycle','status_changed','info','admin','case','1','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"to\": \"approved\", \"from\": \"in_review\", \"tracking_id\": \"ISET-20251027-71FA20\"}','ISET-20251027-71FA20',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 18:35:23.894','2025-10-27 18:35:23.894'),('eb49b182-5250-4910-ac37-23232001dbee','application_lifecycle','application_submitted','success','portal','case','1','applicant','48',NULL,'{\"ip\": \"::1\", \"message\": \"Application submitted.\", \"user_agent\": \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\", \"workflow_id\": \"iset-v1\", \"submission_id\": 1, \"reference_number\": \"ISET-20251027-71FA20\"}','ISET-20251027-71FA20',NULL,'48','2025-10-27 18:35:03.858','2025-10-27 18:35:03.858'),('ec766363-4326-4f7c-a84f-8f6c8e70b629','assessment','assessment_submitted','success','admin','case','2','staff','7cad7598-d0d1-708d-0d42-d2abfe7dd933',NULL,'{\"message\": \"Assessment submitted by coordinator.\", \"tracking_id\": \"ISET-20251027-16831F\", \"evaluator_name\": null}','ISET-20251027-16831F',NULL,'7cad7598-d0d1-708d-0d42-d2abfe7dd933','2025-10-27 21:43:39.643','2025-10-27 21:43:39.643');
/*!40000 ALTER TABLE `iset_event_entry` ENABLE KEYS */;
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
