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
-- Dumping data for table `ptma`
--

LOCK TABLES `ptma` WRITE;
/*!40000 ALTER TABLE `ptma` DISABLE KEYS */;
INSERT INTO `ptma` VALUES (1,'Sto:Lo Aboriginal Skills and Employment Training (SASET)','PTMA','Fraser Valley, British Columbia','First Nations','BC','https://saset.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Sto:Lo Aboriginal Skills and Employment Training (SASET)','SASET','Active','BC','First Nations','Fraser Valley, British Columbia','1234dd','There are some notes','Bill Sillery','bill@sillery.co.uk','5149751690','Notes go here'),(2,'Tribal Chiefs Employment and Training Services Association','PTMA','Central Alberta','First Nations','AB','https://tcetssa.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Tribal Chiefs Employment and Training Services Association','TCETSA','active','AB','First Nations','Central Alberta',NULL,NULL,NULL,NULL,NULL,NULL),(3,'Saskatchewan Indian Institute of Technologies (SIIT)','PTMA','Saskatchewan','First Nations','SK','https://siit.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Saskatchewan Indian Institute of Technologies (SIIT)','SIIT','active','SK','First Nations','Saskatchewan',NULL,NULL,NULL,NULL,NULL,NULL),(4,'Southeast Resource Development Council','PTMA','Eastern Manitoba','First Nations','MB','https://www.serdc.mb.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Southeast Resource Development Council','SERDC','active','MB','First Nations','Eastern Manitoba',NULL,NULL,NULL,NULL,NULL,NULL),(5,'Grand River Employment and Training (GREAT)','PTMA','Southern Ontario','First Nations','ON','https://greatsn.com',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Grand River Employment and Training (GREAT)','GREAT','active','ON','First Nations','Southern Ontario',NULL,NULL,NULL,NULL,NULL,NULL),(6,'Assembly of First Nations of Quebec and Labrador','PTMA','Quebec and Labrador','First Nations','QC','https://www.apnql.com',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Assembly of First Nations of Quebec and Labrador','AFNQL','active','QC','First Nations','Quebec and Labrador',NULL,NULL,NULL,NULL,NULL,NULL),(7,'Tungasuvvingat Inuit','PTMA','Ontario (Urban Inuit)','Inuit','ON','https://tiontario.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Tungasuvvingat Inuit','TI','active','ON','Inuit','Ontario (Urban Inuit)',NULL,NULL,NULL,NULL,NULL,NULL),(8,'Rupertsland Institute','PTMA','Alberta','Métis','AB','https://rupertsland.org',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Rupertsland Institute','RI','active','AB','Métis','Alberta',NULL,NULL,NULL,NULL,NULL,NULL),(9,'Manitoba Métis Federation (MMF)','PTMA','Manitoba','Métis','MB','https://www.mmf.mb.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Manitoba Métis Federation (MMF)','MMF','active','MB','Métis','Manitoba',NULL,NULL,NULL,NULL,NULL,NULL),(10,'Native Women\'s Association of Canada (NWAC)','Hub','National','Mixed','NA','https://nwac.ca',1,'2025-05-29 14:16:07','2025-06-18 13:08:42','Native Women\'s Association of Canada (NWAC)','NWAC','active','NA','Mixed','National',NULL,NULL,NULL,NULL,NULL,NULL),(11,'Yukon Aboriginal Women’s Council (YAWC)','Hub','Yukon','Mixed','YT','https://www.yawc.ca',1,'2025-06-05 13:02:47','2025-06-18 13:08:42','Yukon Aboriginal Women’s Council (YAWC)','YAWC','active','YT','Mixed','Yukon','TBD','','Darlene Skookum','isetcoordinator@yawc.ca','',''),(12,'The Alberta Institute for the Advancement of Aboriginal Women','Hub','Alberta','Mixed','AB','https://www.ai-aaw.org/',1,'2025-06-05 13:02:47','2025-06-18 13:08:42','The Alberta Institute for the Advancement of Aboriginal Women','AIAAW','active','AB','Mixed','Alberta','TBD','','Alison Poiron','iset@iaaw.ca','',''),(13,'Manitoba Moon Voices Inc. (MMVI)','Hub','Manitoba','Mixed','MB','https://www.moonvoices.ca',1,'2025-06-05 13:02:47','2025-06-18 13:08:42','Manitoba Moon Voices Inc. (MMVI)','MMVI','active','MB','Mixed','Manitoba','TBD','','Ardell Boubard','Iset@mmvi.ca','',''),(14,'Temiskaming Native Women’s Support Group (TNWSG)','Hub','Northern Ontario','Mixed','ON','https://www.tnwsg.ca',1,'2025-06-05 13:02:47','2025-06-18 13:08:42','Temiskaming Native Women’s Support Group (TNWSG)','TNWSG','active','ON','Mixed','Northern Ontario','TBD','','Kelly Hyde','k.hyde@keepersofthecircle.com','',''),(15,'Indigenous Women’s Association of the Wabanaki Territories (IWWT)','Hub','Atlantic Canada','Mixed','NB','https://www.iwwt.ca',1,'2025-06-05 13:02:47','2025-06-18 13:08:42','Indigenous Women’s Association of the Wabanaki Territories (IWWT)','IWWT','active','NB','Mixed','Atlantic Canada','TBD','','Mariah Sockabasin','isets@iwwt.ca','',''),(16,'Native Women’s Association of the NWT','Hub','Northwest Territories','Mixed','NT','https://placeholder-nwt.org',1,'2025-06-05 13:03:31','2025-06-18 13:08:42','Native Women’s Association of the NWT','NWAC-NWT','active','NT','Mixed','Northwest Territories','TBD','','Michelle LeMouel','ISETS@nativewomens.com','',''),(17,'British Columbia Native Women’s Association (BCNWA)','Hub','British Columbia','Mixed','BC','https://placeholder-bcnwa.org',1,'2025-06-05 13:03:31','2025-06-18 13:08:42','British Columbia Native Women’s Association (BCNWA)','BCNWA','active','BC','Mixed','British Columbia','TBD','','Jessica Savoy','isets@bcnwa.org','',''),(18,'Native Women’s Association of Canada Quebec region','Hub','Quebec','Mixed','QC','https://placeholder-nwac-quebec.org',1,'2025-06-05 13:03:31','2025-06-18 13:08:42','Native Women’s Association of Canada Quebec region','NWAC-QC','active','QC','Mixed','Quebec','TBD','','Sanaa Nachar','snachar@nwac.ca','',''),(19,'Nova Scotia Native Women’s Association (NSNWA)','Hub','Nova Scotia','Mixed','NS','https://placeholder-nsnwa.org',1,'2025-06-05 13:03:31','2025-06-18 13:08:42','Nova Scotia Native Women’s Association (NSNWA)','NSNWA','active','NS','Mixed','Nova Scotia','TBD','','Justine Maloney','employment@nsnwa.net','',''),(20,'Native Women’s Association of Canada Nunavut region','Hub','Nunavut','Mixed','NU','https://placeholder-nwac-nunavut.org',1,'2025-06-05 13:03:31','2025-06-18 13:08:42','Native Women’s Association of Canada Nunavut region','NWAC-NU','active','NU','Mixed','Nunavut','TBD','','Sanaa Nachar','snachar@nwac.ca','','');
/*!40000 ALTER TABLE `ptma` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:24
