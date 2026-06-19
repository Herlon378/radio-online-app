
const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render (Sinalizador)
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let localStream;
let peerConnection;
let estaTransmitindo = false;

// Configuração padrão de servidores públicos STUN (ajudam os celulares a se encontrarem na rede)
const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

// 1. SOLICITAR MICROFONE LOGO AO ENTRAR
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        localStream = stream;
        // Começa com o microfone mutado (modo rádio escuta)
        localStream.getAudioTracks()[0].enabled = false;
        status.innerText = "🟢 Microfone Pronto. Conectando...";
        
        // Inicializa a estrutura do WebRTC após obter o microfone
        inicializarWebRTC();
    })
    .catch(err => {
        console.error("Erro ao acessar o microfone:", err);
        status.innerText = "❌ Sem permissão de microfone";
    });

// 2. CONFIGURAR A CONEXÃO WEBRTC
function inicializarWebRTC() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Adiciona o nosso microfone na conexão
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Quando o outro celular enviar o áudio dele, o navegador toca automaticamente
    peerConnection.ontrack = (event) => {
        const remoteAudio = document.createElement("audio");
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        remoteAudio.play().catch(e => console.log("Aguardando interação para tocar o áudio recebido"));
    };

    // Envia os candidatos de rede (ICE) para o outro celular através do servidor
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };

    // Monitora as mensagens vindas do servidor do Render para negociar a conexão
    socket.onmessage = async (event) => {
        // Se receber áudio bruto antigo por engano, ignora
        if (event.data instanceof Blob) return;

        try {
            const data = JSON.parse(event.data);

            if (data.type === "offer") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.send(JSON.stringify({ type: "answer", answer: answer }));
            } 
            else if (data.type === "answer") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } 
            else if (data.type === "candidate") {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (e) {
            console.error("Erro no sinalizador WebRTC:", e);
        }
    };
}

// Criar a oferta de conexão (feita de forma automática por quem estiver pronto no WebSocket)
socket.onopen = () => {
    status.innerText = "🟢 Conectado e Pronto";
    
    // Pequeno delay para garantir que o Peer está montado, então envia o convite (Offer)
    setTimeout(async () => {
        if (peerConnection) {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.send(JSON.stringify({ type: "offer", offer: offer }));
            } catch (e) {
                console.log("Aguardando o segundo celular se conectar...");
            }
        }
    }, 1000);
};

socket.onclose = () => {
    status.innerText = "🔴 Desconectado";
};

// 3. CONTROLAR O BOTÃO FALAR (Estilo Rádio: Ativa/Desativa o canal de áudio)
function alternarTransmissao() {
    if (!localStream) {
        alert("O microfone ainda não foi carregado ou permitido.");
        return;
    }

    // Tenta ativar o contexto de áudio do navegador para garantir a reprodução
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const microfone = localStream.getAudioTracks()[0];

    if (!estaTransmitindo) {
        microfone.enabled = true; // Desmuta o microfone (Transmite)
        estaTransmitindo = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333";
    } else {
        microfone.enabled = false; // Muta o microfone (Fica em escuta)
        estaTransmitindo = false;
        btn.innerText = "FALAR";
        btn.style.backgroundColor = "";
    }
}

btn.addEventListener("click", alternarTransmissao);
