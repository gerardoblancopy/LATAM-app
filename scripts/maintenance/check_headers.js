const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '..', '..', 'data', 'input', 'MODELO PLANTILLA DE DATOS V9_INTx.xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets['Lineas'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Read as array of arrays

// Header is usually the first row (index 0) or sometimes 1 if there's a title
console.log('Header Row:', data[0]);
