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
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES (1,'20240528_add_document_type_to_iset_application_file.sql','2025-09-23 09:41:29'),(2,'20250827_add_cognito_columns_user.sql','2025-09-23 09:41:29'),(3,'20250827_add_cognito_columns_user_simple.sql','2025-09-23 09:42:04'),(4,'20250827_drop_password_column_user.sql','2025-09-23 09:42:47'),(5,'20250904_create_iset_application_draft_dynamic.sql','2025-09-23 09:43:22'),(6,'20250915_add_status_scan_columns_to_iset_application_file.sql','2025-09-23 09:44:26'),(7,'20250915_create_system_config.sql','2025-09-23 09:44:26'),(8,'20250918_create_iset_application_submission.sql','2025-09-23 09:44:54'),(9,'20250918_create_iset_runtime_config.sql','2025-09-23 09:44:54'),(10,'20250920_add_schema_snapshot_column.sql','2025-09-23 09:45:25'),(11,'20250924_add_description_to_iset_event_type.sql','2025-09-23 09:45:49'),(12,'20250927_add_internal_notifications.sql','2025-09-23 15:04:28'),(13,'20250928_create_canada_region.sql','2025-09-24 08:39:26'),(14,'20250925_add_case_columns_to_messages.sql','2025-10-23 11:55:46'),(15,'20251002_0006_add_sla_stage_target.sql','2025-10-23 11:55:53'),(16,'20251014_create_pending_uploads.sql','2025-10-23 11:55:53'),(17,'20251015_create_pending_uploads.sql','2025-10-23 11:55:53'),(18,'20251022_create_contact_message_tables.sql','2025-10-23 11:55:53'),(19,'20251023_create_esdc_submission_tables.sql','2025-10-23 11:59:11');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:22
