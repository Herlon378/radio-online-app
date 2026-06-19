const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let mediaRecorder;
let estaGravando = false;
let audioContext;
let intervaloGravacao;
let streamGlobal;

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

// 2. RECEBER ÁUDIO EM TEMPO REAL
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
            }, (erro) => console.log("Processando bloco de áudio..."));
            
        } catch (e) {
            console.error("Erro ao reproduzir áudio:", e);
        }
    }
};

// 3. CONFIGURAR O MICROFONE
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        streamGlobal = stream; // Salva o fluxo do microfone globalmente
    })
    .catch(err => {
        console.error("Erro ao acessar o microfone:", err);
        status.innerText = "❌ Sem permissão de microfone";
    });

// Função interna que grava e envia um bloco completo e independente
function capturarBlocoDeAudio() {
    if (!streamGlobal || !estaGravando) return;

    const recorder = new MediaRecorder(streamGlobal, { mimeType: 'audio/webm' });
    
    recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data); // Envia o bloco completo com cabeçalho próprio
        }
    };

    // Grava por 400ms e para automaticamente para forçar o envio
    recorder.start();
    setTimeout(() => {
        if (recorder.state !== "inactive") {
            recorder.stop();
        }
    }, 400); 
}

// 4. CONTROLAR O BOTÃO FALAR (Modo Clique para Ligar / Clique para Desligar)
function alternarTransmissao() {
    ligarSistemaDeAudio(); 

    if (!streamGlobal) {
        alert("O microfone ainda não foi carregado ou permitido.");
        return;
    }

    if (!estaGravando) {
        estaGravando = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333";

        // Executa a captura imediatamente
        capturarBlocoDeAudio();
        // Cria o ciclo automático: a cada 450ms ele inicia uma nova captura independente
        intervaloGravacao = setInterval(capturarBlocoDeAudio, 450);
    } else {
        estaGravando = false;
        clearInterval(intervaloGravacao); // Para o ciclo automático
        btn.innerText = "FALAR";
        btn.style.backgroundColor = ""; 
    }
}

btn.addEventListener("click", alternarTransmissao);
