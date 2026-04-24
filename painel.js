const supabaseUrl = 'https://qrctbkgmztiebluiyzys.supabase.co';
const supabaseKey = 'sb_publishable_SoS2YOc2Xr2wZwn8rTaUYA_va1LQi0h'; 
var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// NAVEGAÇÃO DE ABAS DO ALUNO
window.trocarAbaAluno = function(idAba, elemento) {
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block';
    
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    elemento.classList.add('active');

    if(idAba === 'aba-avisos') carregarAvisos();
}

async function verificarAcesso() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = "index.html";
        return;
    } 

    const usuarioId = session.user.id;
    
    const { data: perfil } = await supabase.from('perfis').select('nome, faixa').eq('id', usuarioId).single(); 
        
    const saudacao = document.getElementById('saudacao-aluno');
    if (perfil) {
        saudacao.innerHTML = `Olá, <b>${perfil.nome}</b>! <br><span style="font-size: 14px; color: #aaaaaa;">🥋 ${perfil.faixa || 'Branca'}</span>`;
    }

    const { data: mensalidades } = await supabase.from('mensalidades').select('*').eq('aluno_id', usuarioId).eq('status', 'pendente');

    if (mensalidades && mensalidades.length > 0) {
        const mens = mensalidades[0]; 
        document.getElementById('mes-atual').innerText = mens.mes;
        document.getElementById('valor-pagamento').innerText = `R$ ${mens.valor},00`;
        
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "🔴 EM ABERTO";
        statusEl.style.color = "#ff5252";
        
        const btnPagar = document.getElementById('btn-pagar');
        btnPagar.style.display = "block";

    } else {
        document.getElementById('mes-atual').innerText = "Tudo Certo!";
        document.getElementById('valor-pagamento').innerText = "R$ 0,00";
        
        const statusEl = document.getElementById('status-pagamento');
        statusEl.innerText = "✅ EM DIA";
        statusEl.style.color = "#4CAF50";
        document.getElementById('btn-pagar').style.display = "none";
    }
}

// O SEU GERADOR DE PIX INTACTO
document.getElementById('btn-pagar').addEventListener('click', () => {
    const feedback = document.getElementById('feedback-pix');
    const btnPagar = document.getElementById('btn-pagar');
    
    feedback.innerHTML = "⏳ Gerando seu Pix...";
    btnPagar.style.display = "none"; 
    
    const codigoPix = "00020126580014BR.GOV.BCB.PIX0136df56414c-22e3-4344-a4e9-196aca711462520400005303986540530.005802BR5925MATHEUS LEMOS DE OLIVEIRA6006MANAUS622605222h0XOKk4btX4PIsKYU1NsF6304A9FB"; 
    const urlSegura = encodeURIComponent(codigoPix);
    const imagemQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${urlSegura}`;
    
    setTimeout(() => {
        feedback.innerHTML = `
            ✅ <b>Pix Gerado!</b><br><br>
            <img src="${imagemQrCode}" style="border-radius: 10px; border: 5px solid white; margin-bottom: 10px; max-width: 100%;"><br>
            <p style="font-size: 13px; color: #aaaaaa; margin-bottom: 8px;">Copie o código abaixo ou escaneie o QR Code:</p>
            <code style='background:#000; padding:15px; display:block; color:#fff; font-size: 11px; word-break: break-all; border-radius: 8px; border: 1px solid #333;'>${codigoPix}</code>
            <br>
            <button id="btn-enviar-comprovante" style="background-color: #25D366; color: white; padding: 14px; border: none; border-radius: 8px; width: 100%; margin-top: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);">📲 ENVIAR COMPROVANTE</button>
        `;

        document.getElementById('btn-enviar-comprovante').addEventListener('click', () => {
            const numeroWhatsApp = "5592993168201"; 
            const mensagem = "Oss! Mestre, acabei de realizar o pagamento da minha mensalidade pelo PIX. Segue o meu comprovante!";
            const linkWhatsapp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
            window.open(linkWhatsapp, '_blank');
        });
    }, 800);
});


// FUNÇÃO BLINDADA: CARREGAR OS AVISOS 
async function carregarAvisos() {
    const lista = document.getElementById('lista-avisos');
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando...</p>`;

    // Query simplificada (sem exigir colunas automáticas de data)
    const { data: avisos, error } = await supabase.from('avisos').select('*');

    if (error) {
        // Se houver erro, agora ele vai escrever na sua tela qual é o problema!
        lista.innerHTML = `<p style="color: #ff5252; text-align: center; margin-top: 20px;">Erro: ${error.message}</p>`;
        return;
    }

    if (!avisos || avisos.length === 0) {
        lista.innerHTML = `
            <div class="card-status" style="padding: 20px; text-align: center;">
                <p style="color: #aaaaaa; margin: 0;">Nenhum aviso no momento. Bom treino!</p>
            </div>`;
        return;
    }

    lista.innerHTML = ""; 
    // Invertemos a ordem no JavaScript para o aviso mais novo ficar no topo
    for (const aviso of avisos.reverse()) {
        lista.innerHTML += `
            <div class="card-status" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--cor-destaque); text-align: left;">
                <h4 style="color: white; font-size: 16px; margin-bottom: 8px;">${aviso.titulo}</h4>
                <p style="color: #aaaaaa; font-size: 14px; line-height: 1.5; margin: 0;">${aviso.mensagem}</p>
            </div>`;
    }
}

document.getElementById('btn-sair').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
});

verificarAcesso();
