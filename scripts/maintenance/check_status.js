const xlsx = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '..', '..', 'data', 'input', 'MODELO PLANTILLA DE DATOS V9_INTx.xlsx');
const workbook = xlsx.readFile(EXCEL_FILE);
const sheet = workbook.Sheets['Lineas'];
const data = xlsx.utils.sheet_to_json(sheet);

const uniqueStatuses = [...new Set(data.map(item => item['Estado']))];
console.log('Unique "Estado" values:', uniqueStatuses);
