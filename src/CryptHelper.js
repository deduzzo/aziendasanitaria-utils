import crypto from 'crypto';

export const ENVELOPE_VERSION = "V1";

export default class CryptHelper {

  static generateIv() {
    return crypto.randomBytes(16);
  }

  static async RSAGenerateKeyPair() {
    const {publicKey, privateKey} = await crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    return {publicKey, privateKey};
  }

  static RSAEncrypt(data, publicKey) {
    const bufferData = Buffer.from(data, 'utf8'); // Convert string to Buffer
    const encrypted = crypto.publicEncrypt({
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, bufferData);
    return encrypted.toString('base64'); // Return as base64 string for easy storage/transfer
  }

  static RSADecrypt(data, privateKey) {
    const bufferData = Buffer.from(data, 'base64'); // Convert base64 string to Buffer
    const decrypted = crypto.privateDecrypt({
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, bufferData);
    return decrypted.toString('utf8'); // Convert Buffer back to string
  }

  static RSASign(data, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  static RSASignVerify(data, signature, publicKey) {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  }

  static AESGenerateKey(keySize = 256) {
    return crypto.randomBytes(keySize / 8).toString('base64');
  }

  static AESEncrypt(data, keyBase64, iv) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(keyBase64, 'base64'), iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  static AESDecrypt(encryptedData, keyBase64, iv) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(keyBase64, 'base64'), iv);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static convertStringToByte(message) {
    return Buffer.from(message, 'utf8');
  }

  static convertBase64StringToByte(data) {
    return Buffer.from(data, 'base64');
  }

  static convertByteToBase64String(data) {
    return Buffer.from(data).toString('base64');
  }

  static hash(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  static generateHMAC(data, key) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('base64');
  }

  static async encryptAndSend(message, newVersion, publicKey = null, privateKey = null,AESKey = null) {
    if (!publicKey) {
      ({publicKey, privateKey} = await CryptHelper.RSAGenerateKeyPair());
    }
    if (!AESKey) {
      AESKey = CryptHelper.AESGenerateKey();
    }
    let iv = CryptHelper.generateIv();

    let encryptedAESKey = CryptHelper.RSAEncrypt(AESKey, publicKey);
    let encryptedMessage = CryptHelper.AESEncrypt(message, AESKey, iv);
    let hmac = CryptHelper.generateHMAC(encryptedMessage, AESKey);

    let data = {
      message: encryptedMessage,
      key: encryptedAESKey,
      iv: iv.toString('base64'),
      hmac: hmac,
      messageVersion: newVersion,
      envelopeVersion: ENVELOPE_VERSION
    };

    return {privateKey, publicKey, AESKey, data, originalMessage: message};
  }

  static async receiveAndDecrypt(data, privateKey) {
    let decryptedAESKey = CryptHelper.RSADecrypt(data.key, privateKey);
    let iv = Buffer.from(data.iv, 'base64');

    // Verify HMAC first
    let recalculatedHmac = CryptHelper.generateHMAC(data.message, decryptedAESKey);
    if (recalculatedHmac !== data.hmac) {
      throw new Error('Data integrity check failed');
    }

    return CryptHelper.AESDecrypt(data.message, decryptedAESKey, iv);
  }
}
