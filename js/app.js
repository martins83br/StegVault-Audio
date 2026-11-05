import { encryptMessage, decryptMessage } from "./crypto.js";
import { encodeAudio, decodeAudio } from "./audio.js";

const $ = id => document.getElementById(id);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

let audioURL = null;

function feedback(message, error = false) {
  $("feedback").textContent = message;
  $("feedback").className = error ? "error" : "success";
}

function showTab(mode) {
  const encoding = mode === "encode";

  $("encodePanel").hidden = !encoding;
  $("decodePanel").hidden = encoding;

  $("encodeTab").classList.toggle("active", encoding);
  $("decodeTab").classList.toggle("active", !encoding);

  feedback("");
}

async function runBusy(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    feedback(error.message || "Operation failed.", true);
  } finally {
    button.disabled = false;
  }
}

$("encodeTab").onclick = () => showTab("encode");
$("decodeTab").onclick = () => showTab("decode");

$("useEncryption").onchange = () => {
  $("encryptPasswordGroup").hidden =
    !$("useEncryption").checked;
};

$("generateBtn").onclick = () => runBusy(
  $("generateBtn"),
  async () => {
    feedback("");
    $("audioResult").hidden = true;

    const message = $("message").value;
    const password = $("encryptPassword").value;
    const encrypted = $("useEncryption").checked;

    if (!message) throw new Error("Enter a message.");
    if (encrypted && !password) {
      throw new Error("Enter an encryption password.");
    }

    let payload;

    if (encrypted) {
      payload = await encryptMessage(message, password);
    } else {
      const plain = encoder.encode(message);
      payload = new Uint8Array(plain.length + 4);
      payload.set([0x53, 0x56, 0x50, 0x31]);
      payload.set(plain, 4);
    }

    const wav = encodeAudio(payload);

    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(wav);

    $("audioPlayer").src = audioURL;
    $("downloadLink").href = audioURL;
    $("audioResult").hidden = false;

    feedback("Audio generated successfully.");
  }
);

$("decodeBtn").onclick = () => runBusy(
  $("decodeBtn"),
  async () => {
    feedback("");
    $("decodedResult").hidden = true;
    $("recoveredMessage").value = "";

    const file = $("audioFile").files[0];
    if (!file) throw new Error("Select a WAV file.");

    const payload = await decodeAudio(file);
    const signature = Array.from(payload.slice(0, 4))
      .map(x => String.fromCharCode(x)).join("");

    let message;

    if (signature === "SVA1") {
      const password = $("decryptPassword").value;
      if (!password) {
        throw new Error("Decryption password is required.");
      }
      message = await decryptMessage(payload, password);
    } else if (signature === "SVP1") {
      message = decoder.decode(payload.slice(4));
    } else {
      throw new Error("Unknown StegVault message format.");
    }

    $("recoveredMessage").value = message;
    $("decodedResult").hidden = false;

    feedback("Message recovered successfully.");
  }
);

$("copyBtn").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      $("recoveredMessage").value
    );
    feedback("Message copied to clipboard.");
  } catch {
    feedback("Unable to copy message.", true);
  }
};
