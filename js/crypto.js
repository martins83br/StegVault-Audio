const MAGIC = new Uint8Array([0x53, 0x56, 0x41, 0x31]);
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 600000;

function combine(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

async function deriveKey(password, salt) {
  const encoder = new TextEncoder();

  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(message, password) {
  if (!password) {
    throw new Error("Encryption password is required.");
  }

  const salt = crypto.getRandomValues(
    new Uint8Array(SALT_LENGTH)
  );

  const iv = crypto.getRandomValues(
    new Uint8Array(IV_LENGTH)
  );

  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(message);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    plaintext
  );

  return combine(
    MAGIC,
    salt,
    iv,
    new Uint8Array(ciphertext)
  );
}

export async function decryptMessage(payload, password) {
  if (!password) {
    throw new Error("Decryption password is required.");
  }

  const data = new Uint8Array(payload);

  const minimumLength =
    MAGIC.length + SALT_LENGTH + IV_LENGTH + 16;

  if (data.length < minimumLength) {
    throw new Error("Invalid encrypted payload.");
  }

  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) {
      throw new Error("Invalid StegVault format.");
    }
  }

  let offset = MAGIC.length;

  const salt = data.slice(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = data.slice(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const ciphertext = data.slice(offset);
  const key = await deriveKey(password, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      ciphertext
    );

    return new TextDecoder("utf-8", {
      fatal: true
    }).decode(plaintext);
  } catch {
    throw new Error(
      "Decryption failed: incorrect password or corrupted data."
    );
  }
}
