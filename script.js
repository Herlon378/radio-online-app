const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let mediaRecorder;
let estaGravando = false;

// 1. Monitora a conexão
socket.onopen = () => {
    status.innerText = "🟢 Conectado e Pronto";
};

socket.onclose = () => {
    status.innerText = "🔴 Desconectado";
};

// 2. RECEBER ÁUDIO EM TEMPO REAL: Executa sempre que chega um pedaço de voz
socket.onmessage = async (event) => {
    if (event.data instanceof Blob) {
        const audioUrl = URL.createObjectURL(event.data);
        const audio = new Audio(audioUrl);
        
        // Toca o pedacinho de áudio imediatamente
        audio.play().catch(e => console.log("Aguardando interação para tocar áudio..."));
    }
};

// 3. CONFIGURAR O MICROFONE: Solicita acesso assim que a página abre
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        // Inicializa o gravador com o fluxo do microfone
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        // Evento disparado toda vez que um "pedaço" de áudio está pronto
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                // Envia o pedaço de voz instantaneamente para o servidor
                socket.send(event.data);
            }
        };
    })
    .catch(err => {
        console.error("Erro ao acessar o microfone:", err);
        status.innerText = "❌ Sem permissão de microfone";
    });

// 4. CONTROLAR O BOTÃO FALAR (Modo Clique para Ligar / Clique para Desligar)
btn.addEventListener("click", () => {
    if (!mediaRecorder) {
        alert("O microfone ainda não foi carregado ou permitido.");
        return;
    }

    if (!estaGravando) {
        // Inicia a gravação e envia pedaços a cada 200ms (0.2 segundos)
        mediaRecorder.start(200); 
        estaGravando = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333"; // Deixa o botão vermelho
    } else {
        // Para a transmissão
        mediaRecorder.stop();
        estaGravando = false;
        btn.innerText = "FALAR";
        btn.style.backgroundColor = ""; // Volta à cor original do CSS
    }
});
