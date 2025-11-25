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
-- Table structure for table `iset_case_note`
--

DROP TABLE IF EXISTS `iset_case_note`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `iset_case_note` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_id` bigint unsigned NOT NULL,
  `author_staff_profile_id` bigint unsigned DEFAULT NULL,
  `author_user_id` int DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '1',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `follow_up_at` datetime DEFAULT NULL,
  `reminder_id` bigint unsigned DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` datetime(3) DEFAULT NULL,
  `edited_at` datetime(3) DEFAULT NULL,
  `edited_by_staff_profile_id` bigint unsigned DEFAULT NULL,
  `edited_by_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_case_created_at` (`case_id`,`created_at`),
  KEY `idx_case_pinned_created` (`case_id`,`is_pinned`,`created_at`),
  KEY `idx_author_staff_profile` (`author_staff_profile_id`),
  KEY `idx_author_user` (`author_user_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `fk_case_note_editor_profile` (`edited_by_staff_profile_id`),
  KEY `fk_case_note_editor_user` (`edited_by_user_id`),
  KEY `idx_case_note_follow_up` (`case_id`,`follow_up_at`),
  KEY `fk_case_note_reminder` (`reminder_id`),
  CONSTRAINT `fk_case_note_author_profile` FOREIGN KEY (`author_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_note_author_user` FOREIGN KEY (`author_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_note_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_note_editor_profile` FOREIGN KEY (`edited_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_note_editor_user` FOREIGN KEY (`edited_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_note_reminder` FOREIGN KEY (`reminder_id`) REFERENCES `iset_case_reminder` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-25 18:18:55
