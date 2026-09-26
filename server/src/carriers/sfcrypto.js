// 顺丰国际 OpenAPI 加解密（微信企业号同款协议，源自官方 JS.zip 样例）
// 签名：SHA256( [token, timestamp, nonce, encryptedMsg].sort().join("") ) hex 小写
// 加密：AES-256-CBC，key=Base64(aesKey43+"=")，iv=key[0:16]
//       明文结构 random(16) + pack4(len) + text + appKey，PKCS7 填充至 32 字节倍数，输出 Base64
// body：直接放密文 Base64 字符串（非 JSON 包装）
import crypto from 'crypto';

function pkcs7Pad32(buf) {
  let pad = 32 - (buf.length % 32);
  if (pad === 0) pad = 32;
  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
}

function pkcs7Unpad32(buf) {
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 32) return buf;
  return buf.subarray(0, buf.length - pad);
}

export function deriveKey(aesKey43) {
  const key = Buffer.from(aesKey43 + '=', 'base64');
  if (key.length !== 32) throw new Error(`aesKey 解码后 ${key.length} 字节，需 32`);
  return key;
}

export function sfEncrypt(plainText, aesKey43, appKey) {
  const key = deriveKey(aesKey43);
  const iv = key.subarray(0, 16);
  // random 16 字符（字母数字，与样例一致）
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
  const random = Buffer.from(Array.from({ length: 16 }, () => pool[crypto.randomInt(pool.length)]).join(''), 'utf8');
  const text = Buffer.from(plainText, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(text.length, 0);
  const appId = Buffer.from(appKey, 'utf8');
  const data = pkcs7Pad32(Buffer.concat([random, len, text, appId]));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('base64');
}

export function sfDecrypt(encryptedB64, aesKey43, appKey) {
  const key = deriveKey(aesKey43);
  const iv = key.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  let dec = Buffer.concat([decipher.update(Buffer.from(encryptedB64, 'base64')), decipher.final()]);
  dec = pkcs7Unpad32(dec);
  const len = dec.readUInt32BE(16);
  let content = dec.subarray(20, 20 + len).toString('utf8');
  const idx = content.indexOf(appKey);
  if (idx > -1) content = content.slice(0, idx);
  return content;
}

export function sfSignature(token, timestamp, nonce, encryptedMsg) {
  const parts = [token, String(timestamp), String(nonce), encryptedMsg];
  parts.sort();
  return crypto.createHash('sha256').update(parts.join(''), 'utf8').digest('hex');
}
