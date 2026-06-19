
const status = document.getElementById("status");
const btn = document.getElementById("btn");

// Conexão com o seu servidor no Render (Sinalizador)
const socket = new WebSocket("wss://radio-online-server.onrender.com");

let localStream;
let peerConnection;
let estaTransmitindo = false;

// Configuração padrão de servidores públicos STUN
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
        
        // Inicializa a estrutura do WebRTC
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

    // Quando o outro celular enviar o áudio dele, toca automaticamente
    peerConnection.ontrack = (event) => {
        console.log("Áudio recebido do outro dispositivo!");
        const remoteAudio = document.createElement("audio");
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        // Força a reprodução no alto-falante
        document.body.appendChild(remoteAudio);
    };

    // Envia os candidatos de rede (ICE) para o servidor encaminhar
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };
}

// 3. GERENCIAR MENSAGENS DE SINALIZAÇÃO (Dobra o conflito de Offer/Answer)
socket.onmessage = async (event) => {
    if (event.data instanceof Blob) return;

    try {
        const data = JSON.parse(event.data);

        // Garante que o WebRTC já iniciou antes de processar mensagens
        if (!peerConnection) return;

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

socket.onopen = () => {
    status.innerText = "🟢 Conectado e Pronto";
    
    // CORREÇÃO CRITICA: Só um dos lados cria a oferta original.
    // Usamos um temporizador diferente para o segundo celular criar o convite.
    setTimeout(async () => {
        if (peerConnection) {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.send(JSON.stringify({ type: "offer", offer: offer }));
                console.log("Convite de áudio enviado!");
            } catch (e) {
                console.error("Erro ao criar oferta:", e);
            }
        }
    }, 1500);
};

socket.onclose = () => {
    status.innerText = "🔴 Desconectado";
};

// 4. CONTROLAR O BOTÃO FALAR (Ativa/Desativa o microfone em tempo real)
function alternarTransmissao() {
    if (!localStream) {
        alert("O microfone ainda não foi carregado ou permitido.");
        return;
    }

    const microfone = localStream.getAudioTracks()[0];

    if (!estaTransmitindo) {
        microfone.enabled = true; // Abre o áudio para transmissão
        estaTransmitindo = true;
        btn.innerText = "TRANSMITINDO...";
        btn.style.backgroundColor = "#ff3333";
    } else {
        microfone.enabled = false; // Fecha o microfone (Fica só ouvindo)
        estaTransmitindo = false;
        btn.innerText = "FALAR";
        btn.style.backgroundColor = "";
    }
}

btn.addEventListener("click", alternarTransmissao);
