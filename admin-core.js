// ==========================================
// LOADING ULTRA RÁPIDO (SEM ANIMAÇÃO PESADA)
// ==========================================
window.mostrarCarregamento = function(mensagem) {
    Swal.fire({
        title: mensagem,
        background: '#161618',
        color: '#fff',
        showConfirmButton: false,
        allowOutsideClick: false,
        timerProgressBar: true,
        didOpen: () => { Swal.showLoading() }
    });
};

window.fecharCarregamento = function() {
    Swal.close();
};

// ==========================================
// SUCESSO INSTANTÂNEO
// ==========================================
window.mostrarSucesso = function(titulo, mensagem) {
    Swal.fire({ 
        icon: 'success', 
        title: titulo, 
        text: mensagem, 
        background: '#161618', 
        color: '#fff', 
        confirmButtonColor: '#4CAF50', 
        confirmButtonText: 'OK',
        timer: 2000,
        showConfirmButton: false
    });
};

// ==========================================
// CONTROLE DO MENU LATERAL
// ==========================================
window.abrirMenu = function() {
    document.getElementById('menu-lateral').classList.add('aberto');
    document.getElementById('menu-backdrop').style.display = 'block';
    setTimeout(() => document.getElementById('menu-backdrop').style.opacity = '1', 10);
};

window.fecharMenu = function() {
    document.getElementById('menu-lateral').classList.remove('aberto');
    document.getElementById('menu-backdrop').style.opacity = '0';
    setTimeout(() => document.getElementById('menu-backdrop').style.display = 'none', 300);
};

// ==========================================
// TROCA DE ABAS
// ==========================================
window.trocarAba = function(idAba, elemento) {
    document.querySelectorAll('.secao-admin').forEach(s => s.style.display = 'none');
    document.getElementById(idAba).style.display = 'block';

    document.querySelectorAll('.menu-item').forEach(t => t.classList.remove('active'));
    if (elemento) elemento.classList.add('active');

    fecharMenu(); 
    window.scrollTo(0, 0); 

    if(idAba === 'aba-pendentes' && typeof iniciarPainelAdmin === 'function') iniciarPainelAdmin();
    if(idAba === 'aba-alunos' && typeof carregarTodosAlunos === 'function') carregarTodosAlunos(); 
    if(idAba === 'aba-mural' && typeof carregarAvisosAdmin === 'function') carregarAvisosAdmin(); 
};

// ==========================================
// VERIFICAR AUTORIZAÇÃO
// ==========================================
async function verificarAcessoAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "index.html"; return; }

    const { data: perfil } = await supabase.from('perfis').select('cargo').eq('id', session.user.id).single();
    if (!perfil || perfil.cargo !== 'professor') { window.location.href = "painel.html"; return; }

    if(typeof iniciarPainelAdmin === 'function') iniciarPainelAdmin();
}

window.alterarModoManutencao = async function() {
    const { data } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).single();
    if(data) {
        await supabase.from('sistema_config').update({ manutencao_ativa: !data.manutencao_ativa }).eq('id', 1);
        window.atualizarVisualBotao(!data.manutencao_ativa);
    }
};

window.atualizarVisualBotao = function(ativa) {
    const btn = document.getElementById('btn-toggle-manutencao');
    if(!btn) return;
    btn.innerText = ativa ? "DESATIVAR BLOQUEIO" : "ATIVAR BLOQUEIO";
    btn.style.background = ativa ? "#4CAF50" : "#e53935";
};

async function checarStatusInicial() {
    const { data } = await supabase.from('sistema_config').select('manutencao_ativa').eq('id', 1).single();
    if (data) window.atualizarVisualBotao(data.manutencao_ativa);
}

// ==========================================
// MURAL DE AVISOS
// ==========================================
async function carregarAvisosAdmin() {
    const lista = document.getElementById('lista-avisos-admin');
    if(!lista) return;
    lista.innerHTML = '';
    const msgCarregando = document.createElement('p');
    msgCarregando.style.cssText = 'color: #aaaaaa; text-align: center;';
    msgCarregando.textContent = 'Carregando...';
    lista.appendChild(msgCarregando);

    const { data: avisos } = await supabase.from('avisos').select('*');

    lista.innerHTML = "";
    if (!avisos || avisos.length === 0) {
        const msgVazio = document.createElement('p');
        msgVazio.style.cssText = 'color: #aaaaaa; text-align: center;';
        msgVazio.textContent = 'Nenhum aviso.';
        lista.appendChild(msgVazio);
        return;
    }
    (avisos || []).reverse().forEach(aviso => {
        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding: 15px; margin-bottom: 12px; border-left: 4px solid var(--cor-destaque); position: relative;';

        const btnDel = document.createElement('button');
        btnDel.style.cssText = 'position: absolute; top: 10px; right: 10px; width: auto; background: none; border: none; color: #ff5252; font-size: 16px;';
        btnDel.textContent = '🗑️';
        btnDel.onclick = () => deletarAviso(aviso.id);
        card.appendChild(btnDel);

        const h4 = document.createElement('h4');
        h4.style.cssText = 'color: white; margin-bottom: 5px; font-size: 15px;';
        h4.textContent = aviso.titulo || '';
        card.appendChild(h4);

        const p = document.createElement('p');
        p.style.cssText = 'color: #888; font-size: 12px; margin: 0;';
        p.textContent = aviso.mensagem || '';
        card.appendChild(p);

        lista.appendChild(card);
    });
}

window.deletarAviso = async function(id) {
    const result = await Swal.fire({ title: 'Apagar aviso?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff' });
    if(result.isConfirmed) { 
        await supabase.from('avisos').delete().eq('id', id); 
        carregarAvisosAdmin(); 
    }
};

// ==========================================
// SANFONA E CONFIGURAÇÕES
// ==========================================
window.toggleSanfona = function(idSecao) {
    const todasSanfonas = ['config-seguranca', 'config-novo-aluno', 'config-mensalidades', 'config-manutencao'];
    todasSanfonas.forEach(id => {
        if (id !== idSecao) {
            const secaoFechada = document.getElementById(id);
            const setaFechada = document.getElementById('seta-' + id);
            if (secaoFechada) secaoFechada.style.display = 'none';
            if (setaFechada) setaFechada.innerText = '▼';
        }
    });
    const c = document.getElementById(idSecao); 
    const s = document.getElementById('seta-' + idSecao);
    if(!c) return;
    c.style.display = (c.style.display === 'none' || c.style.display === '') ? 'block' : 'none';
    if(s) s.innerText = c.style.display === 'block' ? '▲' : '▼';
};

window.atualizarMeusDados = async function() {
    const { value: novoEmail } = await Swal.fire({ title: 'Atualizar E-mail', input: 'email', inputPlaceholder: 'Novo e-mail de acesso', background: '#161618', color: '#fff', confirmButtonColor: '#E53935', showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular' });
    if (novoEmail) {
        const { error: errEmail } = await supabase.auth.updateUser({ email: novoEmail });
        if (errEmail) Swal.fire({ icon: 'error', title: 'Erro', text: errEmail.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        else Swal.fire({ icon: 'success', title: 'E-mail Atualizado!', text: 'Verifique a caixa de entrada.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
    }
    const { value: novaSenha } = await Swal.fire({ title: 'Atualizar Senha', input: 'password', inputPlaceholder: 'Nova senha (mín. 6 caracteres)', background: '#161618', color: '#fff', confirmButtonColor: '#E53935', showCancelButton: true, cancelButtonColor: '#333', cancelButtonText: 'Pular' });
    if (novaSenha) {
        if (novaSenha.length < 6) {
            Swal.fire({ icon: 'warning', title: 'Senha fraca', text: 'A senha deve ter no mínimo 6 caracteres.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            return;
        }
        const { error: errSenha } = await supabase.auth.updateUser({ password: novaSenha });
        if (errSenha) Swal.fire({ icon: 'error', title: 'Erro', text: errSenha.message, background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        else Swal.fire({ icon: 'success', title: 'Senha Atualizada!', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
    }
};

// ==========================================
// BUSCA CENTRALIZADA OTIMIZADA
// ==========================================
window.iniciarPainelAdmin = async function() {
    try {
        const [ { data: alunos }, { data: mensalidades } ] = await Promise.all([
            supabase.from('perfis').select('id, nome, telefone, plano_pausado, cargo, data_nascimento, foto_url, faixa').neq('cargo', 'professor'),
            supabase.from('mensalidades').select('*')
        ]);
        if (typeof window.renderizarAniversariantes === 'function') window.renderizarAniversariantes(alunos);
        if (typeof window.renderizarPendentes === 'function') window.renderizarPendentes(mensalidades, alunos);
    } catch (err) {
        console.error("Erro na busca central:", err);
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const btnSair = document.getElementById('btn-sair');
    if(btnSair) {
        btnSair.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = "index.html";
        });
    }

    const btnAviso = document.getElementById('btn-publicar-aviso');
    if(btnAviso) {
        btnAviso.addEventListener('click', async () => {
            const titulo = document.getElementById('aviso-titulo').value.trim();
            const mensagem = document.getElementById('aviso-mensagem').value.trim();
            if(!titulo || titulo.length < 2) { Swal.fire({ icon: 'warning', title: 'Título inválido', text: 'Informe um título com pelo menos 2 caracteres.', background: '#161618', color: '#fff' }); return; }
            if(!mensagem || mensagem.length < 2) { Swal.fire({ icon: 'warning', title: 'Mensagem inválida', text: 'Informe uma mensagem com pelo menos 2 caracteres.', background: '#161618', color: '#fff' }); return; }
            await supabase.from('avisos').insert([{ titulo, mensagem }]);
            Swal.fire({ icon: 'success', title: 'Aviso Publicado!', background: '#161618', color: '#fff', showConfirmButton: false, timer: 1500 });
            document.getElementById('aviso-titulo').value = "";
            document.getElementById('aviso-mensagem').value = "";
            carregarAvisosAdmin();
        });
    }

    checarStatusInicial();
    verificarAcessoAdmin();
});
