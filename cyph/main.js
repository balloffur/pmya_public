const MAGIC = new TextEncoder().encode('MYCYPHS3');
const ALGO_VER = 1;
const CHUNK_SIZE = 1024 * 1024;

const btnEnc = document.getElementById('btn-enc');
const btnDec = document.getElementById('btn-dec');
const btnTxt = document.getElementById('btn-txt');
const btnTxtDec = document.getElementById('btn-txtdec');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const textInput = document.getElementById('text-input');
const keyInput = document.getElementById('key-input');
const btnProcess = document.getElementById('btn-process');
const outputText = document.getElementById('output-text');

const btnHelp = document.getElementById('btn-help');
const helpBox = document.getElementById('help-box');

let currentMode = 'ENC';
let selectedFile = null;

// Обработка кнопки справки
btnHelp.onclick = () => helpBox.classList.toggle('hidden');

// Инициализация режимов
btnEnc.onclick = () => setMode('ENC');
btnDec.onclick = () => setMode('DEC');
btnTxt.onclick = () => setMode('TXT');
btnTxtDec.onclick = () => setMode('TXTDEC');

function setMode(mode) {
    currentMode = mode;
    [btnEnc, btnDec, btnTxt, btnTxtDec].forEach(b => b.classList.remove('on'));
    document.getElementById('btn-' + mode.toLowerCase()).classList.add('on');

    if (mode === 'TXT') {
        dropZone.style.display = 'none';
        textInput.style.display = 'block';
    } else {
        dropZone.style.display = 'flex';
        textInput.style.display = 'none';
    }
    resetState();
}

function resetState() {
    selectedFile = null;
    fileLabel.textContent = 'Выберите файл';
    fileInput.value = '';
    textInput.value = '';
    showResult('', false, false);
    autoResizeTextarea();
}

function autoResizeTextarea() {
    textInput.style.height = '120px';
    if (textInput.scrollHeight > 120) {
        textInput.style.height = textInput.scrollHeight + 2 + 'px';
    }
}
textInput.addEventListener('input', autoResizeTextarea);

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        btnProcess.click();
    }
});

function showResult(msg, isErr = false, isOk = true) {
    outputText.textContent = msg;
    outputText.className = 'result ' + (isErr ? 'err' : (isOk ? 'ok' : ''));
}

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
dropZone.ondragleave = () => dropZone.classList.remove('active');
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
};
fileInput.onchange = (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
};

function handleFile(file) {
    selectedFile = file;
    fileLabel.textContent = file.name;
    showResult('', false, false);
}

btnProcess.onclick = async () => {
    const pwd = keyInput.value;
    if (!pwd) return showResult('Введите пароль!', true);

    try {
        await sodium.ready;
        showResult('Обработка...', false, false);

        if (currentMode === 'ENC') {
            if (!selectedFile) throw new Error('Файл не выбран!');
            await encryptFile(selectedFile, pwd);
        } else if (currentMode === 'DEC') {
            if (!selectedFile) throw new Error('Файл не выбран!');
            await decryptFile(selectedFile, pwd, false);
        } else if (currentMode === 'TXT') {
            const txt = textInput.value;
            if (!txt) throw new Error('Текст пуст!');
            await encryptText(txt, pwd);
        } else if (currentMode === 'TXTDEC') {
            if (!selectedFile) throw new Error('Файл не выбран!');
            await decryptFile(selectedFile, pwd, true);
        }
    } catch (e) {
        showResult(e.message, true);
    }
};

// --- Совместимость с C++ ---

function normalizeKey(pwd) {
    return pwd.toLowerCase().replace(/\s+/g, '');
}

function getKdfKey(pwdStr, salt, opslimit, memlimit) {
    const norm = normalizeKey(pwdStr);
    const pwdBytes = new TextEncoder().encode(norm);
    return sodium.crypto_pwhash(
        sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES,
        pwdBytes, salt,
        opslimit, memlimit,
        sodium.crypto_pwhash_ALG_DEFAULT
    );
}

// Запись 66-байтного заголовка (MAGIC + ALGO + FLAGS + OPS + MEM + SALT + HEADER)
function createHeader(salt, ssHeader, opslimit, memlimit, flags = 0) {
    const hdr = new Uint8Array(66);
    hdr.set(MAGIC, 0);
    hdr[8] = ALGO_VER;
    hdr[9] = flags;
    
    const dv = new DataView(hdr.buffer, hdr.byteOffset, hdr.byteLength);
    dv.setBigUint64(10, BigInt(opslimit), true); // little-endian
    dv.setBigUint64(18, BigInt(memlimit), true);
    
    hdr.set(salt, 26);
    hdr.set(ssHeader, 42);
    return hdr;
}

function parseHeader(readStr) {
    const magic = readStr(8);
    for (let i = 0; i < 8; i++) if (magic[i] !== MAGIC[i]) throw new Error("Неверная сигнатура файла");
    
    const ver = readStr(1)[0];
    if (ver !== ALGO_VER) throw new Error("Неподдерживаемая версия алгоритма");
    
    const flags = readStr(1)[0];
    
    const opsBytes = readStr(8);
    const memBytes = readStr(8);
    const dvOps = new DataView(opsBytes.buffer, opsBytes.byteOffset, 8);
    const dvMem = new DataView(memBytes.buffer, memBytes.byteOffset, 8);
    const opslimit = Number(dvOps.getBigUint64(0, true));
    const memlimit = Number(dvMem.getBigUint64(0, true));
    
    const salt = readStr(16);
    const ssHeader = readStr(24);
    
    return { flags, opslimit, memlimit, salt, ssHeader };
}

function createFrame(cipherText) {
    const len = cipherText.length;
    const frame = new Uint8Array(4 + len);
    frame[0] = len & 0xff;
    frame[1] = (len >> 8) & 0xff;
    frame[2] = (len >> 16) & 0xff;
    frame[3] = (len >>> 24) & 0xff;
    frame.set(cipherText, 4);
    return frame;
}

function downloadBlob(chunks, name) {
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

// --- Логика ---

async function encryptFile(file, pwdStr) {
    const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE;
    const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE;
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const key = getKdfKey(pwdStr, salt, opslimit, memlimit);
    
    const { state, header: ssHeader } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
    
    const outChunks = [];
    outChunks.push(createHeader(salt, ssHeader, opslimit, memlimit, 0));
    
    const nameBytes = new TextEncoder().encode(file.name);
    outChunks.push(createFrame(sodium.crypto_secretstream_xchacha20poly1305_push(state, nameBytes, null, 0)));

    if (file.size === 0) {
        outChunks.push(createFrame(sodium.crypto_secretstream_xchacha20poly1305_push(state, new Uint8Array(0), null, sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL)));
    } else {
        let offset = 0;
        while (offset < file.size) {
            const end = Math.min(offset + CHUNK_SIZE, file.size);
            const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
            const tag = end === file.size ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL : 0;
            outChunks.push(createFrame(sodium.crypto_secretstream_xchacha20poly1305_push(state, chunk, null, tag)));
            offset = end;
        }
    }

    downloadBlob(outChunks, file.name + '.cyph');
    showResult('Успешно зашифровано.', false, true);
}

async function decryptFile(file, pwdStr, toScreen) {
    const data = new Uint8Array(await file.arrayBuffer());
    let offset = 0;

    const read = (n) => {
        if (offset + n > data.length) throw new Error("Неожиданный конец файла");
        const res = data.subarray(offset, offset + n);
        offset += n;
        return res;
    };

    const hdr = parseHeader(read);
    const key = getKdfKey(pwdStr, hdr.salt, hdr.opslimit, hdr.memlimit);
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(hdr.ssHeader, key);

    const readFrame = () => {
        const clen = read(4);
        const len = clen[0] | (clen[1] << 8) | (clen[2] << 16) | (clen[3] << 24);
        if (len < 17 || len > CHUNK_SIZE + 64) throw new Error("Поврежден размер блока");
        return read(len);
    };

    const meta = sodium.crypto_secretstream_xchacha20poly1305_pull(state, readFrame());
    if (!meta) throw new Error("Неверный пароль или поврежден файл");
    const filename = new TextDecoder().decode(meta.message);

    const chunks = [];
    let isFinal = false;

    while (offset < data.length) {
        const res = sodium.crypto_secretstream_xchacha20poly1305_pull(state, readFrame());
        if (!res) throw new Error("Ошибка целостности данных");
        
        if (res.message.length > 0) chunks.push(res.message);
        if (res.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
            isFinal = true;
            break;
        }
    }

    if (!isFinal) throw new Error("Файл поврежден (отсутствует тег FINAL)");

    if (toScreen) {
        const full = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
        let off = 0;
        for (const c of chunks) { full.set(c, off); off += c.length; }
        showResult(new TextDecoder().decode(full), false, true);
    } else {
        downloadBlob(chunks, filename);
        showResult('Успешно расшифровано в файл.', false, true);
    }
}

async function encryptText(text, pwdStr) {
    const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE;
    const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE;
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const key = getKdfKey(pwdStr, salt, opslimit, memlimit);
    
    const { state, header: ssHeader } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
    
    const outChunks = [];
    outChunks.push(createHeader(salt, ssHeader, opslimit, memlimit, 0));
    
    outChunks.push(createFrame(sodium.crypto_secretstream_xchacha20poly1305_push(state, new TextEncoder().encode("text.txt"), null, 0)));
    
    const pt = new TextEncoder().encode(text);
    outChunks.push(createFrame(sodium.crypto_secretstream_xchacha20poly1305_push(state, pt, null, sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL)));

    downloadBlob(outChunks, 'message.cyph');
    showResult('Текст успешно зашифрован (сохранен как message.cyph).', false, true);
}
