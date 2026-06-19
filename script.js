
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

// 2. RECEBER ÁUDIO EM TEMPO REAL (Tratamento profissional para celulares)
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
            }, (erro) => console.log("Processando áudio..."));
            
        } catch (e) {
            console.error("Erro ao reproduzir áudio:", e);
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

// 4. CONTROLAR O BOTÃO FALAR (Modo Clique para Ligar / Clique para Desligar)
function alternarTransmissao() {
    ligarSistemaDeAudio(); // Destrava o som do celular ao interagir

    if (!mediaRecorder) {
        alert("O microfone ainda não foi carregado ou permitido.");
        return;
    }

    if (!estaGravando) {
        // Inicia a gravação enviando pedaços reais a cada 200ms
        mediaRecorder.start(200); 
        estaGravando = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333"; // Deixa o botão vermelho
    } else {
        // Para a transmissão
        mediaRecorder.stop();
        estaGravando = false;
        btn.innerText = "FALAR";
        btn.style.backgroundColor = ""; // Volta à cor original
    }
}

// Usamos apenas o clique padrão que funciona perfeitamente em qualquer celular e PC
btn.addEventListener("click", alternarTransmissao);
