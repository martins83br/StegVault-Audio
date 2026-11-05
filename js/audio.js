const SAMPLE_RATE = 8000;
const SAMPLES_PER_BIT = 40;
const FREQ_ZERO = 1000;
const FREQ_ONE = 2000;
const MAX_PAYLOAD = 8192;
const HEADER = new Uint8Array([0x53, 0x56, 0x41, 0x46]);

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^
        ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function makePacket(data) {
  const length = data.length;
  if (length > MAX_PAYLOAD) {
    throw new Error("Payload exceeds 8192 bytes.");
  }

  const packet = new Uint8Array(12 + length);
  packet.set(HEADER, 0);

  const view = new DataView(packet.buffer);
  writeU32(view, 4, length);
  packet.set(data, 8);
  writeU32(view, 8 + length, crc32(data));

  return packet;
}

export function encodeAudio(payload) {
  const data = new Uint8Array(payload);
  const packet = makePacket(data);
  const sampleCount = packet.length * 8 * SAMPLES_PER_BIT;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  const label = (offset, value) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  label(0, "RIFF");
  writeU32(view, 4, buffer.byteLength - 8);
  label(8, "WAVE");
  label(12, "fmt ");
  writeU32(view, 16, 16);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  writeU32(view, 24, SAMPLE_RATE);
  writeU32(view, 28, SAMPLE_RATE * 2);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  writeU32(view, 40, sampleCount * 2);

  let position = 44;

  for (const byte of packet) {
    for (let bit = 7; bit >= 0; bit--) {
      const frequency = (byte & (1 << bit))
        ? FREQ_ONE : FREQ_ZERO;

      for (let i = 0; i < SAMPLES_PER_BIT; i++) {
        const sample = Math.sin(
          2 * Math.PI * frequency * i / SAMPLE_RATE
        );

        view.setInt16(
          position,
          Math.round(sample * 24000),
          true
        );
        position += 2;
      }
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function decodeAudio(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  const label = (offset, length) =>
    Array.from(
      new Uint8Array(buffer, offset, length),
      x => String.fromCharCode(x)
    ).join("");

  if (
    buffer.byteLength < 44 ||
    label(0, 4) !== "RIFF" ||
    label(8, 4) !== "WAVE" ||
    label(12, 4) !== "fmt " ||
    label(36, 4) !== "data"
  ) {
    throw new Error("Unsupported WAV format.");
  }

  if (
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== SAMPLE_RATE ||
    view.getUint16(34, true) !== 16 ||
    view.getUint16(32, true) !== 2
  ) {
    throw new Error("Expected mono PCM 16-bit 8000 Hz WAV.");
  }

  const dataSize = view.getUint32(40, true);
  if (
    dataSize > buffer.byteLength - 44 ||
    dataSize % (SAMPLES_PER_BIT * 2) !== 0
  ) {
    throw new Error("Invalid audio data.");
  }

  const bitCount = dataSize / (SAMPLES_PER_BIT * 2);
  if (bitCount % 8 !== 0) {
    throw new Error("Incomplete encoded bytes.");
  }

  const bytes = new Uint8Array(bitCount / 8);

  for (let b = 0; b < bitCount; b++) {
    let power0 = 0;
    let power1 = 0;

    for (const frequency of [FREQ_ZERO, FREQ_ONE]) {
      let real = 0;
      let imag = 0;

      for (let i = 0; i < SAMPLES_PER_BIT; i++) {
        const offset = 44 + (b * SAMPLES_PER_BIT + i) * 2;
        const sample = view.getInt16(offset, true);
        const phase = 2 * Math.PI * frequency * i / SAMPLE_RATE;

        real += sample * Math.cos(phase);
        imag += sample * Math.sin(phase);
      }

      const power = real * real + imag * imag;
      if (frequency === FREQ_ZERO) power0 = power;
      else power1 = power;
    }

    const bit = power1 > power0 ? 1 : 0;
    bytes[Math.floor(b / 8)] |= bit << (7 - (b % 8));
  }

  if (
    bytes.length < 12 ||
    !HEADER.every((value, i) => bytes[i] === value)
  ) {
    throw new Error("StegVault audio signature not found.");
  }

  const packet = new DataView(
    bytes.buffer, bytes.byteOffset, bytes.byteLength
  );
  const length = packet.getUint32(4, true);

  if (
    length > MAX_PAYLOAD ||
    bytes.length !== length + 12
  ) {
    throw new Error("Invalid encoded payload length.");
  }

  const payload = bytes.slice(8, 8 + length);
  const expected = packet.getUint32(8 + length, true);

  if (crc32(payload) !== expected) {
    throw new Error("Audio integrity verification failed.");
  }

  return payload;
}
