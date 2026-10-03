/*
 * Prints a fresh VAPID key pair for Web Push: the public key for the VAPID_PUBLIC_KEY var and
 * the private key (a JWK) for the VAPID_PRIVATE_KEY secret. Usage: node scripts/vapid-keys.mjs
 */
const { publicKey, privateKey } = await crypto.subtle.generateKey(
	{ name: 'ECDSA', namedCurve: 'P-256' },
	true,
	['sign', 'verify']
);

const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const jwk = await crypto.subtle.exportKey('jwk', privateKey);

console.log(`VAPID_PUBLIC_KEY=${Buffer.from(raw).toString('base64url')}`);
console.log(
	`VAPID_PRIVATE_KEY=${JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })}`
);
