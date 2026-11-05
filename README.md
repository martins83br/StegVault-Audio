# StegVault Audio

A browser-based tool for encoding and decoding text messages into audio using Binary FSK modulation and optional AES-256-GCM encryption.

The application runs locally in your browser without uploading messages, passwords, or audio files to a server.

## Features

- Text-to-audio encoding (WAV)
- Audio-to-text decoding
- Optional AES-256-GCM encryption
- Password-based decryption
- Binary FSK modulation
- Audio playback and download
- Local processing without a backend
- Compatible with macOS and Windows

## Technologies

- HTML5, CSS3, JavaScript
- Web Crypto API
- AES-256-GCM / PBKDF2-SHA-256
- Binary Frequency Shift Keying (FSK)
- WAV PCM Audio

## Usage

1. Open the web portal.
2. Enter a text message.
3. Enable encryption and enter a password (optional).
4. Click **Generate Audio**.
5. Download and share the WAV file.
6. Upload the WAV file using **Decode & Decrypt**.
7. Enter the original password if encrypted.
8. Recover the original message.

## Run Locally

```bash
git clone https://github.com/martins83br/StegVault-Audio.git
cd StegVault-Audio
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## Tests

```bash
npm test
```

## Security

Encryption and decryption are performed locally using the Web Crypto API. Audio encoding is not encryption by itself.

This project is intended for educational and experimental use and has not undergone an independent security audit.

## Author

Diniz Martins

GitHub: https://github.com/martins83br

