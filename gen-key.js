const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { generateKeyPairSync } = require('crypto');

const keyPath = path.join(__dirname, 'github-actions-deploy-new');

// Generate RSA 4096-bit key pair (no passphrase)
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096
});

// Export private key in traditional PEM format (no encryption)
const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' });
fs.writeFileSync(keyPath, privateKeyPem);

// Construct OpenSSH public key from JWK components
const jwk = publicKey.export({ format: 'jwk' });
let e = Buffer.from(jwk.e, 'base64url');
let n = Buffer.from(jwk.n, 'base64url');
// SSH mpint format: if high bit is set, prepend 0x00 byte
if (n[0] & 0x80) n = Buffer.concat([Buffer.from([0]), n]);
if (e[0] & 0x80) e = Buffer.concat([Buffer.from([0]), e]);
const type = Buffer.from('ssh-rsa');
function sshBuf(buf) { return Buffer.concat([Buffer.from([0,0,0,buf.length]), buf]); }
const blob = Buffer.concat([sshBuf(type), sshBuf(e), sshBuf(n)]);
const sshPubKey = 'ssh-rsa ' + blob.toString('base64') + ' github-actions-deploy';
fs.writeFileSync(keyPath + '.pub', sshPubKey);

console.log('Key generated successfully!');
console.log('\n=== Public Key (add this to EC2 authorized_keys) ===');
console.log(sshPubKey.toString().trim());
console.log('\n=== Private Key (paste this to GitHub Secret DEPLOY_KEY) ===');
console.log(privateKeyPem);
