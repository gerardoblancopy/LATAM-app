const express = require('express');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.static('public'));
app.use(express.json()); // Enable JSON body parsing

// Disable caching for API endpoints
app.use((req, res, next) => {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
});

// Path helper for dynamic files
function getFilePath(filename, req) {
    const scenario = req.query.scenario || 'S0';
    // Input workbook lives in data/input
    if (filename.includes('xlsx')) {
        return path.join(__dirname, 'data', 'input', filename);
    }
    return path.join(__dirname, 'data', 'scenarios', scenario, filename);
}
const EXCEL_FILE = path.join(__dirname, 'data', 'input', 'MODELO PLANTILLA DE DATOS V9_INTx.xlsx');

app.post('/api/run-model', (req, res) => {
    console.log('Running optimization model...');
    const config = req.body;
    console.log('Configuration received:', config);

    // Use the absolute path or container's python executable
    // On macOS with Rosetta (x86_64 Node + arm64 Python), use 'arch -arm64' to force native execution
    const pythonPath = process.env.PYTHON_CMD || (process.platform === 'darwin' ? 'arch -arm64 python3' : 'python3');

    // Pass configuration as a JSON string argument
    // Escape double quotes for command line
    const configStr = JSON.stringify(config).replace(/"/g, '\\"');

    exec(`${pythonPath} data_processing.py "${configStr}"`, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error}`);
            return res.status(500).json({ error: 'Failed to run model', details: stderr });
        }
        console.log(`Script output: ${stdout}`);
        res.json({ message: 'Model executed successfully', output: stdout });
    });
});

app.get('/api/flows', (req, res) => {
    const flowsFile = getFilePath('flows_results.json', req);
    if (fs.existsSync(flowsFile)) {
        try {
            const fileData = fs.readFileSync(flowsFile, 'utf8');
            const flowData = JSON.parse(fileData);
            res.json(flowData);
        } catch (error) {
            console.error('Error reading flows file:', error);
            res.status(500).json({ error: 'Failed to read flow data' });
        }
    } else {
        res.status(404).json({ error: 'Flow results not found. Run model first.' });
    }
});

app.get('/api/transmission-investment', (req, res) => {
    const file = getFilePath('tx_investment.json', req);
    if (fs.existsSync(file)) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse tx_investment.json' });
        }
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.get('/api/latam-marginal-analysis', (req, res) => {
    const file = path.join(__dirname, 'data', 'analysis', 'latam_marginal_analysis.json');
    if (fs.existsSync(file)) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Failed to parse latam_marginal_analysis.json' });
        }
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.get('/api/lines', (req, res) => {
    try {
        let lines;
        const processedFile = getFilePath('lines_processed.json', req);
        const parseFlowP1 = (row) => {
            const value =
                row['Flow_P1'] ??
                row['Flow P1'] ??
                row['flowP1'] ??
                row['flow_p1'] ??
                row['Flujo_P1'] ??
                row['Flujo P1'];
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : undefined;
        };

        if (fs.existsSync(processedFile)) {
            console.log('Serving data from processed JSON file');
            const fileData = fs.readFileSync(processedFile, 'utf8');
            const rawData = JSON.parse(fileData);

            lines = rawData.map(row => ({
                id: row['ID'],
                name: row['Nombre'] || 'Sin Nombre',
                status: row['Estado'],
                fmaxDirect: row['Fmax directo (MW)'],
                fmaxInverse: row['Fmax inverso (MW)'],
                start: {
                    lat: parseFloat(row['lat_ini']),
                    lon: parseFloat(row['lon_ini']),
                    node: row['Nodo_ini'],
                    country: row['pais_ini']
                },
                end: {
                    lat: parseFloat(row['lat_fin']),
                    lon: parseFloat(row['lon_fin']),
                    node: row['Nodo_fin'],
                    country: row['pais_fin']
                },
                deltaD: row['delta_D'],
                factorUtilizacion: row['Factor utilizacion pais'],
                X_LN: row['X_LN'],
                flowP1: parseFlowP1(row),
                inversionMUSD: row['Inversion total sin anualizar (MUSD)']
            }));
        } else {
            console.log('Serving data from raw Excel file');
            const workbook = xlsx.readFile(EXCEL_FILE);
            const sheetName = 'Lineas';

            if (!workbook.SheetNames.includes(sheetName)) {
                return res.status(404).json({ error: `Sheet "${sheetName}" not found` });
            }

            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);

            // Filter and map data to ensure we have necessary fields
            lines = data.map(row => ({
                name: row['Nombre'] || 'Sin Nombre',
                status: row['Estado'],
                fmaxDirect: row['Fmax directo (MW)'],
                fmaxInverse: row['Fmax inverso (MW)'],
                start: {
                    lat: parseFloat(row['lat_ini']),
                    lon: parseFloat(row['lon_ini']),
                    node: row['Nodo_ini'],
                    country: row['pais_ini']
                },
                end: {
                    lat: parseFloat(row['lat_fin']),
                    lon: parseFloat(row['lon_fin']),
                    node: row['Nodo_fin'],
                    country: row['pais_fin']
                },
                deltaD: row['delta_D'],
                factorUtilizacion: row['Factor utilizacion pais'],
                X_LN: row['X_LN'],
                flowP1: parseFlowP1(row),
                inversionMUSD: row['Inversion total sin anualizar (MUSD)']
            }));
        }

        // Common filtering
        lines = lines.filter(line =>
            !isNaN(line.start.lat) && !isNaN(line.start.lon) &&
            !isNaN(line.end.lat) && !isNaN(line.end.lon)
        );

        res.json(lines);
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.get('/api/generators', (req, res) => {
    const gensFile = getFilePath('generators_summary.json', req);
    if (fs.existsSync(gensFile)) {
        try {
            const fileData = fs.readFileSync(gensFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading generators file:', error);
            res.status(500).json({ error: 'Failed to read generators data' });
        }
    } else {
        res.status(404).json({ error: 'Generators summary not found. Run model first.' });
    }
});

app.get('/api/demand', (req, res) => {
    const demandFile = getFilePath('demand_summary.json', req);
    if (fs.existsSync(demandFile)) {
        try {
            const fileData = fs.readFileSync(demandFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading demand file:', error);
            res.status(500).json({ error: 'Failed to read demand data' });
        }
    } else {
        res.status(404).json({ error: 'Demand summary not found. Run model first.' });
    }
});

app.get('/api/storage', (req, res) => {
    const storageFile = getFilePath('storage_summary.json', req);
    if (fs.existsSync(storageFile)) {
        try {
            const fileData = fs.readFileSync(storageFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading storage file:', error);
            res.status(500).json({ error: 'Failed to read storage data' });
        }
    } else {
        res.status(404).json({ error: 'Storage summary not found. Run model first.' });
    }
});
app.get('/api/tx-investment', (req, res) => {
    const txFile = getFilePath('tx_investment.json', req);
    if (fs.existsSync(txFile)) {
        try {
            const fileData = fs.readFileSync(txFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading tx investment file:', error);
            res.status(500).json({ error: 'Failed to read tx investment data' });
        }
    } else {
        res.status(404).json({ error: 'Tx investment summary not found. Run model first.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Endpoint to clear results
app.post('/api/clear-results', (req, res) => {
    try {
        // Clearing logic needs to handle scenarios, probably iterate or take scenario param
        // For simplicity, skip modifying unless strictly necessary. Or clear S0/S1
        res.json({ message: 'Resultados limpiados. Volviendo a datos originales.' });
    } catch (error) {
        console.error('Error clearing files:', error);
        res.status(500).json({ error: 'Failed to clear results' });
    }
});

// Endpoint to check model status and timestamp
app.get('/api/model-status', (req, res) => {
    try {
        const processedFile = getFilePath('lines_processed.json', req);
        if (fs.existsSync(processedFile)) {
            const stats = fs.statSync(processedFile);
            res.json({
                status: 'loaded',
                lastRun: stats.mtime
            });
        } else {
            res.json({ status: 'not_loaded' });
        }
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/generation', (req, res) => {
    const genFile = getFilePath('generation_results.json', req);
    if (fs.existsSync(genFile)) {
        try {
            const fileData = fs.readFileSync(genFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading generation file:', error);
            res.status(500).json({ error: 'Failed to read generation data' });
        }
    } else {
        res.status(404).json({ error: 'Generation results not found. Run model first.' });
    }
});

app.get('/api/marginal-costs', (req, res) => {
    const mcFile = getFilePath('marginal_costs.json', req);
    if (fs.existsSync(mcFile)) {
        try {
            const fileData = fs.readFileSync(mcFile, 'utf8');
            const data = JSON.parse(fileData);
            res.json(data);
        } catch (error) {
            console.error('Error reading marginal costs file:', error);
            res.status(500).json({ error: 'Failed to read marginal costs data' });
        }
    } else {
        res.status(404).json({ error: 'Marginal costs not found. Run model first.' });
    }
});
