-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Creato il: Set 17, 2025 alle 09:05
-- Versione del server: 8.0.43-0ubuntu0.22.04.1
-- Versione PHP: 8.1.2-1ubuntu2.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `asp_esenzioni_ok`
--

-- --------------------------------------------------------

--
-- Struttura della tabella `prestazione`
--

CREATE TABLE `prestazione` (
  `id` int NOT NULL,
  `regione` varchar(10) DEFAULT NULL,
  `data_erogazione` varchar(20) DEFAULT NULL,
  `quantita` int DEFAULT NULL,
  `codice_prodotto` varchar(100) DEFAULT NULL,
  `descrizione` text,
  `tariffa` double DEFAULT NULL,
  `id_ricetta` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Struttura della tabella `protocollo`
--

CREATE TABLE `protocollo` (
  `id_protocollo` int NOT NULL,
  `protocollo` varchar(16) NOT NULL,
  `anno` int NOT NULL,
  `cf_esente` varchar(16) NOT NULL,
  `cf_dichiarante` varchar(16) DEFAULT NULL,
  `cf_titolare` varchar(16) DEFAULT NULL,
  `esenzione` varchar(10) DEFAULT NULL,
  `data_inizio` varchar(10) DEFAULT NULL,
  `data_fine` varchar(10) DEFAULT NULL,
  `esito` varchar(100) DEFAULT NULL,
  `descrizione` text,
  `importo_totale` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Struttura della tabella `ricetta`
--

CREATE TABLE `ricetta` (
  `id` int NOT NULL,
  `numero` varchar(20) NOT NULL,
  `tipologia` enum('specialistica','farmaceutica') DEFAULT NULL,
  `struttura` varchar(100) DEFAULT NULL,
  `ubicazione` varchar(100) DEFAULT NULL,
  `data_prescrizione` varchar(10) DEFAULT NULL,
  `data_spedizione` varchar(10) DEFAULT NULL,
  `ticket` double DEFAULT NULL,
  `id_protocollo` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `prestazione`
--
ALTER TABLE `prestazione`
  ADD PRIMARY KEY (`id`),
  ADD KEY `prestazione_ricetta_id_fk` (`id_ricetta`);

--
-- Indici per le tabelle `protocollo`
--
ALTER TABLE `protocollo`
  ADD PRIMARY KEY (`id_protocollo`),
  ADD UNIQUE KEY `protocollo_pk_2` (`protocollo`,`anno`);

--
-- Indici per le tabelle `ricetta`
--
ALTER TABLE `ricetta`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ricetta_protocollo_id_protocollo_fk` (`id_protocollo`);

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `prestazione`
--
ALTER TABLE `prestazione`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT per la tabella `protocollo`
--
ALTER TABLE `protocollo`
  MODIFY `id_protocollo` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT per la tabella `ricetta`
--
ALTER TABLE `ricetta`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Limiti per le tabelle scaricate
--

--
-- Limiti per la tabella `prestazione`
--
ALTER TABLE `prestazione`
  ADD CONSTRAINT `prestazione_ricetta_id_fk` FOREIGN KEY (`id_ricetta`) REFERENCES `ricetta` (`id`);

--
-- Limiti per la tabella `ricetta`
--
ALTER TABLE `ricetta`
  ADD CONSTRAINT `ricetta_protocollo_id_protocollo_fk` FOREIGN KEY (`id_protocollo`) REFERENCES `protocollo` (`id_protocollo`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
