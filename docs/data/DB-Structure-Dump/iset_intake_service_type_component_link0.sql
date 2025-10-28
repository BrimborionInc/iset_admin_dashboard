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
-- Dumping data for table `service_type_component_link`
--

LOCK TABLES `service_type_component_link` WRITE;
/*!40000 ALTER TABLE `service_type_component_link` DISABLE KEYS */;
INSERT INTO `service_type_component_link` VALUES (1,1,8,8,NULL),(2,1,7,7,NULL),(3,1,6,6,NULL),(4,1,5,5,NULL),(5,1,4,4,NULL),(6,1,3,3,NULL),(7,1,2,2,NULL),(8,1,1,1,NULL),(9,2,8,8,NULL),(10,2,7,7,NULL),(11,2,6,6,NULL),(12,2,5,5,NULL),(13,2,4,4,NULL),(14,2,3,3,NULL),(15,2,2,2,NULL),(16,2,1,1,NULL),(17,3,8,8,NULL),(18,3,7,7,NULL),(19,3,6,6,NULL),(20,3,5,5,NULL),(21,3,4,4,NULL),(22,3,3,3,NULL),(23,3,2,2,NULL),(24,3,1,1,NULL),(25,4,8,8,NULL),(26,4,7,7,NULL),(27,4,6,6,NULL),(28,4,5,5,NULL),(29,4,4,4,NULL),(30,4,3,3,NULL),(31,4,2,2,NULL),(32,4,1,1,NULL),(33,5,8,8,NULL),(34,5,7,7,NULL),(35,5,6,6,NULL),(36,5,5,5,NULL),(37,5,4,4,NULL),(38,5,3,3,NULL),(39,5,2,2,NULL),(40,5,1,1,NULL),(41,6,8,8,NULL),(42,6,7,7,NULL),(43,6,6,6,NULL),(44,6,5,5,NULL),(45,6,4,4,NULL),(46,6,3,3,NULL),(47,6,2,2,NULL),(48,6,1,1,NULL),(49,7,8,8,NULL),(50,7,7,7,NULL),(51,7,6,6,NULL),(52,7,5,5,NULL),(53,7,4,4,NULL),(54,7,3,3,NULL),(55,7,2,2,NULL),(56,7,1,1,NULL),(57,8,8,8,NULL),(58,8,7,7,NULL),(59,8,6,6,NULL),(60,8,5,5,NULL),(61,8,4,4,NULL),(62,8,3,3,NULL),(63,8,2,2,NULL),(64,8,1,1,NULL),(65,9,8,8,NULL),(66,9,7,7,NULL),(67,9,6,6,NULL),(68,9,5,5,NULL),(69,9,4,4,NULL),(70,9,3,3,NULL),(71,9,2,2,NULL),(72,9,1,1,NULL);
/*!40000 ALTER TABLE `service_type_component_link` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:23
