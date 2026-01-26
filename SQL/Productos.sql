
-- todo se debe agregar de 20 en 20 para facilitar futuras inserciones

INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 1. Accero (INS-001 / 001)
('Accero', 'Acetamiprid', 'INS-001', '001',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 2. Acido Alilico (INS-002 / 002)
('Acido Alilico', '', 'INS-002', '002',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 3. ACIDO FOSFORICO (REG-003 / 003)
('ACIDO FOSFORICO', 'Ácido Fosfórico', 'REG-003', '003',
 (SELECT id FROM categoria WHERE nombre = 'Reguladores de pH'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 4. ACIDO GLUTAMICO (BIO-004 / 004)
('ACIDO GLUTAMICO', 'Ácido Glutámico', 'BIO-004', '004',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 5. ACTARA (INS-005 / 005)
('ACTARA', 'Tiametoxam', 'INS-005', '005',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 6. ADON SIO (FFO-006 / 006)
('ADON SIO', 'Silicio Agrícola', 'FFO-006', '006',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 7. ADONEX (INS-007 / 007)
('ADONEX', '', 'INS-007', '007',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 8. Afalon (HER-008 / 008)
('Afalon', 'Linuron', 'HER-008', '008',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 9. Agribest (INS-009 / 009)
('Agribest', '', 'INS-009', '009',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 10. AGRIMECTIN (ACA-010 / 010)
('AGRIMECTIN', 'Abamectina', 'ACA-010', '010',
 (SELECT id FROM categoria WHERE nombre = 'Acaricidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 11. agrisafe (FUN-011 / 011)
('agrisafe', 'Extracto de Cítricos', 'FUN-011', '011',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 12. AGROKIN PLUS (BIO-012 / 012)
('AGROKIN PLUS', 'Aminoácidos + Vitaminas', 'BIO-012', '012',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 13. AGROKIN V (BIO-013 / 013)
('AGROKIN V', 'Aminoácidos', 'BIO-013', '013',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 14. AGRONUTRIENTE (FFO-014 / 014)
('AGRONUTRIENTE', 'Mezcla de Nutrientes', 'FFO-014', '014',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 15. AGROSURF (ADH-015 / 015)
('AGROSURF', 'Nonil Fenol', 'ADH-015', '015',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 16. Alexia (INS-016 / 016)
('Alexia', '', 'INS-016', '016',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 17. Allium 20 SL (INS-017 / 017)
('Allium 20 SL', 'Extracto de Ajo', 'INS-017', '017',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 18. Aminobolic (BIO-018 / 018)
('Aminobolic', 'Aminoácidos', 'BIO-018', '018',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 19. Aminox (HER-019 / 019)
('Aminox', '2,4-D Amina', 'HER-019', '019',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 20. Amistar (FUN-020 / 020)
('Amistar', 'Azoxistrobina', 'FUN-020', '020',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true);


 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 21. Amistar Top (FUN-021)
('Amistar Top', 'Azoxistrobina + Difenoconazol', 'FUN-021', '021',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 22. APLAU (INS-022) -> Buprofezin (Applaud)
('APLAU', 'Buprofezin', 'INS-022', '022',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 23. APRID 200 (INS-023) -> Acetamiprid
('APRID 200', 'Acetamiprid', 'INS-023', '023',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 24. AQUA PRO (HER-024) -> Glifosato Acuático
('AQUA PRO', 'Glifosato', 'HER-024', '024',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 25. AQUAMILD 40 SL (INS-025) -> Asumiendo Imidacloprid o similar
('AQUAMILD 40 SL', '', 'INS-025', '025',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 26. ATP+K (BIO-026)
('ATP+K', 'ATP + Potasio', 'BIO-026', '026',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 27. Atrapa 44 EC (INS-027) -> Malation. *CORREGIDO A CC*
('Atrapa 44 EC', 'Malation', 'INS-027', '027',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 28. AVAN GEL (FFO-028)
('AVAN GEL', 'Nutrientes Gel', 'FFO-028', '028',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 29. BACILLUS SAFENSIS OIL (FUN-029). *CORREGIDO A CC*
('BACILLUS SAFENSIS OIL', 'Bacillus safensis', 'FUN-029', '029',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 30. BACIMIN 6.4 WP (BAC-030). *CORREGIDO A GR*
('BACIMIN 6.4 WP', 'Kasugamicina', 'BAC-030', '030',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 31. BAC-OFF (BAC-031)
('BAC-OFF', 'Desinfectante', 'BAC-031', '031',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 32. Bacterol (BAC-032)
('Bacterol', 'Estreptomicina', 'BAC-032', '032',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 33. BARRENEM (NEM-033)
('BARRENEM', 'Extractos Botánicos', 'NEM-033', '033',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 34. Barrier (FFO-034)
('Barrier', 'Calcio + Silicio', 'FFO-034', '034',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 35. BAYFOLAN (FFO-035)
('BAYFOLAN', 'NPK Foliar', 'FFO-035', '035',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 36. BEAVERDE (INS-036)
('BEAVERDE', 'Beauveria bassiana', 'INS-036', '036',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 37. BIO INSECT (INS-037)
('BIO INSECT', 'Extractos Botánicos', 'INS-037', '037',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 38. BIOCIDA SUPER OZONO (BAC-038)
('BIOCIDA SUPER OZONO', 'Desinfectante', 'BAC-038', '038',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 39. Biocontrol extracto de citricos 20 SL (FUN-039). *CORREGIDO A CC*
('Biocontrol extracto de citricos 20 SL', 'Extracto de Cítricos', 'FUN-039', '039',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 40. Biocontrol mimosa (FUN-040)
('Biocontrol mimosa', 'Extracto de Mimosa', 'FUN-040', '040',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 41. Bioestim Max DS (BIO-041) *Corregido a GR*
('Bioestim Max DS', 'Bioestimulante', 'BIO-041', '041',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 42. Bioestim Max EM (BIO-042) *Corregido a CC*
('Bioestim Max EM', 'Microorganismos Eficientes', 'BIO-042', '042',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 43. Biofrut (FFO-043)
('Biofrut', 'Fertilizante Foliar', 'FFO-043', '043',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 44. BIOREPEL (INS-044)
('BIOREPEL', 'Extracto de Ajo/Ají', 'INS-044', '044',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 45. BIOTECH BMI (FUN-045)
('BIOTECH BMI', 'Bacillus / Biológico', 'FUN-045', '045',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 46. BIOTIKA GOBER (FUN-046)
('BIOTIKA GOBER', 'Extracto de Gobernadora', 'FUN-046', '046',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 47. Biotrysec (FUN-047)
('Biotrysec', 'Extractos Cítricos', 'FUN-047', '047',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 48. BIOWALL (FUN-048)
('BIOWALL', 'Inductor de Resistencia', 'FUN-048', '048',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 49. BOTRYSEC (FUN-049)
('BOTRYSEC', 'Extractos Vegetales', 'FUN-049', '049',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 50. Bralic (INS-050)
('Bralic', 'Extracto de Ajo', 'INS-050', '050',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 51. Bryosei (BIO-051)
('Bryosei', 'Bioestimulante', 'BIO-051', '051',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 52. BST 2,5 SC (INS-052) *Corregido a CC*
('BST 2,5 SC', 'Beta-ciflutrina', 'INS-052', '052',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 53. Bufermin (REG-053)
('Bufermin', 'Regulador de pH', 'REG-053', '053',
 (SELECT id FROM categoria WHERE nombre = 'Reguladores de pH'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 54. Calcio Boro (FFO-054)
('Calcio Boro', 'Calcio + Boro', 'FFO-054', '054',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 55. CAPALSA (INS-055)
('CAPALSA', 'Capsaicina / Ajo', 'INS-055', '055',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 56. CARBON ECO POTASI K (FFO-056)
('CARBON ECO POTASI K', 'Potasio + Carbono', 'FFO-056', '056',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 57. Cardinal (INS-057)
('Cardinal', 'Fipronil', 'INS-057', '057',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 58. CINNALYS (ACA-058)
('CINNALYS', 'Extracto de Canela', 'ACA-058', '058',
 (SELECT id FROM categoria WHERE nombre = 'Acaricidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 59. Citobooster 3000 (BIO-059)
('Citobooster 3000', 'Citoquininas', 'BIO-059', '059',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 60. CLORFOS 48 EC (INS-060)
('CLORFOS 48 EC', 'Clorpirifos', 'INS-060', '060',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 61. COMPLEX (FFO-061)
('COMPLEX', 'Complejo Nutricional', 'FFO-061', '061',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 62. CONNECT (INS-062)
('CONNECT', 'Imidacloprid + Beta-ciflutrina', 'INS-062', '062',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 63. CUMULOS (FUN-063)
('CUMULOS', 'Azufre Elemental', 'FUN-063', '063',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 64. CUNEB FORTE (FUN-064)
('CUNEB FORTE', 'Ditiocarbamato', 'FUN-064', '064',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 65. CURBIX PLUS (INS-065)
('CURBIX PLUS', 'Etiprole', 'INS-065', '065',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 66. CYTOGAL (BIO-066)
('CYTOGAL', 'Citoquininas', 'BIO-066', '066',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 67. Dazitol (NEM-067)
('Dazitol', 'Capsaicina + Aceites', 'NEM-067', '067',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 68. DCS3 (BAC-068)
('DCS3', 'Dióxido de Cloro', 'BAC-068', '068',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 69. Defense (FUN-069)
('Defense', 'Fosfitos', 'FUN-069', '069',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 70. Denim Fit (INS-070)
('Denim Fit', 'Emamectina + Lufenuron', 'INS-070', '070',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 71. DESFAN (BAC-071)
('DESFAN', 'Amonio Cuaternario', 'BAC-071', '071',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 72. DIATOMITA (INS-072)
('DIATOMITA', 'Tierra de Diatomeas', 'INS-072', '072',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 73. Dibron (INS-073)
('Dibron', 'Naled', 'INS-073', '073',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 74. DIPEL (INS-074)
('DIPEL', 'Bacillus thuringiensis', 'INS-074', '074',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 75. DLS F1 (FER-075) *Asumido Fertilizante Sólido*
('DLS F1', 'Formula DLS', 'FER-075', '075',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 76. DNC F2 (FFO-076) *Asumido Fertilizante Foliar Líquido*
('DNC F2', 'Formula DNC', 'FFO-076', '076',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 77. Domador (INS-077)
('Domador', 'Insecticida Genérico', 'INS-077', '077',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 78. ECO ROOT (BIO-078)
('ECO ROOT', 'Enraizante', 'BIO-078', '078',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 79. EcoBotanik 30 EC (INS-079) *Corregido a CC*
('EcoBotanik 30 EC', 'Extracto Botánico', 'INS-079', '079',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 80. ECOSTATIC X (ADH-080)
('ECOSTATIC X', 'Coadyuvante', 'ADH-080', '080',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);


INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 81. ENERFOL (BIO-081)
('ENERFOL', 'Aminoácidos + NPK', 'BIO-081', '081',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 82. ENLAZADOR (FUN-082) *Corregido: Base Cobre, Polvo*
('ENLAZADOR', 'Cobre', 'FUN-082', '082',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 83. ENLAZADOR X2 (FUN-083) *Alineado con Enlazador*
('ENLAZADOR X2', 'Cobre Concentrado', 'FUN-083', '083',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 84. EROFOL AMINO K (BIO-084)
('EROFOL AMINO K', 'Aminoácidos + Potasio', 'BIO-084', '084',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 85. ESTRABACTER (BAC-085)
('ESTRABACTER', 'Estreptomicina', 'BAC-085', '085',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 86. EVITO (FUN-086)
('EVITO', 'Fluoxastrobin', 'FUN-086', '086',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 87. Faisenonema (NEM-087)
('Faisenonema', 'Paecilomyces lilacinus', 'NEM-087', '087',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 88. FANGE (FUN-088)
('FANGE', 'Fungicida', 'FUN-088', '088',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 89. Fange Leben (FUN-089)
('Fange Leben', 'Fungicida Biológico', 'FUN-089', '089',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 90. FAS TAC GOLD (INS-090)
('FAS TAC GOLD', 'Alfa-cipermetrina', 'INS-090', '090',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 91. Ferrum SL (FFO-091)
('Ferrum SL', 'Hierro Quelatado', 'FFO-091', '091',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 92. FILM KOVER (ADH-092)
('FILM KOVER', 'Coadyuvante', 'ADH-092', '092',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 93. FITOPHOS CU (FUN-093)
('FITOPHOS CU', 'Fosfito de Cobre', 'FUN-093', '093',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 94. Fitosanix (BAC-094)
('Fitosanix', 'Desinfectante Agrícola', 'BAC-094', '094',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 95. FLOREX MOB (FFO-095)
('FLOREX MOB', 'Molibdeno + Boro', 'FFO-095', '095',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 96. FLORONE (BIO-096)
('FLORONE', 'Bioestimulante Floración', 'BIO-096', '096',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 97. FOLIATON ZN (FFO-097)
('FOLIATON ZN', 'Zinc Foliar', 'FFO-097', '097',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 98. FORAMIL (INS-098)
('FORAMIL', 'Metomil', 'INS-098', '098',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 99. Foraxil (FUN-099)
('Foraxil', 'Metalaxil', 'FUN-099', '099',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 100. FORMUESPINO (INS-100)
('FORMUESPINO', 'Spinosad', 'INS-100', '100',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES


INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 101. Formula De la Sierra (FFO-101)
('Formula De la Sierra', 'Fórmula DLS', 'FFO-101', '101',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 102. FORMULA FAIR FRUITS (FFO-102)
('FORMULA FAIR FRUITS', 'Fórmula Fair Fruits', 'FFO-102', '102',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 103. Fortaleza (BIO-103)
('Fortaleza', 'Inductor de Resistencia', 'BIO-103', '103',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 104. Fosguard K (FUN-104)
('Fosguard K', 'Fosfito de Potasio', 'FUN-104', '104',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 105. Fost Alexin K (FUN-105)
('Fost Alexin K', 'Fosfito de Potasio', 'FUN-105', '105',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 106. FULL CROP (FFO-106)
('FULL CROP', 'NPK + Microelementos', 'FFO-106', '106',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 107. Fungicel (FUN-107)
('Fungicel', 'Clorotalonil', 'FUN-107', '107',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 108. FUSILADE (HER-108)
('FUSILADE', 'Fluazifop-p-butil', 'HER-108', '108',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 109. FUTRON (INS-109)
('FUTRON', 'Insecticidas Genérico', 'INS-109', '109',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 110. GENIO 99 (ADH-110)
('GENIO 99', 'Aceite Agrícola', 'ADH-110', '110',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 111. Growsil 100 SL (FFO-111) *Corregido a CC*
('Growsil 100 SL', 'Silicio Soluble', 'FFO-111', '111',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 112. HCA 25 (FFO-112)
('HCA 25', 'Calcio Complejado', 'FFO-112', '112',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 113. HERO CUPRO 70 (FUN-113)
('HERO CUPRO 70', 'Oxicloruro de Cobre', 'FUN-113', '113',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 114. HERO VITAL VEGETAL (BIO-114)
('HERO VITAL VEGETAL', 'Extractos Vegetales', 'BIO-114', '114',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 115. HEROFOL DENSO VERDE (FFO-115)
('HEROFOL DENSO VERDE', 'NPK Alto Nitrógeno', 'FFO-115', '115',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 116. HEROFOL N SULFUL GEL (FFO-116)
('HEROFOL N SULFUL GEL', 'Nitrógeno + Azufre', 'FFO-116', '116',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 117. Humato de Calcio (ENM-117)
('Humato de Calcio', 'Ácidos Húmicos + Ca', 'ENM-117', '117',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 118. HUMINARE (ENM-118)
('HUMINARE', 'Ácidos Húmicos', 'ENM-118', '118',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 119. INAG-STIM (BIO-119)
('INAG-STIM', 'Bioestimulante', 'BIO-119', '119',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 120. ION FULLHUM (ENM-120)
('ION FULLHUM', 'Ácidos Húmicos', 'ENM-120', '120',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);


-- 121. ION MICRO (FFO-121)
('ION MICRO', 'Micronutrientes Mix', 'FFO-121', '121',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 122. ION P47 (FER-122) *Corregido: Fertilizante Edáfico / LB*
('ION P47', 'Fósforo', 'FER-122', '122',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 123. ION ROOT (BIO-123)
('ION ROOT', 'Enraizante', 'BIO-123', '123',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 124. Ishkamik (BIO-124)
('Ishkamik', 'Aminoácidos', 'BIO-124', '124',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 125. JAYDAK BIO (INS-125)
('JAYDAK BIO', 'Insecticida Biológico', 'INS-125', '125',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 126. K FOL (FFO-126)
('K FOL', 'Potasio Foliar', 'FFO-126', '126',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 127. K FRUTO (FFO-127)
('K FRUTO', 'Potasio Llenado', 'FFO-127', '127',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 128. K OLEO (INS-128)
('K OLEO', 'Oleato de Potasio', 'INS-128', '128',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 129. K TIONIC (BIO-129)
('K TIONIC', 'Potasio + Bioestimulante', 'BIO-129', '129',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 130. Karate (INS-130)
('Karate', 'Lambda Cihalotrina', 'INS-130', '130',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 131. Kilate (INS-131)
('Kilate', 'Insecticida', 'INS-131', '131',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 132. Kung Fu (INS-132)
('Kung Fu', 'Lambda Cihalotrina', 'INS-132', '132',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 133. Kynetic 4 (BIO-133)
('Kynetic 4', 'Bioestimulante', 'BIO-133', '133',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 134. LANDRIS 6.8 EC (INS-134)
('LANDRIS 6.8 EC', 'Insecticida EC', 'INS-134', '134',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 135. LECAVERDE (INS-135)
('LECAVERDE', 'Lecanicillium lecanii', 'INS-135', '135',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 136. Limo-k (INS-136)
('Limo-k', 'Extracto Cítrico', 'INS-136', '136',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 137. LPG (INS-137) *Corregido a Insecticida*
('LPG', 'Insecticida', 'INS-137', '137',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 138. MAINSTAY CALCIO (FFO-138)
('MAINSTAY CALCIO', 'Calcio Tecnificado', 'FFO-138', '138',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 139. Mantis Extra (INS-139)
('Mantis Extra', 'Imidacloprid', 'INS-139', '139',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 140. Mastercop (FUN-140)
('Mastercop', 'Sulfato de Cobre', 'FUN-140', '140',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);

INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 141. Mate (INS-141)
('Mate', 'Emamectina Benzoato', 'INS-141', '141',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 142. Maxigrow (BIO-142)
('Maxigrow', 'Bioestimulante Completo', 'BIO-142', '142',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 143. Melisei (BIO-143)
('Melisei', 'Bioestimulante', 'BIO-143', '143',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 144. META VERDE (INS-144)
('META VERDE', 'Metarhizium anisopliae', 'INS-144', '144',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 145. MILINI (INS-145)
('MILINI', 'Insecticida', 'INS-145', '145',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 146. Milstop (FUN-146) *Corregido a GR*
('Milstop', 'Bicarbonato de Potasio', 'FUN-146', '146',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 147. Mimoten (NEM-147)
('Mimoten', 'Extracto de Mimosa', 'NEM-147', '147',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 148. MIR CU 9 (FUN-148)
('MIR CU 9', 'Cobre Quelatado', 'FUN-148', '148',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 149. MIRADOR 25 SC (FUN-149)
('MIRADOR 25 SC', 'Azoxistrobina', 'FUN-149', '149',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 150. MOCAP (NEM-150)
('MOCAP', 'Etoprofos', 'NEM-150', '150',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 151. MONITOR (INS-151)
('MONITOR', 'Metamidofos', 'INS-151', '151',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 152. MultiFruto Calcio Boro (FFO-152)
('MultiFruto Calcio Boro', 'Calcio + Boro', 'FFO-152', '152',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 153. MURALLA DELTA (INS-153)
('MURALLA DELTA', 'Betaciflutrina + Imidacloprid', 'INS-153', '153',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 154. Mustang (INS-154)
('Mustang', 'Zeta-cipermetrina', 'INS-154', '154',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 155. MYCOTROL ESO (INS-155)
('MYCOTROL ESO', 'Beauveria bassiana', 'INS-155', '155',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 156. N potenz (FFO-156)
('N potenz', 'Nitrógeno', 'FFO-156', '156',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 157. NATUR K (FFO-157)
('NATUR K', 'Potasio', 'FFO-157', '157',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 158. NERTHUS (BIO-158)
('NERTHUS', 'Bioestimulante', 'BIO-158', '158',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 159. NEWFOLD K (FFO-159)
('NEWFOLD K', 'Potasio', 'FFO-159', '159',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 160. NewMectin (INS-160)
('NewMectin', 'Abamectina', 'INS-160', '160',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 161. NOFLY (INS-161)
('NOFLY', 'Paecilomyces fumosoroseus', 'INS-161', '161',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 162. NOVISIL (ADH-162)
('NOVISIL', 'Silicio', 'ADH-162', '162',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 163. Npk brotes (FFO-163)
('Npk brotes', 'NPK', 'FFO-163', '163',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 164. Oberon (ACA-164)
('Oberon', 'Spiromesifen', 'ACA-164', '164',
 (SELECT id FROM categoria WHERE nombre = 'Acaricidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 165. Omicron BF 2000 (BAC-165)
('Omicron BF 2000', 'Sanitizante', 'BAC-165', '165',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 166. Omicron Bio (BIO-166)
('Omicron Bio', 'Bioestimulante', 'BIO-166', '166',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 167. OPTIMAT (ADH-167)
('OPTIMAT', 'Coadyuvante', 'ADH-167', '167',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 168. Orius (FUN-168)
('Orius', 'Tebuconazole', 'FUN-168', '168',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 169. OZO JIA 2BV7 (BAC-169)
('OZO JIA 2BV7', 'Aceite Ozonizado', 'BAC-169', '169',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 170. ParaFungi (FUN-170)
('ParaFungi', 'Fungicida', 'FUN-170', '170',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 171. PEHUEN 54 (HER-171)
('PEHUEN 54', 'Glifosato', 'HER-171', '171',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 172. PERFECTOSE PLUS (BIO-172)
('PERFECTOSE PLUS', 'Aminoácidos', 'BIO-172', '172',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 173. PEROXIDO DE HIDROGENO KG (BAC-173)
('PEROXIDO DE HIDROGENO KG', 'Peróxido de Hidrógeno', 'BAC-173', '173',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 174. Pestilent (INS-174)
('Pestilent', 'Insecticida', 'INS-174', '174',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 175. PESTRIN (INS-175)
('PESTRIN', 'Piretroide', 'INS-175', '175',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 176. Phyton 6.6 SL (FUN-176) *Corregido a CC*
('Phyton 6.6 SL', 'Sulfato de Cobre', 'FUN-176', '176',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 177. PICUS KNOCK (INS-177)
('PICUS KNOCK', 'Imidacloprid', 'INS-177', '177',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 178. PILATUS (BIO-178)
('PILATUS', 'Extractos + Hormonas', 'BIO-178', '178',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 179. PIREDOWN (INS-179)
('PIREDOWN', 'Piretrinas', 'INS-179', '179',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 180. PIRETRINA (INS-180)
('PIRETRINA', 'Piretrina Natural', 'INS-180', '180',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 181. POLISULFURO DE CALCIO (FUN-181)
('POLISULFURO DE CALCIO', 'Polisulfuro de Calcio', 'FUN-181', '181',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 182. POTENZSIL (FFO-182)
('POTENZSIL', 'Silicio + Potasio', 'FFO-182', '182',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 183. Prevalor (FUN-183)
('Prevalor', 'Propamocarb + Fosetil-Al', 'FUN-183', '183',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 184. Progranic Mega (INS-184)
('Progranic Mega', 'Extractos Vegetales', 'INS-184', '184',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 185. Progranic Neemacar 65EC (INS-185) *Corregido a CC*
('Progranic Neemacar 65EC', 'Extracto de Neem', 'INS-185', '185',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 186. Querkus (FUN-186)
('Querkus', 'Extracto de Quercus', 'FUN-186', '186',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 187. RAIZAL (BIO-187) *Corregido a GR*
('RAIZAL', 'Auxinas / Hormonas', 'BIO-187', '187',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 188. RANMAN 40 SC (FUN-188)
('RANMAN 40 SC', 'Cyazofamid', 'FUN-188', '188',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 189. Razormin (BIO-189)
('Razormin', 'Aminoácidos + NPK', 'BIO-189', '189',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 190. Regalia (FUN-190)
('Regalia', 'Reynoutria sachalinensis', 'FUN-190', '190',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 191. resiste K SL (FFO-191) *Corregido a CC*
('resiste K SL', 'Potasio + Silicio', 'FFO-191', '191',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 192. Rikoderma (FUN-192)
('Rikoderma', 'Trichoderma spp.', 'FUN-192', '192',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 193. ROOTENZ BIO WP (BIO-193)
('ROOTENZ BIO WP', 'Bacillus / Enraizante', 'BIO-193', '193',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 194. Rovral (FUN-194)
('Rovral', 'Iprodiona', 'FUN-194', '194',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 195. ROYA OUT (FUN-195)
('ROYA OUT', 'Fungicida Roya', 'FUN-195', '195',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 196. SALVATE (INS-196) *Corregido a GR*
('SALVATE', 'Acetamiprid', 'INS-196', '196',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 197. SAVON (INS-197)
('SAVON', 'Jabón Potásico', 'INS-197', '197',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 198. Seka Mix (FFO-198)
('Seka Mix', 'Nutrientes Desecantes', 'FFO-198', '198',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 199. SENCOR (HER-199)
('SENCOR', 'Metribuzin', 'HER-199', '199',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 200. Serifel (FUN-200) *Corregido a GR*
('Serifel', 'Bacillus amyloliquefaciens', 'FUN-200', '200',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true);


 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 201. SIGANEX (FUN-201)
('SIGANEX', 'Pirimetanil', 'FUN-201', '201',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 202. SIKON FERT AZUFRE (FFO-202)
('SIKON FERT AZUFRE', 'Azufre Líquido', 'FFO-202', '202',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 203. SILI CALCIO (FFO-203)
('SILI CALCIO', 'Silicio + Calcio', 'FFO-203', '203',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 204. SILI POTASIO (FFO-204)
('SILI POTASIO', 'Silicio + Potasio', 'FFO-204', '204',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 205. SILIMAGNESIO (FFO-205)
('SILIMAGNESIO', 'Silicio + Magnesio', 'FFO-205', '205',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 206. SMARTHOR (INS-206)
('SMARTHOR', 'Tiametoxam + Bifentrina', 'INS-206', '206',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 207. Soga negra 1/4 (HMA-207) *Categoría: Herramientas Manuales*
('Soga negra 1/4', 'Polipropileno', 'HMA-207', '207',
 (SELECT id FROM categoria WHERE nombre = 'Herramientas Manuales'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 208. Sonata (FUN-208)
('Sonata', 'Bacillus pumilus', 'FUN-208', '208',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 209. STICKEROIL 88 EC (ADH-209)
('STICKEROIL 88 EC', 'Aceite Agrícola', 'ADH-209', '209',
 (SELECT id FROM categoria WHERE nombre = 'Adherentes / Dispersantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 210. SULFATO FERROSO (FER-210) *Corregido a GR*
('SULFATO FERROSO', 'Sulfato Ferroso', 'FER-210', '210',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 211. SUM BIO PLUS (BIO-211)
('SUM BIO PLUS', 'Bioestimulante', 'BIO-211', '211',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 212. SUM CARBOXY (FFO-212)
('SUM CARBOXY', 'Ácidos Carboxílicos', 'FFO-212', '212',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 213. SUM PEROXY (BAC-213)
('SUM PEROXY', 'Peróxido de Hidrógeno', 'BAC-213', '213',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 214. SUM ZINC BORO (FFO-214)
('SUM ZINC BORO', 'Zinc + Boro', 'FFO-214', '214',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 215. Supralid (INS-215)
('Supralid', 'Acetamiprid', 'INS-215', '215',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 216. Switch (FUN-216) *Corregido a GR*
('Switch', 'Ciprodinil + Fludioxonil', 'FUN-216', '216',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 217. TAKUMI (INS-217)
('TAKUMI', 'Flubendiamida', 'INS-217', '217',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 218. Terra Mix (ENM-218)
('Terra Mix', 'Enmienda Húmica', 'ENM-218', '218',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 219. THIMET (INS-219)
('THIMET', 'Forato', 'INS-219', '219',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 220. THURIVERDE (INS-220)
('THURIVERDE', 'Bacillus thuringiensis', 'INS-220', '220',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);

 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 221. TRIAMIN PLUS (BIO-221)
('TRIAMIN PLUS', 'Aminoácidos', 'BIO-221', '221',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 222. VIGONARE (BIO-222) *Corregido el nombre*
('VIGONARE', 'Bioestimulante Radicular', 'BIO-222', '222',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 223. VYDATE 24 SL (NEM-223)
('VYDATE 24 SL', 'Oxamil', 'NEM-223', '223',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 224. WINNER 6 XC (INS-224)
('WINNER 6 XC', 'Spinetoram', 'INS-224', '224',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 225. Xentari (INS-225) *Corregido a GR*
('Xentari', 'Bacillus thuringiensis', 'INS-225', '225',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 226. XILOTROM (FUN-226)
('XILOTROM', 'Extracto 1.8 Cineol', 'FUN-226', '226',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 227. Yaramila Complex (FER-227) *Corregido Nombre y Unidad a LB*
('Yaramila Complex', 'NPK Complex', 'FER-227', '227',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 228. YARAVITA ZINTRAC (FFO-228)
('YARAVITA ZINTRAC', 'Zinc Flow', 'FFO-228', '228',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 229. Zarpa (INS-229)
('Zarpa', 'Acetamiprid', 'INS-229', '229',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 230. Zellticida (BAC-230)
('Zellticida', 'Desinfectante', 'BAC-230', '230',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 231. Zerotol (BAC-231)
('Zerotol', 'Ácido Peroxiacético', 'BAC-231', '231',
 (SELECT id FROM categoria WHERE nombre = 'Bactericidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 232. TATIO (FUN-232)
('TATIO', 'Azoxistrobina + Difenoconazol', 'FUN-232', '232',
 (SELECT id FROM categoria WHERE nombre = 'Fungicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 233. FUMINAT 80 SL (NEM-233)
('FUMINAT 80 SL', 'Extracto de Liquidámbar', 'NEM-233', '233',
 (SELECT id FROM categoria WHERE nombre = 'Nematicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 234. MANTIS (INS-234)
('MANTIS', 'Imidacloprid', 'INS-234', '234',
 (SELECT id FROM categoria WHERE nombre = 'Insecticidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 235. 0-0-60 YARAMILA (FER-235)
('0-0-60 YARAMILA', 'Cloruro de Potasio', 'FER-235', '235',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 236. 10-40-10 (FER-236)
('10-40-10', 'NPK Starter', 'FER-236', '236',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 237. 12-61-00 (FER-237)
('12-61-00', 'MAP', 'FER-237', '237',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 238. 15-15-15 MASTER (FER-238) *Corregido a LB*
('15-15-15 MASTER', 'NPK Triple 15', 'FER-238', '238',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 239. 18-46-0 YARAMILA (FER-239) *Corregido Nombre y Unidad a LB*
('18-46-0 YARAMILA', 'DAP', 'FER-239', '239',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 240. ADON CALCIO (FFO-240)
('ADON CALCIO', 'Calcio', 'FFO-240', '240',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true);


 INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES
-- 241. ADON MAGNESIO (FFO-241)
('ADON MAGNESIO', 'Magnesio', 'FFO-241', '241',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 242. ALGA PLUS (BIO-242)
('ALGA PLUS', 'Extracto de Algas', 'BIO-242', '242',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 243. Blaukorn (FER-243)
('Blaukorn', 'NPK Complejo', 'FER-243', '243',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 244. Calcinit (FER-244)
('Calcinit', 'Nitrato de Calcio', 'FER-244', '244',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 245. FERTI PLUS (FFO-245)
('FERTI PLUS', 'Aminoácidos + NPK', 'FFO-245', '245',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Foliares'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 246. FERTICAL (FER-246)
('FERTICAL', 'Calcio', 'FER-246', '246',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 247. FULL HARBEST (BIO-247) *Unidad GR a petición*
('FULL HARBEST', 'Bioestimulante', 'BIO-247', '247',
 (SELECT id FROM categoria WHERE nombre = 'Bioestimulantes'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 248. HAIFA 0-52-34 (FER-248)
('HAIFA 0-52-34', 'MKP', 'FER-248', '248',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 249. Humi k 80 (ENM-249)
('Humi k 80', 'Ácidos Húmicos', 'ENM-249', '249',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 250. Humifert (ENM-250)
('Humifert', 'Ácidos Húmicos + NPK', 'ENM-250', '250',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 251. HYDRO COMPLEX (FER-251)
('HYDRO COMPLEX', 'NPK YaraMila', 'FER-251', '251',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 252. ION 320 (FER-252)
('ION 320', 'Fórmula ION', 'FER-252', '252',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 253. ION 7-22-22 (FER-253)
('ION 7-22-22', 'NPK', 'FER-253', '253',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 254. ION CALCIUM (FER-254)
('ION CALCIUM', 'Calcio', 'FER-254', '254',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 255. ION FRUT 62.5 (FER-255)
('ION FRUT 62.5', 'Potasio', 'FER-255', '255',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 256. NITRABOR (FER-256)
('NITRABOR', 'Nitrato de Calcio + Boro', 'FER-256', '256',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 257. Nitrato de amonio (FER-257)
('Nitrato de amonio', 'Nitrato de Amonio', 'FER-257', '257',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 258. NITRATO DE POTASIO (FER-258)
('NITRATO DE POTASIO', 'Nitrato de Potasio', 'FER-258', '258',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 259. PELICANO SULFATO DE MAGNESIO (FER-259)
('PELICANO SULFATO DE MAGNESIO', 'Sulfato de Magnesio', 'FER-259', '259',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 260. POW HUMUS (ENM-260) *Unidad GR a petición*
('POW HUMUS', 'Ácidos Húmicos', 'ENM-260', '260',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true);

INSERT INTO producto (nombre, ingredienteactivo, codigo, codigoalt, categoriaid, unidadid, activo)
VALUES

-- 261. SOLUCAT 10-10-40 (FER-261)
('SOLUCAT 10-10-40', 'NPK Soluble', 'FER-261', '261',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 262. SOLUMIX (FER-262)
('SOLUMIX', 'Mezcla Micronutrientes', 'FER-262', '262',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 263. SUM FIRMEZA (FER-263)
('SUM FIRMEZA', 'Calcio / Silicio', 'FER-263', '263',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 264. UNIK YARA (FER-264)
('UNIK YARA', 'Nitrato de Potasio / Calcio', 'FER-264', '264',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 265. YESO AGRICOLA (ENM-265)
('YESO AGRICOLA', 'Sulfato de Calcio', 'ENM-265', '265',
 (SELECT id FROM categoria WHERE nombre = 'Enmiendas de Suelo'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 266. ION BORO (FER-266)
('ION BORO', 'Boro', 'FER-266', '266',
 (SELECT id FROM categoria WHERE nombre = 'Fertilizantes Edáficos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 267. CINTA DE GOTE VIVALDI 2200 MT (RIE-267)
('CINTA DE GOTE VIVALDI 2200 MT', 'Cinta de Riego', 'RIE-267', '267',
 (SELECT id FROM categoria WHERE nombre = 'Materiales de Riego'), 
 (SELECT id FROM unidad WHERE abreviatura = 'und'), true),

-- 268. Cinta de Goteo Turbo Slim (RIE-268)
('Cinta de Goteo Turbo Slim', 'Cinta de Riego', 'RIE-268', '268',
 (SELECT id FROM categoria WHERE nombre = 'Materiales de Riego'), 
 (SELECT id FROM unidad WHERE abreviatura = 'und'), true),

-- 269. MULCH FRESERO SIN PERFORAR (PLA-269)
-- Se asigna a 'Insumos' ya que 'Insumos / Plásticos' no existe en la lista de categorías.
('MULCH FRESERO SIN PERFORAR', 'Plástico Acolchado', 'PLA-269', '269',
 (SELECT id FROM categoria WHERE nombre = 'Insumos'), 
 (SELECT id FROM unidad WHERE abreviatura = 'und'), true),

-- 270. Paraquat (HER-270)
('Paraquat', 'Paraquat', 'HER-270', '270',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 271. HALOFOR 75 WG (HER-271)
-- Nota: Herbicida sistémico en gramos (gr o g, verifica cuál tienes registrado).
('HALOFOR 75 WG', 'Herbicida sistémico selectivo', 'HER-271', '271',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'gr'), true),

-- 272. FLEX (HER-272)
('FLEX', 'Fomesafen', 'HER-272', '272',
 (SELECT id FROM categoria WHERE nombre = 'Herbicidas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'cc'), true),

-- 273. Semilla de ejote Lomami (SEM-273)
('Semilla de ejote Lomami', 'Semilla de Ejote', 'SEM-273', '273',
 (SELECT id FROM categoria WHERE nombre = 'Semillas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 274. SEMILLA DE EJOTE ROBUSTA (SEM-274)
('SEMILLA DE EJOTE ROBUSTA', 'Semilla de Ejote', 'SEM-274', '274',
 (SELECT id FROM categoria WHERE nombre = 'Semillas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true),

-- 275. SEMILLA DE EJOTE TURACO (SEM-275)
('SEMILLA DE EJOTE TURACO', 'Semilla de Ejote', 'SEM-275', '275',
 (SELECT id FROM categoria WHERE nombre = 'Semillas'), 
 (SELECT id FROM unidad WHERE abreviatura = 'lb'), true);