// ==========================================
// CARTEIRINHA DIGITAL PREMIUM — 4L ACADEMY
// Substitua a função abrirCarteirinha() no painel-perfil.js
// ==========================================

window.abrirCarteirinha = async function() {
    Swal.fire({ 
        title: 'Gerando Carteirinha...', 
        background: '#161618', 
        color: '#fff', 
        didOpen: () => { Swal.showLoading() } 
    });

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const usuarioId = session.user.id;

        // Busca perfil + estatísticas
        const { data: perfil } = await window.supabase
            .from('perfis')
            .select('*')
            .eq('id', usuarioId)
            .single();

        if (!perfil) throw new Error("Perfil não encontrado");

        // Busca contagem de mensalidades pagas (como proxy de "treinos/meses ativos")
        const { data: mensalidades } = await window.supabase
            .from('mensalidades')
            .select('status, criado_em')
            .eq('aluno_id', usuarioId)
            .order('criado_em', { ascending: false });

        const pagamentos = (mensalidades || []).filter(m => m.status === 'pago');
        const mesesAtivos = pagamentos.length;

        // Dados
        const foto = perfil.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nome)}&background=161618&color=fff`;
        const nome = perfil.nome || 'Aluno';
        const faixaRaw = (perfil.faixa || 'Branca').toLowerCase();
        const faixaDisplay = (perfil.faixa || 'Branca').toUpperCase();

        // Cor da faixa
        let corBorda = '#E53935';
        if (faixaRaw.includes('branca')) corBorda = '#f5f5f5';
        else if (faixaRaw.includes('cinza')) corBorda = '#9E9E9E';
        else if (faixaRaw.includes('amarela')) corBorda = '#FBC02D';
        else if (faixaRaw.includes('laranja')) corBorda = '#FF9800';
        else if (faixaRaw.includes('verde')) corBorda = '#4CAF50';
        else if (faixaRaw.includes('azul')) corBorda = '#1976D2';
        else if (faixaRaw.includes('roxa')) corBorda = '#ab47bc';
        else if (faixaRaw.includes('marrom')) corBorda = '#8d6e63';
        else if (faixaRaw.includes('preta')) corBorda = '#ffffff';
        else if (faixaRaw.includes('coral') || faixaRaw.includes('vermelha')) corBorda = '#D32F2F';

        // Extrai grau numérico
        let qtdGraus = 0;
        const matchGrau = faixaRaw.match(/(\d+)/);
        if (matchGrau) qtdGraus = parseInt(matchGrau[1]);

        // Status
        const isAtivo = !perfil.plano_pausado;
        const isVip = perfil.assinante;
        const corStatus = isAtivo ? '#22c55e' : '#ff5252';
        const textoStatus = isAtivo ? '✅ MEMBRO ATIVO' : '🔴 INATIVO';

        // Matrícula (gerada a partir do ID se não existir)
        const matricula = perfil.matricula || '4L-' + usuarioId.slice(-4).toUpperCase();

        // Validade
        const anoAtual = new Date().getFullYear();
        const validade = `Dez/${anoAtual + 1}`;

        // Aniversariante?
        const hoje = new Date();
        let seloAniversario = '';
        if (perfil.data_nascimento && typeof perfil.data_nascimento === 'string') {
            const mesNasc = parseInt(perfil.data_nascimento.split('-')[1]);
            if (mesNasc === (hoje.getMonth() + 1)) {
                seloAniversario = `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">🎂 Aniversariante</span>`;
            }
        }

        // Dados médicos (fallback se não tiver no banco)
        const tipoSanguineo = perfil.tipo_sanguineo || 'Não informado';
        const emergenciaNome = perfil.contato_emergencia_nome || 'Não informado';
        const emergenciaTel = perfil.contato_emergencia_telefone || '—';

        // Data de início
        const dataInicio = perfil.data_inicio 
            ? new Date(perfil.data_inicio).toLocaleDateString('pt-BR') 
            : new Date(perfil.created_at || Date.now()).toLocaleDateString('pt-BR');

        // Barrinhas de grau
        let grausHtml = '';
        if (qtdGraus > 0) {
            const bolinhas = Array(qtdGraus).fill(`<span style="width:7px;height:7px;background:${corBorda};border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,0.3);"></span>`).join('');
            grausHtml = `<div style="display:flex;gap:4px;justify-content:center;margin-top:5px;">${bolinhas}</div>`;
        }

        // Safe escapes
        const safeNome = escapeHtml(nome);
        const safeFaixa = escapeHtml(faixaDisplay);
        const safeMatricula = escapeHtml(matricula);

        // HTML da carteirinha
        const htmlCarteirinha = `
<style>
    #carteirinha-4l-wrapper { perspective: 1000px; width: 100%; max-width: 340px; margin: 0 auto; }
    #carteirinha-4l-inner { 
        position: relative; width: 100%; height: 420px; 
        transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); 
        transform-style: preserve-3d; cursor: pointer;
    }
    #carteirinha-4l-wrapper.flipped #carteirinha-4l-inner { transform: rotateY(180deg); }
    .c4l-face { 
        position: absolute; width: 100%; height: 100%; backface-visibility: hidden; 
        border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);
    }
    .c4l-front { 
        background: linear-gradient(160deg, #0c0c0e 0%, #16161a 50%, #0f0f12 100%);
    }
    .c4l-back { 
        background: linear-gradient(160deg, #111113 0%, #1a1a1e 100%); 
        transform: rotateY(180deg); padding: 18px; display: flex; flex-direction: column;
    }
    .c4l-watermark {
        position: absolute; inset: 0; pointer-events: none; opacity: 0.025;
        background-image: repeating-linear-gradient(
            -45deg, transparent, transparent 30px, rgba(255,255,255,0.4) 30px, rgba(255,255,255,0.4) 31px
        );
    }
    .c4l-watermark-text {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 42px; font-weight: 900; color: rgba(255,255,255,0.04); text-transform: uppercase;
        letter-spacing: 4px; white-space: nowrap; pointer-events: none;
    }
    .c4l-header { 
        display: flex; align-items: center; justify-content: space-between; 
        padding: 12px 14px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; z-index: 2;
    }
    .c4l-logo { font-style: italic; font-weight: 900; font-size: 15px; color: #fff; letter-spacing: -0.3px; }
    .c4l-logo span { color: #E53935; }
    .c4l-chip { 
        width: 30px; height: 20px; border-radius: 4px; 
        background: linear-gradient(135deg, #d4af37, #f9e076, #d4af37); position: relative; 
    }
    .c4l-chip::after { content: ''; position: absolute; inset: 3px; border: 1px solid rgba(0,0,0,0.25); border-radius: 2px; }
    .c4l-body { display: flex; padding: 14px; gap: 14px; flex: 1; position: relative; z-index: 2; }
    .c4l-photo-wrap { position: relative; flex-shrink: 0; }
    .c4l-photo { 
        width: 80px; height: 80px; border-radius: 50%; object-fit: cover; 
        border: 3px solid ${corBorda}; box-shadow: 0 0 0 4px ${corBorda}22;
    }
    .c4l-grau-badge { 
        position: absolute; bottom: -2px; right: -2px; width: 24px; height: 24px; 
        border-radius: 50%; background: ${corBorda}; border: 2px solid #0c0c0e; 
        display: flex; align-items: center; justify-content: center; 
        font-size: 10px; font-weight: 800; color: #000;
    }
    .c4l-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
    .c4l-name { font-size: 16px; font-weight: 800; color: #fff; margin: 0 0 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .c4l-belt-text { font-size: 12px; font-weight: 700; color: ${corBorda}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .c4l-badges { display: flex; gap: 5px; flex-wrap: wrap; }
    .c4l-badge { 
        font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 20px; 
        text-transform: uppercase; letter-spacing: 0.3px; 
    }
    .c4l-badge.active { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); }
    .c4l-badge.vip { background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); }
    .c4l-badge.since { background: rgba(255,255,255,0.05); color: #888; border: 1px solid rgba(255,255,255,0.08); }
    .c4l-stats-bar { 
        display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.04); 
        position: relative; z-index: 2;
    }
    .c4l-stat { flex: 1; text-align: center; }
    .c4l-stat-value { font-size: 16px; font-weight: 800; color: #fff; }
    .c4l-stat-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .c4l-footer-bar { 
        display: flex; align-items: center; justify-content: space-between; 
        padding: 10px 14px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.04); 
        position: relative; z-index: 2;
    }
    .c4l-mat { font-size: 10px; color: #555; font-family: monospace; letter-spacing: 0.5px; }
    .c4l-qr { width: 34px; height: 34px; background: #fff; border-radius: 4px; padding: 3px; }
    .c4l-back-title { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .c4l-back-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .c4l-back-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px; }
    .c4l-back-label { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .c4l-back-value { font-size: 12px; color: #ccc; font-weight: 600; }
    .c4l-back-full { grid-column: 1 / -1; }
    .c4l-back-footer { 
        margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); 
        display: flex; justify-content: space-between; align-items: center;
    }
    .c4l-valid { font-size: 10px; color: #555; }
    .c4l-valid b { color: #888; }
    .c4l-actions { 
        display: flex; gap: 8px; margin-top: 14px; justify-content: center;
    }
    .c4l-actions button { 
        padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 700; 
        cursor: pointer; border: none; transition: all 0.15s;
    }
    .c4l-btn-download { background: linear-gradient(135deg, #E53935, #B71C1C); color: white; }
    .c4l-btn-download:active { transform: scale(0.95); opacity: 0.9; }
    .c4l-btn-share { background: rgba(255,255,255,0.06); color: #aaa; border: 1px solid rgba(255,255,255,0.1); }
    .c4l-hint { text-align: center; font-size: 11px; color: #555; margin-top: 8px; }
</style>

<div id="carteirinha-4l-wrapper" onclick="document.getElementById('carteirinha-4l-wrapper').classList.toggle('flipped')">
    <div id="carteirinha-4l-inner">
        <!-- FRENTE -->
        <div class="c4l-face c4l-front">
            <div class="c4l-watermark"></div>
            <div class="c4l-watermark-text">4L ACADEMY</div>

            <div class="c4l-header">
                <div class="c4l-logo">4L <span>ACADEMY</span></div>
                <div class="c4l-chip"></div>
            </div>

            <div class="c4l-body">
                <div class="c4l-photo-wrap">
                    <img src="${foto}" class="c4l-photo" alt="${safeNome}" crossorigin="anonymous">
                    ${qtdGraus > 0 ? `<div class="c4l-grau-badge">${qtdGraus}º</div>` : ''}
                </div>
                <div class="c4l-meta">
                    <h3 class="c4l-name">${safeNome}</h3>
                    <div class="c4l-belt-text">🥋 ${safeFaixa}</div>
                    ${grausHtml}
                    <div class="c4l-badges" style="margin-top:8px;">
                        <span class="c4l-badge active">${textoStatus}</span>
                        ${isVip ? '<span class="c4l-badge vip">👑 VIP</span>' : ''}
                        <span class="c4l-badge since">Desde ${dataInicio.split('/')[2]}</span>
                        ${seloAniversario}
                    </div>
                </div>
            </div>

            <div class="c4l-stats-bar">
                <div class="c4l-stat">
                    <div class="c4l-stat-value">${mesesAtivos}</div>
                    <div class="c4l-stat-label">Meses</div>
                </div>
                <div class="c4l-stat">
                    <div class="c4l-stat-value">${qtdGraus}</div>
                    <div class="c4l-stat-label">Graus</div>
                </div>
                <div class="c4l-stat">
                    <div class="c4l-stat-value">${validade.split('/')[1]}</div>
                    <div class="c4l-stat-label">Validade</div>
                </div>
            </div>

            <div class="c4l-footer-bar">
                <span class="c4l-mat">${safeMatricula}</span>
                <div class="c4l-qr">
                    <svg viewBox="0 0 34 34" style="display:block;">
                        <rect x="0" y="0" width="34" height="34" fill="white"/>
                        <rect x="2" y="2" width="10" height="10" fill="black"/>
                        <rect x="4" y="4" width="6" height="6" fill="white"/>
                        <rect x="5" y="5" width="4" height="4" fill="black"/>
                        <rect x="22" y="2" width="10" height="10" fill="black"/>
                        <rect x="24" y="4" width="6" height="6" fill="white"/>
                        <rect x="25" y="5" width="4" height="4" fill="black"/>
                        <rect x="2" y="22" width="10" height="10" fill="black"/>
                        <rect x="4" y="24" width="6" height="6" fill="white"/>
                        <rect x="5" y="25" width="4" height="4" fill="black"/>
                        <rect x="16" y="2" width="4" height="4" fill="black"/>
                        <rect x="16" y="8" width="4" height="2" fill="black"/>
                        <rect x="14" y="16" width="6" height="2" fill="black"/>
                        <rect x="16" y="20" width="4" height="4" fill="black"/>
                        <rect x="22" y="16" width="4" height="4" fill="black"/>
                        <rect x="28" y="16" width="2" height="6" fill="black"/>
                        <rect x="22" y="24" width="2" height="6" fill="black"/>
                        <rect x="26" y="26" width="6" height="6" fill="black"/>
                        <rect x="28" y="28" width="2" height="2" fill="white"/>
                        <rect x="2" y="16" width="6" height="2" fill="black"/>
                        <rect x="8" y="14" width="2" height="6" fill="black"/>
                    </svg>
                </div>
            </div>
        </div>

        <!-- VERSO -->
        <div class="c4l-face c4l-back">
            <div class="c4l-back-title">⚕️ Dados Complementares</div>
            <div class="c4l-back-grid">
                <div class="c4l-back-item">
                    <div class="c4l-back-label">Tipo Sanguíneo</div>
                    <div class="c4l-back-value" style="color:${tipoSanguineo !== 'Não informado' ? '#E53935' : '#555'};">${escapeHtml(tipoSanguineo)}</div>
                </div>
                <div class="c4l-back-item">
                    <div class="c4l-back-label">Plano</div>
                    <div class="c4l-back-value">${isVip ? 'VIP Recorrente' : 'Mensal'}</div>
                </div>
                <div class="c4l-back-item">
                    <div class="c4l-back-label">Início</div>
                    <div class="c4l-back-value">${dataInicio}</div>
                </div>
                <div class="c4l-back-item">
                    <div class="c4l-back-label">Validade</div>
                    <div class="c4l-back-value">${validade}</div>
                </div>
                <div class="c4l-back-item c4l-back-full">
                    <div class="c4l-back-label">Contato de Emergência</div>
                    <div class="c4l-back-value">${escapeHtml(emergenciaNome)} · ${escapeHtml(emergenciaTel)}</div>
                </div>
            </div>

            <div style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.04);">
                <div style="font-size:9px;color:#444;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">📍 ACADEMIA</div>
                <div style="font-size:11px;color:#777;line-height:1.5;">
                    4L Academy — Brazilian Jiu-Jitsu<br>
                    Manaus/AM · WhatsApp: (92) 98558-9868
                </div>
            </div>

            <div class="c4l-back-footer">
                <span class="c4l-valid">Validade: <b>${validade}</b></span>
                <span style="font-size:8px;color:#333;">ID: ${usuarioId.slice(0,8)}...</span>
            </div>
        </div>
    </div>
</div>

<div class="c4l-hint">👆 Toque na carteirinha para virar</div>

<div class="c4l-actions">
    <button class="c4l-btn-download" onclick="baixarCarteirinha(event)">
        💾 Salvar Imagem
    </button>
    <button class="c4l-btn-share" onclick="compartilharCarteirinha(event)">
        📤 Compartilhar
    </button>
</div>
        `;

        Swal.fire({
            html: htmlCarteirinha,
            background: '#0a0a0c',
            showConfirmButton: false,
            showCloseButton: true,
            padding: '20px 15px',
            width: '380px',
            customClass: { popup: 'swal-carteirinha' }
        });

    } catch (error) {
        console.error(error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Erro', 
            text: 'Não foi possível gerar a carteirinha.', 
            background: '#161618', 
            color: '#fff' 
        });
    }
};

// ==========================================
// FUNÇÕES AUXILIARES (adicione também no arquivo)
// ==========================================

window.baixarCarteirinha = async function(e) {
    if (e) e.stopPropagation();

    // Verifica se html2canvas está carregado
    if (typeof html2canvas === 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Biblioteca não carregada',
            text: 'Adicione o script do html2canvas no painel.html para habilitar o download.',
            background: '#161618',
            color: '#fff',
            confirmButtonColor: '#E53935'
        });
        return;
    }

    const wrapper = document.getElementById('carteirinha-4l-wrapper');
    if (!wrapper) return;

    // Remove o flip temporariamente para capturar a frente
    wrapper.classList.remove('flipped');

    Swal.fire({ 
        title: 'Gerando imagem...', 
        background: '#161618', 
        color: '#fff', 
        didOpen: () => { Swal.showLoading() } 
    });

    try {
        const canvas = await html2canvas(wrapper, {
            backgroundColor: '#0c0c0e',
            scale: 3,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const link = document.createElement('a');
        link.download = '4l-academy-carteirinha.png';
        link.href = canvas.toDataURL('image/png');
        link.click();

        Swal.close();
        Swal.fire({
            toast: true,
            position: 'top',
            icon: 'success',
            title: 'Imagem salva!',
            showConfirmButton: false,
            timer: 2000,
            background: '#161618',
            color: '#fff'
        });
    } catch (err) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Erro ao salvar', 
            text: err.message, 
            background: '#161618', 
            color: '#fff' 
        });
    }
};

window.compartilharCarteirinha = async function(e) {
    if (e) e.stopPropagation();

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Minha Carteirinha - 4L Academy',
                text: 'Confira minha carteirinha digital da 4L Academy! 🥋',
                url: window.location.href
            });
        } catch (err) {
            // Usuário cancelou
        }
    } else {
        Swal.fire({
            icon: 'info',
            title: 'Compartilhar',
            text: 'Seu navegador não suporta compartilhamento nativo.',
            background: '#161618',
            color: '#fff'
        });
    }
};