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
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-23 11:37:52
