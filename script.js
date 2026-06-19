const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let mediaRecorder;
let estaGravando = false;
let audioContext;
let intervaloGravacao;
let streamGlobal;

function ligarSistemaDeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

socket.onopen = () => { status.innerText = "🟢 Conectado e Pronto"; };
socket.onclose = () => { status.innerText = "🔴 Desconectado"; };

// RECEBER E TOCAR O ÁUDIO
socket.onmessage = async (event) => {
    if (event.data instanceof Blob) {
        try {
            ligarSistemaDeAudio();
            const arrayBuffer = await event.data.arrayBuffer();
            
            audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start(0);
            }, (erro) => console.log("Processando bloco..."));
            
        } catch (e) {
            console.error("Erro ao tocar:", e);
        }
    }
};

// CONFIGURAR MICROFONE

navigator.mediaDevices.getUserMedia({ 
    audio: {
        echoCancellation: true,   // Remove o eco do ambiente
        noiseSuppression: true,   // Diminui o chiado e o barulho de fundo
        autoGainControl: true,    // Mantém a voz num volume firme e equilibrado
        sampleRate: 48000         // Qualidade estúdio de alta definição
    } 
})
.then(stream => { streamGlobal = stream; })
.catch(err => { status.innerText = "❌ Sem permissão de microfone"; });

// FUNÇÃO QUE CAPTURA OS BLOCOS AUTOMÁTICOS
function capturarBlocoDeAudio() {
    if (!streamGlobal || !estaGravando) return;

    
    const recorder = new MediaRecorder(streamGlobal, { 
    mimeType: 'audio/webm;codecs=opus', // Codec profissional de áudio cristalino
    audioBitsPerSecond: 128000          // Aumenta a definição dos blocos de som
});

    recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
        }
    };

    recorder.start();
    setTimeout(() => {
        if (recorder.state !== "inactive") {
            recorder.stop();
        }
    }, 800); // 800ms garante áudio limpo sem emendas muito curtas
}

// BOTÃO FALAR (Clique liga / Clique desliga)
function alternarTransmissao() {
    ligarSistemaDeAudio();

    if (!streamGlobal) {
        alert("Microfone não disponível.");
        return;
    }

    if (!estaGravando) {
        estaGravando = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333";

        capturarBlocoDeAudio();
        intervaloGravacao = setInterval(capturarBlocoDeAudio, 850);
    } else {
        estaGravando = false;
        clearInterval(intervaloGravacao);
        btn.innerText = "FALAR";
        btn.style.backgroundColor = "";
    }
}

btn.addEventListener("click", alternarTransmissao);
