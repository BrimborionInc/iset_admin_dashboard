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
-- Dumping data for table `organization`
--

LOCK TABLES `organization` WRITE;
/*!40000 ALTER TABLE `organization` DISABLE KEYS */;
INSERT INTO `organization` VALUES (1,'Native Women’s Association of Canada (NWAC)','National','QC',1,1,'National Indigenous organization representing political voices of Indigenous Women, Girls, Two-Spirit, Transgender, and Gender-Diverse+ (WG2STGD+) People in Canada.','613-722-3033','iset@nwac.ca','https://nwac.ca/programs/iset','120 Promenade du Portage',NULL,'Gatineau','J8X 2K1'),(2,'Congress of Aboriginal Peoples (CAP)','National','ON',1,1,'Provides funding and assistance for training and skills development to members of CAP\'s provincial organizations.',NULL,'applications@abo-peoples.org','https://abo-peoples.org/program/indigenous-skills-and-employment-training-iset/',NULL,NULL,NULL,NULL),(3,'Dehcho First Nations','First Nations','NT',0,1,'Provides education and training programs, including the ISET Program, to support Indigenous peoples in the Dehcho region.','(867) 695-2610','receptionist@dehcho.org','https://dehcho.org/education-training/iset-programs/','9414 - 100 Street',NULL,'Fort Simpson','X0E 0N0'),(4,'Métis Nation of Ontario (MNO)','Métis','ON',0,1,'Provides a compilation of all Ontario ISET agreement holders and serves as a quick guide for clientele and employment and training officers.',NULL,NULL,'https://www.metisnation.org/wp-content/uploads/2023/09/ISETS-Dir.pdf',NULL,NULL,NULL,NULL),(5,'First Peoples Development Inc. (FPDI)','First Nations','MB',0,1,'Facilitates partnerships to develop and deliver training-to-employment programs to meet labor market needs.',NULL,NULL,'https://fpdinc.ca/',NULL,NULL,NULL,NULL),(6,'Aboriginal Community Career Employment Services Society (ACCESS)','First Nations','BC',0,1,'Provides employment and training services to Indigenous peoples in the Lower Mainland of British Columbia.','604-251-7955','tradesadmin@accessfutures.com','https://accessfutures.com/','110 – 1607 East Hastings Street',NULL,'Vancouver','V5L 1S7'),(7,'Stó:lō Aboriginal Skills & Employment Training (SASET)','First Nations','BC',0,1,'Provides employment and training services to Indigenous peoples in the Fraser Valley region of British Columbia.','604-858-3691','info@saset.ca','https://saset.ca/','Bldg. #5B – 7201 Vedder Rd.',NULL,'Chilliwack','V2R 4G5'),(8,'Métis Nation British Columbia (MNBC)','Métis','BC',0,1,'Provides employment and training services to Métis individuals in British Columbia.','604-557-5851','info@mnbc.ca','https://www.mnbc.ca/','#380 – 13401 108 Ave',NULL,'Surrey','V3T 5T3'),(9,'Kativik Regional Government','Inuit','QC',0,1,'Provides employment and training services to Inuit individuals in the Nunavik region of Quebec.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,'Tungasuvvingat Inuit','Inuit','ON',0,1,'Provides employment and training services to Inuit individuals in Ontario.',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `organization` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:30
