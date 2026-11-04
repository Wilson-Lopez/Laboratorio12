-- TallerMecanicoDB: Clientes (1) -> (N) Vehiculos + datos de prueba
-- Local: sqlcmd -S .\SQLEXPRESS -E -f 65001 -i TallerMecanicoDB.sql   (crea la base y las tablas)
-- Nube:  conectarse a la base creada en el panel del proveedor        (solo crea las tablas)
-- Ejecutarlo de nuevo reinicia las tablas y sus datos.
IF DB_NAME() = 'master' AND DB_ID('TallerMecanicoDB') IS NULL
    CREATE DATABASE TallerMecanicoDB;
GO
IF DB_NAME() = 'master'
    USE TallerMecanicoDB;
GO

DROP TABLE IF EXISTS Vehiculos;
DROP TABLE IF EXISTS Clientes;
GO

CREATE TABLE Clientes (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    Nombres   NVARCHAR(100) NOT NULL,
    Dni       NVARCHAR(8)   NOT NULL UNIQUE,
    Telefono  NVARCHAR(15)  NOT NULL,
    Correo    NVARCHAR(100) NULL
);

CREATE TABLE Vehiculos (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Placa        NVARCHAR(10) NOT NULL UNIQUE,
    Marca        NVARCHAR(50) NOT NULL,
    Modelo       NVARCHAR(50) NOT NULL,
    Anio         INT          NOT NULL CHECK (Anio BETWEEN 1980 AND 2030),
    Kilometraje  INT          NOT NULL CHECK (Kilometraje BETWEEN 0 AND 2000000),
    ClienteId    INT          NOT NULL REFERENCES Clientes(Id)
);
GO

INSERT INTO Clientes (Nombres, Dni, Telefono, Correo) VALUES
(N'Ana Lucía Torres Ramos',       '45781236', '987654321', 'ana.torres@correo.pe'),
(N'Carlos Alberto Mendoza Ruiz',  '70125489', '912345678', 'carlos.mendoza@correo.pe'),
(N'María Fernanda Quispe Huamán', '48963257', '956781234', 'maria.quispe@correo.pe'),
(N'Jorge Luis Paredes Salazar',   '72458931', '934567812', NULL),
(N'Rosa Elena Vargas Chávez',     '41236578', '978123456', 'rosa.vargas@correo.pe');

INSERT INTO Vehiculos (Placa, Marca, Modelo, Anio, Kilometraje, ClienteId) VALUES
('ABC-123', 'Toyota',    'Corolla',  2018,  85000, 1),
('BCD-234', 'Toyota',    'Hilux',    2021,  42000, 1),
('CDE-345', 'Hyundai',   'Accent',   2016, 120000, 2),
('DEF-456', 'Kia',       'Rio',      2020,  56000, 3),
('EFG-567', 'Nissan',    'Sentra',   2014, 178000, 3),
('FGH-678', 'Chevrolet', 'Sail',     2019,  67000, 4),
('GHI-789', 'Toyota',    'Yaris',    2022,  23000, 4);
GO

SELECT 'Clientes' AS Tabla, COUNT(*) AS Filas FROM Clientes
UNION ALL
SELECT 'Vehiculos', COUNT(*) FROM Vehiculos;
GO
