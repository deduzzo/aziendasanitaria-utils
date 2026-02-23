import express from 'express';
import { FlussoM } from './src/m/FlussoM.js';
import path from 'path';

const app = express();
const port = 3000;

// Middleware per analizzare il corpo della richiesta POST
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Pagina principale
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="it">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Scraping Strutture Progetto TS</title>
            <style>
                body { font-family: sans-serif; margin: 20px; }
                textarea { width: 100%; height: 300px; margin-bottom: 10px; }
                button { padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; }
                button:hover { background-color: #0056b3; }
                #message { margin-top: 20px; padding: 10px; border-radius: 4px; display: none; }
                .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            </style>
        </head>
        <body>
            <h1>Scraping Strutture Progetto TS</h1>
            <p>Incolla qui il contenuto HTML della pagina delle strutture del Progetto Tessera Sanitaria:</p>
            <textarea id="htmlContent" placeholder="Incolla l'HTML qui..."></textarea>
            <br>
            <button onclick="genera()">Genera File JSON</button>
            <div id="message"></div>

            <script>
                async function genera() {
                    const html = document.getElementById('htmlContent').value;
                    const messageDiv = document.getElementById('message');
                    
                    if (!html) {
                        messageDiv.textContent = "Per favore, incolla dell'HTML prima di procedere.";
                        messageDiv.className = "error";
                        messageDiv.style.display = "block";
                        return;
                    }

                    try {
                        const response = await fetch('/generate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: 'htmlContent=' + encodeURIComponent(html)
                        });

                        const result = await response.json();
                        
                        if (response.ok) {
                            messageDiv.textContent = result.message;
                            messageDiv.className = "success";
                        } else {
                            messageDiv.textContent = "Errore: " + result.error;
                            messageDiv.className = "error";
                        }
                    } catch (error) {
                        messageDiv.textContent = "Errore durante la richiesta: " + error.message;
                        messageDiv.className = "error";
                    }
                    messageDiv.style.display = "block";
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint per la generazione del file
app.post('/generate', (req, res) => {
    const htmlContent = req.body.htmlContent;
    
    if (!htmlContent) {
        return res.status(400).json({ error: 'Contenuto HTML mancante' });
    }

    try {
        const outputDir = path.join(process.cwd(), 'data', 'strutture');
        const strutture = FlussoM.scrapingStruttureProgettoTs(htmlContent, outputDir);
        res.json({ 
            message: `Successo! Generate ${strutture.length} strutture nella cartella 'data'.`,
            count: strutture.length 
        });
    } catch (error) {
        console.error("Errore durante lo scraping:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});
