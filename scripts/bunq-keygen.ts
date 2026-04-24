import { generateKeyPair } from "@/lib/bunq/signing";

const { publicKey, privateKey } = generateKeyPair();
console.log("# Public key (register with bunq installation):");
console.log(publicKey);
console.log("# Private key — store as BUNQ_PRIVATE_KEY_B64 in .env.local:");
console.log(Buffer.from(privateKey).toString("base64"));
