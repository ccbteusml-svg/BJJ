// ==========================================
// CARTEIRINHA DIGITAL — 4L ACADEMY (v3 · estilo federação)
// Modelo paisagem: campos etiquetados + foto retangular à direita
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
        if (!session) {
            Swal.close();
            window.location.replace("index.html");
            return;
        }

        const usuarioId = session.user.id;

        const { data: perfil } = await window.supabase
            .from('perfis')
            .select('*')
            .eq('id', usuarioId)
            .maybeSingle();

        if (!perfil) throw new Error("Perfil não encontrado");

        // ===== DADOS =====
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

        // Grau numérico
        let qtdGraus = 0;
        const matchGrau = faixaRaw.match(/(\d+)/);
        if (matchGrau) qtdGraus = parseInt(matchGrau[1]);

        // Status
        const isAtivo = !perfil.plano_pausado;
        const isVip = perfil.assinante;
        const corStatus = isAtivo ? '#22c55e' : '#ff5252';
        const textoStatus = isAtivo ? 'ATIVO' : 'INATIVO';

        // Matrícula
        const matricula = perfil.matricula || '4L-' + usuarioId.slice(-4).toUpperCase();

        // Validade
        const anoAtual = new Date().getFullYear();
        const validade = `Dez/${anoAtual + 1}`;

        const hoje = new Date();

        // Nascimento + categoria por idade (estilo federação)
        let nascTxt = '—';
        let categoriaTxt = '—';
        if (perfil.data_nascimento && typeof perfil.data_nascimento === 'string') {
            const nasc = new Date(perfil.data_nascimento + 'T12:00:00');
            if (!isNaN(nasc)) {
                nascTxt = nasc.toLocaleDateString('pt-BR');
                let idade = hoje.getFullYear() - nasc.getFullYear();
                const mDiff = hoje.getMonth() - nasc.getMonth();
                if (mDiff < 0 || (mDiff === 0 && hoje.getDate() < nasc.getDate())) idade--;
                if (idade >= 0 && idade < 130) {
                    let cat;
                    if (idade <= 15) cat = 'Infantil';
                    else if (idade <= 17) cat = 'Juvenil';
                    else if (idade <= 29) cat = 'Adulto';
                    else if (idade <= 35) cat = 'Master 1';
                    else if (idade <= 40) cat = 'Master 2';
                    else if (idade <= 45) cat = 'Master 3';
                    else if (idade <= 50) cat = 'Master 4';
                    else cat = 'Master 5+';
                    categoriaTxt = cat;
                }
            }
        }

        // Membro desde
        const dataInicio = perfil.data_inicio
            ? new Date(perfil.data_inicio).toLocaleDateString('pt-BR')
            : new Date(perfil.created_at || Date.now()).toLocaleDateString('pt-BR');
        const desdeTxt = dataInicio.split('/')[2] || dataInicio;

        // Faixa visual estilo kimono (corpo + ponteira + graus)
        const isPreta = faixaRaw.includes('preta');
        const corFaixaReal = isPreta ? '#161616' : corBorda;
        const corPonteira = isPreta ? '#C62828' : '#141414';
        const larguraPonteira = qtdGraus > 0 ? Math.max(30, 10 + qtdGraus * 8) : 24;
        const stripesHtml = Array(qtdGraus).fill('<span class="c4l-grau-stripe"></span>').join('');
        const faixaVisualHtml = `
            <div class="c4l-faixa-visual" title="${escapeHtml(faixaDisplay)}${qtdGraus ? ' · ' + qtdGraus + 'º grau' : ''}">
                <div class="c4l-faixa-corpo" style="background: linear-gradient(180deg, ${corFaixaReal}99 0%, ${corFaixaReal} 35%, ${corFaixaReal} 65%, ${corFaixaReal}99 100%);"></div>
                <div class="c4l-faixa-ponteira" style="background:${corPonteira};width:${larguraPonteira}px;">${stripesHtml}</div>
            </div>`;

        const safeNome = escapeHtml(nome);
        const safeFaixa = escapeHtml(faixaDisplay);
        const safeMatricula = escapeHtml(matricula);
        const safeNasc = escapeHtml(nascTxt);
        const safeCategoria = escapeHtml(categoriaTxt);

        // Dados para o download em canvas
        window._cart4l = {
            nome, faixaDisplay, corBorda, corFaixaReal, corPonteira,
            qtdGraus, validade, matricula, nascTxt, categoriaTxt,
            isAtivo, isVip, textoStatus, desdeTxt, foto
        };

        const campo = (label, valor) => `
            <div class="c4l-campo">
                <span class="c4l-campo-label">${label}</span>
                <span class="c4l-campo-valor">${valor}</span>
            </div>`;

        // ===== HTML (paisagem, estilo carteirinha de federação) =====
        const htmlCarteirinha = `
<style>
    #carteirinha-4l { width: 100%; max-width: 360px; margin: 0 auto; }
    .c4l-card {
        position: relative; width: 100%; aspect-ratio: 856 / 540;
        border-radius: 14px; overflow: hidden;
        background: linear-gradient(150deg, #0c0c0e 0%, #17171b 55%, #100c0d 100%);
        border: 1px solid rgba(255,255,255,0.10);
        display: flex; flex-direction: column;
        box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }
    .c4l-card::before { /* textura sutil diagonal */
        content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
        background-image: repeating-linear-gradient(-45deg, transparent, transparent 26px, rgba(255,255,255,0.5) 26px, rgba(255,255,255,0.5) 27px);
    }
    /* Cabeçalho estilo federação */
    .c4l-topo {
        position: relative; z-index: 2; text-align: center;
        padding: 10px 12px 8px;
        background: linear-gradient(90deg, #B71C1C 0%, #E53935 50%, #B71C1C 100%);
        border-bottom: 2px solid rgba(0,0,0,0.4);
    }
    .c4l-topo-titulo {
        font-style: italic; font-weight: 900; font-size: 15px; color: #fff;
        letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.1;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    .c4l-topo-sub {
        font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.85);
        letter-spacing: 2.5px; text-transform: uppercase; margin-top: 2px;
    }
    /* Corpo: campos à esquerda, foto à direita */
    .c4l-corpo { display: flex; flex: 1; position: relative; z-index: 2; min-height: 0; }
    .c4l-campos { flex: 1; padding: 10px 4px 8px 12px; display: flex; flex-direction: column; justify-content: center; gap: 5px; min-width: 0; }
    .c4l-campo { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .c4l-campo-label {
        flex-shrink: 0; font-size: 7.5px; font-weight: 800; color: #0a0a0c;
        background: #e8e8e8; border-radius: 3px; padding: 2px 5px;
        letter-spacing: 0.4px; text-transform: uppercase;
    }
    .c4l-campo-valor {
        font-size: 11.5px; font-weight: 800; color: #fff;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        text-transform: uppercase; letter-spacing: 0.2px;
    }
    .c4l-dupla { display: flex; gap: 10px; }
    .c4l-dupla .c4l-campo { flex: 1; }
    .c4l-foto-area {
        flex-shrink: 0; width: 31%; padding: 10px 12px 8px 6px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    }
    .c4l-foto {
        width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 8px;
        border: 3px solid ${corBorda}; box-shadow: 0 0 0 3px ${corBorda}33, 0 6px 16px rgba(0,0,0,0.5);
        background: #1c1c20;
    }
    .c4l-status-pill {
        font-size: 8px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
        color: ${corStatus}; border: 1px solid ${corStatus}55; background: ${corStatus}18;
        padding: 2px 10px; border-radius: 20px;
    }
    /* Faixa estilo kimono */
    .c4l-faixa-visual {
        display: flex; height: 11px; max-width: 150px; border-radius: 3px; overflow: hidden;
        margin: 1px 0; border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 1px 4px rgba(0,0,0,0.55);
    }
    .c4l-faixa-corpo { flex: 1; }
    .c4l-faixa-ponteira {
        flex-shrink: 0; display: flex; align-items: stretch; justify-content: flex-end;
        gap: 2.5px; padding: 0 4px 0 5px; border-left: 1px solid rgba(0,0,0,0.5);
    }
    .c4l-grau-stripe { width: 3.5px; background: #f5f5f5; box-shadow: 0 0 2px rgba(0,0,0,0.7); }
    /* Rodapé */
    .c4l-pe {
        position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between;
        padding: 6px 12px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.06);
    }
    .c4l-pe-item { font-size: 8px; color: #777; letter-spacing: 0.5px; text-transform: uppercase; }
    .c4l-pe-item b { color: #ccc; font-size: 9px; }
    .c4l-acoes { display: flex; gap: 8px; margin-top: 14px; justify-content: center; }
    .c4l-acoes button {
        padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 700;
        cursor: pointer; border: none; transition: all 0.15s;
    }
    .c4l-btn-download { background: linear-gradient(135deg, #E53935, #B71C1C); color: white; }
    .c4l-btn-download:active { transform: scale(0.95); opacity: 0.9; }
    .c4l-hint { text-align: center; font-size: 11px; color: #555; margin-top: 8px; }
</style>

<div id="carteirinha-4l">
    <div class="c4l-card">
        <div class="c4l-topo">
            <div class="c4l-topo-titulo">4L Academy · Jiu-Jitsu</div>
            <div class="c4l-topo-sub">Carteirinha do Aluno · ${anoAtual}</div>
        </div>

        <div class="c4l-corpo">
            <div class="c4l-campos">
                ${campo('Nome', safeNome)}
                <div class="c4l-dupla">
                    ${campo('Faixa', safeFaixa)}
                    ${campo('Grau', qtdGraus > 0 ? qtdGraus + 'º' : '—')}
                </div>
                ${faixaVisualHtml}
                <div class="c4l-dupla">
                    ${campo('Categ.', safeCategoria)}
                    ${campo('Nasc.', safeNasc)}
                </div>
                <div class="c4l-dupla">
                    ${campo('Matríc.', safeMatricula)}
                    ${campo('Desde', escapeHtml(desdeTxt))}
                </div>
            </div>
            <div class="c4l-foto-area">
                <img src="${foto}" class="c4l-foto" alt="${safeNome}" crossorigin="anonymous">
                <span class="c4l-status-pill">${textoStatus}${isVip ? ' · VIP' : ''}</span>
            </div>
        </div>

        <div class="c4l-pe">
            <span class="c4l-pe-item">Validade: <b>${validade}</b></span>
            <span class="c4l-pe-item">4L Academy · <b>Oss!</b></span>
        </div>
    </div>

    <div class="c4l-acoes">
        <button class="c4l-btn-download" onclick="window.baixarCarteirinha(event)">📥 Baixar Carteirinha</button>
    </div>
    <p class="c4l-hint">Apresente esta carteirinha na academia</p>
</div>`;

        Swal.fire({
            html: htmlCarteirinha,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#0a0a0c',
            width: 420,
            customClass: { popup: 'carteirinha-popup' }
        });

    } catch (err) {
        console.error("Erro na carteirinha:", err);
        Swal.fire({ icon: 'error', title: 'Ops!', text: 'Não foi possível carregar a carteirinha.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    }
};

// ==========================================
// DOWNLOAD — desenha a carteirinha em canvas (paisagem)
// ==========================================
window.baixarCarteirinha = async function(e) {
    if (e) e.stopPropagation();

    const d = window._cart4l;
    if (!d) {
        Swal.fire({ icon: 'error', title: 'Erro ao salvar', text: 'Dados da carteirinha não encontrados. Feche e abra novamente.', background: '#161618', color: '#fff' });
        return;
    }

    Swal.fire({
        title: 'Gerando imagem...',
        background: '#161618',
        color: '#fff',
        didOpen: () => { Swal.showLoading() }
    });

    try {
        const W = 1080, H = 680;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

        // Fundo
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0c0c0e');
        bg.addColorStop(0.55, '#17171b');
        bg.addColorStop(1, '#100c0d');
        ctx.fillStyle = bg;
        rr(0, 0, W, H, 40); ctx.fill();

        // Textura diagonal
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let i = -H; i < W + H; i += 80) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
        }
        ctx.restore();

        // Borda
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 3;
        rr(2, 2, W - 4, H - 4, 38); ctx.stroke();

        // Faixa vermelha do topo
        const top = ctx.createLinearGradient(0, 0, W, 0);
        top.addColorStop(0, '#B71C1C');
        top.addColorStop(0.5, '#E53935');
        top.addColorStop(1, '#B71C1C');
        ctx.fillStyle = top;
        ctx.beginPath();
        ctx.roundRect(0, 0, W, 130, [40, 40, 0, 0]);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 124, W, 6);

        // Título
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'italic 900 56px Arial';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText('4L ACADEMY · JIU-JITSU', W / 2, 66);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 22px Arial';
        const anoTxt = 'CARTEIRINHA DO ALUNO · ' + new Date().getFullYear();
        ctx.fillText(anoTxt.split('').join('  '), W / 2, 106);

        // Área da foto (direita)
        const fotoX = W - 330, fotoY = 175, fotoW = 270, fotoH = 360;
        const desenharMoldura = () => {
            ctx.strokeStyle = d.corBorda;
            ctx.lineWidth = 8;
            rr(fotoX - 8, fotoY - 8, fotoW + 16, fotoH + 16, 18);
            ctx.stroke();
        };
        const desenharFotoFallback = () => {
            ctx.fillStyle = '#1c1c20';
            rr(fotoX, fotoY, fotoW, fotoH, 12); ctx.fill();
            ctx.fillStyle = '#E53935';
            ctx.font = '900 90px Arial';
            ctx.textAlign = 'center';
            const ini = d.nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
            ctx.fillText(ini, fotoX + fotoW / 2, fotoY + fotoH / 2 + 32);
            desenharMoldura();
        };

        // Campos (esquerda)
        const desenharCampos = () => {
            ctx.textAlign = 'left';
            const label = (txt, x, y) => {
                ctx.font = '800 19px Arial';
                const w = ctx.measureText(txt.toUpperCase()).width + 22;
                ctx.fillStyle = '#e8e8e8';
                rr(x, y - 20, w, 28, 5); ctx.fill();
                ctx.fillStyle = '#0a0a0c';
                ctx.fillText(txt.toUpperCase(), x + 11, y);
                return w;
            };
            const valor = (txt, x, y, maxW) => {
                ctx.fillStyle = '#fff';
                ctx.font = '800 30px Arial';
                let t = String(txt).toUpperCase();
                while (ctx.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2);
                if (t !== String(txt).toUpperCase()) t += '…';
                ctx.fillText(t, x, y);
            };

            let y = 210;
            const LX = 50;
            // NOME
            label('Nome', LX, y - 12); valor(d.nome, LX, y + 26, W - 430); y += 92;
            // FAIXA | GRAU
            label('Faixa', LX, y - 12); valor(d.faixaDisplay, LX, y + 26, 260);
            label('Grau', LX + 300, y - 12); valor(d.qtdGraus > 0 ? d.qtdGraus + 'º' : '—', LX + 300, y + 26, 100); y += 92;

            // Faixa visual (barra kimono)
            ctx.save();
            rr(LX, y - 18, 330, 30, 5); ctx.clip();
            ctx.fillStyle = d.corFaixaReal; ctx.fillRect(LX, y - 18, 330, 30);
            ctx.fillStyle = d.corPonteira;
            const pontW = d.qtdGraus > 0 ? Math.max(60, 20 + d.qtdGraus * 16) : 46;
            ctx.fillRect(LX + 330 - pontW, y - 18, pontW, 30);
            ctx.fillStyle = '#f5f5f5';
            for (let i = 0; i < d.qtdGraus; i++) ctx.fillRect(LX + 330 - 14 - i * 16, y - 18, 7, 30);
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 2;
            rr(LX, y - 18, 330, 30, 5); ctx.stroke();
            y += 62;

            // CATEG | NASC
            label('Categ.', LX, y - 12); valor(d.categoriaTxt, LX, y + 26, 260);
            label('Nasc.', LX + 300, y - 12); valor(d.nascTxt, LX + 300, y + 26, 230); y += 92;
            // MATRÍC | DESDE
            label('Matríc.', LX, y - 12); valor(d.matricula, LX, y + 26, 260);
            label('Desde', LX + 300, y - 12); valor(d.desdeTxt, LX + 300, y + 26, 100);

            // Status
            ctx.font = '800 22px Arial';
            const stTxt = '● ' + d.textoStatus + (d.isVip ? ' · VIP' : '');
            ctx.fillStyle = d.isAtivo ? '#22c55e' : '#ff5252';
            ctx.textAlign = 'center';
            ctx.fillText(stTxt, fotoX + fotoW / 2, fotoY + fotoH + 45);
            ctx.textAlign = 'left';
        };

        // Rodapé
        const desenharRodape = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.roundRect(0, H - 70, W, 70, [0, 0, 40, 40]);
            ctx.fill();
            ctx.fillStyle = '#999';
            ctx.font = '700 22px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('VALIDADE: ' + d.validade.toUpperCase(), 50, H - 27);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#E53935';
            ctx.font = 'italic 900 24px Arial';
            ctx.fillText('4L ACADEMY · OSS!', W - 50, H - 27);
        };

        // Carrega a foto e desenha tudo
        const finalizar = () => {
            desenharCampos();
            desenharRodape();

            const dataUrl = canvas.toDataURL('image/png');

            try {
                const link = document.createElement('a');
                link.download = '4l-academy-carteirinha.png';
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (dlErr) { console.warn('Download direto falhou:', dlErr); }

            Swal.fire({
                title: 'Carteirinha Pronta! 🪪',
                html: `<img src="${dataUrl}" style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.12);" alt="Carteirinha 4L Academy">
                       <p style="color:#888;font-size:12px;margin:12px 0 0;line-height:1.5;">Se o download não começou sozinho:<br><b style="color:#ccc;">pressione e segure a imagem</b> acima e toque em <b style="color:#ccc;">"Salvar imagem"</b> 💾</p>`,
                background: '#161618',
                color: '#fff',
                confirmButtonColor: '#E53935',
                confirmButtonText: 'Fechar'
            });
        };

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                ctx.save();
                rr(fotoX, fotoY, fotoW, fotoH, 12); ctx.clip();
                // cover: preenche o retângulo sem distorcer
                const escala = Math.max(fotoW / img.width, fotoH / img.height);
                const dw = img.width * escala, dh = img.height * escala;
                ctx.drawImage(img, fotoX + (fotoW - dw) / 2, fotoY + (fotoH - dh) / 2, dw, dh);
                ctx.restore();
                desenharMoldura();
            } catch (drawErr) { desenharFotoFallback(); }
            finalizar();
        };
        img.onerror = () => { desenharFotoFallback(); finalizar(); };
        img.src = d.foto;

    } catch (err) {
        console.error('Erro ao gerar imagem:', err);
        Swal.fire({ icon: 'error', title: 'Erro ao gerar imagem', text: String(err && err.message || err), background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
    }
};
