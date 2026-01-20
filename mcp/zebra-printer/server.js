/**
 * Micro-server HTTP per stampa etichette su Zebra GK420t
 * Usa node-printer per raw printing
 *
 * Avvio: node server.js
 * Endpoint: POST http://localhost:3457/print
 */

const http = require('http');
const printer = require('@grandchef/node-printer');

// Configurazione
const CONFIG = {
    port: 3457,
    printerName: 'ZDesigner GK420t',
    // Dimensioni etichetta 90x60mm a 203 DPI (8 dots/mm)
    labelWidth: 720,   // 90mm * 8
    labelHeight: 480   // 60mm * 8
};

/**
 * Genera codice ZPL per l'etichetta
 */
function generateZPL(data) {
    const { azienda, tipoDocumento, numeroProtocollo, dataProtocollo } = data;

    // Etichetta senza bordo - scritte +10%
    const zpl = `^XA
^CI28
^PW${CONFIG.labelWidth}
^LL${CONFIG.labelHeight}

^FO40,70^A0N,35,35^FB680,1,0,C,0^FD${azienda || 'Azienda Sanitaria Provinciale Messina'}^FS
^FO40,130^A0N,24,24^FB680,1,0,C,0^FD${tipoDocumento || ''}^FS
^FO40,190^A0N,55,55^FB680,1,0,C,0^FDN. ${numeroProtocollo || ''}^FS
^FO40,290^A0N,35,35^FB680,1,0,C,0^FDdel ${dataProtocollo || ''}^FS
^XZ`;

    return zpl;
}

/**
 * Stampa usando node-printer (raw printing)
 */
function printWithNodePrinter(zplContent) {
    return new Promise((resolve, reject) => {
        console.log('[Zebra] Invio a stampante:', CONFIG.printerName);

        printer.printDirect({
            data: zplContent,
            printer: CONFIG.printerName,
            type: 'RAW',
            success: (jobId) => {
                console.log('[Zebra] Job inviato con ID:', jobId);
                resolve({ success: true, method: 'node-printer', jobId });
            },
            error: (err) => {
                console.error('[Zebra] Errore stampa:', err);
                reject(new Error(err));
            }
        });
    });
}

/**
 * Lista stampanti disponibili
 */
function listPrinters() {
    try {
        const printers = printer.getPrinters();
        return printers.map(p => ({
            name: p.name,
            isDefault: p.isDefault,
            status: p.status
        }));
    } catch (err) {
        console.error('[Zebra] Errore lista stampanti:', err);
        return [];
    }
}

/**
 * Gestisce le richieste HTTP
 */
function handleRequest(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/') {
        const printers = listPrinters();
        const zebraFound = printers.find(p => p.name === CONFIG.printerName);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'Zebra Label Printer',
            printer: CONFIG.printerName,
            printerFound: !!zebraFound,
            printerStatus: zebraFound?.status || 'not found'
        }));
        return;
    }

    // Lista stampanti
    if (req.method === 'GET' && req.url === '/printers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(listPrinters()));
        return;
    }

    // Endpoint stampa
    if (req.method === 'POST' && req.url === '/print') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                console.log('[Zebra] Richiesta stampa:', data);

                if (!data.numeroProtocollo) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'numeroProtocollo richiesto' }));
                    return;
                }

                const zpl = generateZPL(data);
                console.log('[Zebra] ZPL generato:\n', zpl);

                const result = await printWithNodePrinter(zpl);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Etichetta stampata',
                    ...result
                }));

            } catch (err) {
                console.error('[Zebra] Errore:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}

// Avvia server
const server = http.createServer(handleRequest);

server.listen(CONFIG.port, () => {
    console.log('='.repeat(50));
    console.log(' ZEBRA LABEL PRINTER SERVER');
    console.log('='.repeat(50));
    console.log(`Server attivo su: http://localhost:${CONFIG.port}`);
    console.log(`Stampante target: ${CONFIG.printerName}`);
    console.log('');

    // Verifica stampante
    const printers = listPrinters();
    const zebra = printers.find(p => p.name === CONFIG.printerName);
    if (zebra) {
        console.log(`Stampante trovata: ${zebra.name}`);
    } else {
        console.log('ATTENZIONE: Stampante non trovata!');
        console.log('Stampanti disponibili:');
        printers.forEach(p => console.log(`  - ${p.name}`));
    }

    console.log('');
    console.log('Endpoint:');
    console.log(`  GET  /         - Health check`);
    console.log(`  GET  /printers - Lista stampanti`);
    console.log(`  POST /print    - Stampa etichetta`);
    console.log('='.repeat(50));
});

process.on('SIGINT', () => {
    console.log('\n[Zebra] Chiusura server...');
    server.close(() => process.exit(0));
});
