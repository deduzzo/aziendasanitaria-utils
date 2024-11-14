import express from 'express';
import fs from 'fs-extra';
import Redis from 'ioredis';
import passport from 'passport';
import { SpidStrategy } from 'passport-spid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path'; // Aggiunto per risolvere i percorsi

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
    const app = express();
    const redis = new Redis('redis://redis');
    const idp = 'https://posteid.poste.it';
    const idpMetadata = (await fs.readFile('./spid-idp-entities.xml')).toString();
    const sp = 'http://localhost:4000';
    const privateKey = (await fs.readFile('./testkey/key.pem')).toString();
    const spCert = (await fs.readFile('./testkey/crt.pem')).toString();
    const email = 'asd@example.com';
    const cachePrefix = 'spid_request_';
    const cache = {
        get(key) {
            return redis.get(cachePrefix + key);
        },
        set(key, value) {
            return redis.set(cachePrefix + key, value);
        },
        delete(key) {
            return redis.del(cachePrefix + key);
        },
        expire(key, ms) {
            return redis.pexpire(cachePrefix + key, ms);
        },
    };

    const config = {
        saml: {
            authnRequestBinding: 'HTTP-POST', // or HTTP-Redirect
            attributeConsumingServiceIndex: '0', // index of 'acs' array
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            callbackUrl: `${sp}/login/cb`,
            logoutCallbackUrl: `${sp}/logout/cb`,
            racComparison: 'minimum',
            privateKey,
            audience: sp,
        },
        spid: {
            getIDPEntityIdFromRequest: (req) => idp,
            IDPRegistryMetadata: idpMetadata,
            authnContext: 1, // spid level (1/2/3)
            serviceProvider: {
                type: 'public',
                entityId: sp,
                certificate: spCert,
                acs: [
                    {
                        name: 'acs0',
                        attributes: ['spidCode', 'email', 'fiscalNumber'],
                    },
                    {
                        name: 'acs1',
                        attributes: ['email'],
                    },
                ],
                organization: {
                    it: {
                        name: 'example',
                        displayName: 'example',
                        url: sp,
                    },
                },
                contactPerson: {
                    IPACode: 'ipacode',
                    email,
                },
            },
        },
        cache,
    };

    const verify = (profile, done) => {
        done(null, profile);
    };

    const strategy = new SpidStrategy(config, verify, verify);
    const metadata = await strategy.generateSpidServiceProviderMetadata();
    passport.use('spid', strategy);

    const passportOptions = {
        session: false,
    };

    app.use(passport.initialize());

    // Aggiungi il middleware per servire i file statici dalla cartella /production
    app.use('/production', express.static(path.join(__dirname, 'production')));


    app.get('/metadata', async (req, res) => {
        res.contentType('text/xml');
        res.send(metadata);
    });

    app.get('/login', passport.authenticate('spid', passportOptions));

    app.post(
        '/login/cb',
        express.urlencoded({ extended: false }),
        passport.authenticate('spid', passportOptions),
        (req, res) => {
            const user = req.user;
            const samlRequest = user.getSamlRequestXml();
            const samlResponse = user.getSamlResponseXml();
            res.send(user);
        }
    );

    app.listen(4000);
}

run().catch(console.error);
