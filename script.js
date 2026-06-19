
const status = document.getElementById("status");
const btn = document.getElementById("btn");
const listaOnline = document.getElementById("lista-online");

// Conexão com o seu servidor no Render
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let mediaRecorder;
let estaGravando = false;
let audioContext;
let intervaloGravacao;
let streamGlobal;
let totalConectados = 1; // Começa contando com você mesmo

function ligarSistemaDeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

socket.onopen = () => { 
    status.innerText = "🟢 Conectado e Pronto"; 
    listaOnline.innerText = "👥 1 dispositivo online (Você)";
    
    // Avisa o servidor que você entrou para atualizar os outros
    setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ acao: "ping_presenca" }));
        }
    }, 1000);
};

socket.onclose = () => { 
    status.innerText = "🔴 Desconectado"; 
    listaOnline.innerText = "👥 Desconectado do servidor";
};

// RECEBER E TOCAR O ÁUDIO OU SINAL DE PRESENÇA
socket.onmessage = async (event) => {
    // Se receber texto (verificação de quem está online)
    if (typeof event.data === "string") {
        try {
            const dados = JSON.parse(event.data);
            if (dados.acao === "ping_presenca") {
                // Outro celular entrou! Atualiza a lista e responde para ele saber que você existe
                listaOnline.innerText = "👥 2 dispositivos online";
                socket.send(JSON.stringify({ acao: "resposta_presenca" }));
            } else if (dados.acao === "resposta_presenca") {
                listaOnline.innerText = "👥 2 dispositivos online";
            }
        } catch (e) { }
        return;
    }

    // Se receber o bloco de áudio bruto
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

// CONFIGURAR MICROFONE COM FILTROS CRISTALINOS
navigator.mediaDevices.getUserMedia({ 
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
    } 
})
.then(stream => { streamGlobal = stream; })
.catch(err => { status.innerText = "❌ Sem permissão de microfone"; });

// FUNÇÃO QUE CAPTURA OS BLOCOS AUTOMÁTICOS
function capturarBlocoDeAudio() {
    if (!streamGlobal || !estaGravando) return;

    // Formato profissional de alta definição
    const recorder = new MediaRecorder(streamGlobal, { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000 
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
    }, 800); 
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
