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
-- Dumping data for table `holiday`
--

LOCK TABLES `holiday` WRITE;
/*!40000 ALTER TABLE `holiday` DISABLE KEYS */;
INSERT INTO `holiday` VALUES (1,'Republic Day','2025-01-26','National holiday in India'),(2,'Holi','2025-03-14','Festival of colors'),(3,'Dr. Ambedkar Jayanti','2025-04-14','Birthday of Dr. B.R. Ambedkar'),(4,'Independence Day','2025-08-15','National holiday in India'),(5,'Gandhi Jayanti','2025-10-02','Birthday of Mahatma Gandhi'),(6,'Diwali','2025-11-01','Festival of lights'),(7,'Christmas Day','2025-12-25','Christmas celebration'),(8,'Republic Day','2025-05-28','National holiday in Nepal'),(9,'Dashain','2025-10-01','Major Hindu festival in Nepal'),(10,'Tihar','2025-11-09','Festival of lights in Nepal'),(11,'Indra Jatra','2025-09-05','Festival in honor of Lord Indra'),(12,'Christmas Day','2025-12-25','Christmas celebration'),(13,'Independence Day','2025-02-04','National holiday in Sri Lanka'),(14,'Sinhala and Tamil New Year','2025-04-14','New Year celebration'),(15,'Vesak','2025-05-04','Buddha Purnima'),(16,'Poson Poya','2025-06-21','Buddhist festival'),(17,'Christmas Day','2025-12-25','Christmas celebration'),(18,'Pakistan Day','2025-03-23','National holiday in Pakistan'),(19,'Labour Day','2025-05-01','International Workers\' Day'),(20,'Independence Day','2025-08-14','National holiday in Pakistan'),(21,'Eid ul-Fitr','2025-04-01','Islamic festival marking the end of Ramadan'),(22,'Eid ul-Adha','2025-06-07','Islamic festival of sacrifice'),(23,'Christmas Day','2025-12-25','Christmas celebration'),(24,'Thursday Day Holiday','2025-02-13',NULL);
/*!40000 ALTER TABLE `holiday` ENABLE KEYS */;
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
