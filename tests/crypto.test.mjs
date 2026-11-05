import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encryptMessage,
  decryptMessage
} from "../js/crypto.js";

test("Encrypt and decrypt a message", async () => {
  const message = "Hello Julie! Secret message.";
  const password = "MyStrongPassword123!";

  const encrypted = await encryptMessage(message, password);
  const decrypted = await decryptMessage(encrypted, password);

  assert.equal(decrypted, message);
});

test("Support Unicode messages", async () => {
  const message = "Olá! Informação confidencial.";
  const encrypted = await encryptMessage(message, "test123");

  assert.equal(
    await decryptMessage(encrypted, "test123"),
    message
  );
});

test("Reject incorrect passwords", async () => {
  const encrypted = await encryptMessage("Secret", "correct");

  await assert.rejects(
    decryptMessage(encrypted, "wrong"),
    /Decryption failed/
  );
});

test("Detect tampered ciphertext", async () => {
  const encrypted = await encryptMessage("Secret", "password");
  encrypted[encrypted.length - 1] ^= 1;

  await assert.rejects(
    decryptMessage(encrypted, "password"),
    /Decryption failed/
  );
});

test("Use unique encryption parameters", async () => {
  const first = await encryptMessage("Same message", "password");
  const second = await encryptMessage("Same message", "password");

  assert.notDeepEqual(first, second);
});
