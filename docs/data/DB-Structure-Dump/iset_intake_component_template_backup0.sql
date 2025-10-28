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
-- Dumping data for table `component_template_backup`
--

LOCK TABLES `component_template_backup` WRITE;
/*!40000 ALTER TABLE `component_template_backup` DISABLE KEYS */;
INSERT INTO `component_template_backup` VALUES (1,'radio',1,'radio','Radio Group','A group of radio buttons to let users select one option from a list.','{\"hint\": {\"text\": \"You can only choose one\"}, \"name\": \"example-radio\", \"items\": [{\"text\": \"Option 1\", \"value\": \"1\"}, {\"text\": \"Option 2\", \"value\": \"2\"}, {\"text\": \"Option 3\", \"value\": \"3\"}], \"classes\": \"govuk-radios govuk-radios--inline govuk-radios--small\", \"disabled\": false, \"fieldset\": {\"legend\": {\"text\": \"Choose an option\", \"classes\": \"govuk-fieldset__legend--l\", \"isPageHeading\": false}}, \"formGroup\": {\"classes\": \"\"}, \"attributes\": {\"data-options-endpoint\": \"$.props.endpoint\"}}','[{\"key\": \"legendText\", \"path\": \"fieldset.legend.text\", \"type\": \"text\", \"label\": \"Legend Text\"}, {\"key\": \"hintText\", \"path\": \"hint.text\", \"type\": \"text\", \"label\": \"Hint Text\"}, {\"key\": \"legendClasses\", \"path\": \"fieldset.legend.classes\", \"type\": \"select\", \"label\": \"Legend Classes\", \"options\": [{\"label\": \"Default (none)\", \"value\": \"\"}, {\"label\": \"Small (s)\", \"value\": \"govuk-fieldset__legend--s\"}, {\"label\": \"Medium (m)\", \"value\": \"govuk-fieldset__legend--m\"}, {\"label\": \"Large (l)\", \"value\": \"govuk-fieldset__legend--l\"}, {\"label\": \"Extra Large (xl)\", \"value\": \"govuk-fieldset__legend--xl\"}]}, {\"key\": \"isPageHeading\", \"path\": \"fieldset.legend.isPageHeading\", \"type\": \"select\", \"label\": \"Is Page Heading?\", \"options\": [{\"label\": \"Yes\", \"value\": true}, {\"label\": \"No\", \"value\": false}]}, {\"key\": \"name\", \"path\": \"name\", \"type\": \"text\", \"label\": \"Radio Group Name\"}, {\"key\": \"classes\", \"path\": \"classes\", \"type\": \"select\", \"label\": \"Container Classes\", \"options\": [{\"label\": \"Default (none)\", \"value\": \"\"}, {\"label\": \"Inline\", \"value\": \"govuk-radios--inline\"}, {\"label\": \"Small\", \"value\": \"govuk-radios--small\"}]}, {\"key\": \"formGroupClasses\", \"path\": \"formGroup.classes\", \"type\": \"select\", \"label\": \"Form Group Classes\", \"options\": [{\"label\": \"Default (none)\", \"value\": \"\"}, {\"label\": \"Error State\", \"value\": \"govuk-form-group--error\"}]}, {\"key\": \"disabled\", \"path\": \"disabled\", \"type\": \"select\", \"label\": \"Disabled\", \"options\": [{\"label\": \"Yes\", \"value\": true}, {\"label\": \"No\", \"value\": false}]}, {\"key\": \"options\", \"path\": \"items\", \"type\": \"optionList\", \"label\": \"Options\"}, {\"key\": \"required\", \"path\": \"required\", \"type\": \"select\", \"label\": \"Required\", \"options\": [{\"label\": \"Yes\", \"value\": true}, {\"label\": \"No\", \"value\": false}]}]','{% from \"govuk/components/radios/macro.njk\" import govukRadios %}\r \r   {{ govukRadios({\r     name: props.name,\r     fieldset: {\r       legend: {\r         text: props.fieldset.legend.text,\r         isPageHeading: props.fieldset.legend.isPageHeading,\r         classes: props.fieldset.legend.classes\r       }\r     },\r     hint: {\r       text: props.hint.text\r     },\r     classes: props.classes,\r     formGroup: {\r       classes: props.formGroup.classes\r     },\r     disabled: props.disabled,\r     items: props.items}) }}','active','2025-03-25 10:10:39','2025-08-22 09:43:36',1,'[\"text\", \"value\"]');
/*!40000 ALTER TABLE `component_template_backup` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-28 13:56:18
