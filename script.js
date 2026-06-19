const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let mediaRecorder;
let estaGravando = false;
let audioContext;

// Inicializa ou destrava o sistema de som do celular
function ligarSistemaDeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

// 1. Monitora a conexão
socket.onopen = () => {
    status.innerText = "🟢 Conectado e Pronto";
};

socket.onclose = () => {
    status.innerText = "🔴 Desconectado";
};

// 2. RECEBER ÁUDIO EM TEMPO REAL (Tratamento corrigido para celulares)
socket.onmessage = async (event) => {
    if (event.data instanceof Blob) {
        try {
            ligarSistemaDeAudio(); // Garante que o som do celular está ativo
            
            const arrayBuffer = await event.data.arrayBuffer();
            
            // Decodifica o pedaço de voz recebido e toca no alto-falante
            audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start(0);
            }, (erro) => console.log("Aguardando fluxo completo de áudio..."));
            
        } catch (e) {
            console.error("Erro ao reproduzir pedaço de áudio:", e);
        }
    }
};

// 3. CONFIGURAR O MICROFONE
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };
    })
    .catch(err => {
        console.error("Erro ao acessar o microfone:", err);
        status.innerText = "❌ Sem permissão de microfone";
    });

// 4. MODO WALKIE-TALKIE: SEGURE PARA FALAR, SOLTE PARA PARAR
// (Funciona perfeitamente em computadores e telas de toque de celular)

function iniciarTransmissao(e) {
    e.preventDefault();
    ligarSistemaDeAudio(); // Destrava o som do celular ao tocar no botão

    if (!mediaRecorder) {
        alert("Aguardando permissão do microfone...");
        return;
    }

    if (!estaGravando) {
        mediaRecorder.start(200); // Envia blocos a cada 200ms
        estaGravando = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333";
    }
}

function pararTransmissao(e) {
    e.preventDefault();
    if (mediaRecorder && estaGravando) {
        mediaRecorder.stop();
        estaGravando = false;
        btn.innerText = "FALAR";
        btn.style.backgroundColor = "";
    }
}

// Eventos para Celular (Toque na tela)
btn.addEventListener("touchstart", iniciarTransmissao);
btn.addEventListener("touchend", pararTransmissao);

// Eventos para Computador (Clique do Mouse)
btn.addEventListener("mousedown", iniciarTransmissao);
btn.addEventListener("mouseup", pararTransmissao);
