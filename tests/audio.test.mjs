import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeAudio, decodeAudio } from "../js/audio.js";
import {
  encryptMessage,
  decryptMessage
} from "../js/crypto.js";

test("Encode and decode binary data", async () => {
  const original = new Uint8Array([0, 1, 2, 127, 255]);
  const wav = encodeAudio(original);
  const recovered = await decodeAudio(wav);

  assert.deepEqual(recovered, original);
});

test("Reject invalid WAV files", async () => {
  const invalid = new Blob(["not a wav"]);

  await assert.rejects(
    decodeAudio(invalid),
    /Unsupported WAV/
  );
});

test("Complete encrypted audio round trip", async () => {
  const message = "Hello Julie! Olá, mensagem secreta.";
  const password = "StrongPassword123!";

  const encrypted = await encryptMessage(message, password);
  const wav = encodeAudio(encrypted);
  const recovered = await decodeAudio(wav);
  const decrypted = await decryptMessage(recovered, password);

  assert.equal(decrypted, message);
});

test("Reject corrupted encoded audio", async () => {
  const wav = encodeAudio(new Uint8Array([1, 2, 3]));
  const bytes = new Uint8Array(await wav.arrayBuffer());
  const view = new DataView(bytes.buffer);

  // Modify one complete FSK bit in the payload.
  // The first 8 bytes contain the packet header and length.
  const bitIndex = 8 * 8;

  for (let i = 0; i < 40; i++) {
    const sampleIndex = bitIndex * 40 + i;
    const offset = 44 + sampleIndex * 2;

    const frequency = 2000;
    const sample = Math.sin(
      2 * Math.PI * frequency * i / 8000
    );

    view.setInt16(
      offset,
      Math.round(sample * 24000),
      true
    );
  }

  await assert.rejects(
    decodeAudio(new Blob([bytes])),
    /integrity|Invalid|signature/i
  );
});
