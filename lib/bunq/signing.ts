import { createSign, createVerify, generateKeyPairSync } from "node:crypto";

export const generateKeyPair = () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
};

export const signBody = (privateKeyPem: string, body: string) => {
  const signer = createSign("RSA-SHA256");
  signer.update(body);
  return signer.sign(privateKeyPem, "base64");
};

export const verifySignature = (publicKeyPem: string, body: string, signatureB64: string) => {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(body);
  return verifier.verify(publicKeyPem, signatureB64, "base64");
};

export const decodeKeyEnv = (b64: string) => Buffer.from(b64, "base64").toString("utf8");
