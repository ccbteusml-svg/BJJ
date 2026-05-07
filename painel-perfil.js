// ==========================================
// 1. CARREGAR AVISOS (MURAL)
// ==========================================
window.carregarAvisos = async function() {
    const lista = document.getElementById('lista-avisos');
    if(!lista) return;
    lista.innerHTML = `<p style="color: #aaaaaa; text-align: center; margin-top: 20px;">Buscando...</p>`;

    const { data: avisos, error } = await window.supabase.from('avisos').select('*');
    
    if (error || !avisos || avisos.length === 0) {
        lista.innerHTML = `
            <div class="card-status" style="padding: 20px; text-align: center;">
                <p style="color: #aaaaaa; margin: 0;">Nenhum aviso no momento. Bom treino!</p>
            </div>`;
        return;
    }

    lista.innerHTML = "";
    for (const aviso of avisos.reverse()) {
        lista.innerHTML += `
            <div class="card-status" style="padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--cor-destaque); text-align: left;">
                <h4 style="color: white; font-size: 16px; margin-bottom: 8px;">${aviso.titulo}</h4>
                <p style="color: #aaaaaa; font-size: 14px; line-height: 1.5; margin: 0;">${aviso.mensagem}</p>
            </div>`;
    }
};

// ==========================================
// 2. GESTÃO DA FOTO DE PERFIL (OTIMIZADA)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const inputFoto = document.getElementById('input-foto');
    if (inputFoto) {
        inputFoto.addEventListener('change', async (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

            try {
                const { data: { session } } = await window.supabase.auth.getSession();
                if (!session) throw new Error("Sessão expirada. Faça login novamente.");
                
                const usuarioId = session.user.id;
                const fileExt = arquivo.name.split('.').pop();
                
                // Nome fixo para substituir a antiga automaticamente (upsert)
                const fileName = `${usuarioId}/perfil.${fileExt}`;

                const { error: uploadError } = await window.supabase.storage
                    .from('fotos_perfil')
                    .upload(fileName, arquivo, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = window.supabase.storage
                    .from('fotos_perfil')
                    .getPublicUrl(fileName);
                
                // Truque do Cache Busting para forçar a atualização visual da foto
                const linkDaFoto = `${publicUrlData.publicUrl}?t=${Date.now()}`;

                const { error: updateError } = await window.supabase
                    .from('perfis')
                    .update({ foto_url: linkDaFoto })
                    .eq('id', usuarioId);
                
                if (updateError) throw updateError;

                const imgElement = document.getElementById('foto-perfil-aluno');
                if (imgElement) imgElement.src = linkDaFoto;
                
                Swal.fire({ icon: 'success', title: 'Foto Atualizada!', background: '#161618', color: '#fff', timer: 2000, showConfirmButton: false });
            } catch (err) {
                console.error("Erro no upload:", err);
                Swal.fire({ icon: 'error', title: 'Falha no Upload', text: err.message, background: '#161618', color: '#fff' });
            }
        });
    }
});

// ==========================================
// 3. GERADOR DA CARTEIRINHA DIGITAL (POP-UP)
// ==========================================
window.abrirCarteirinha = async function() {
    Swal.fire({ title: 'Gerando Carteirinha...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;
        
        const usuarioId = session.user.id;
        const { data: perfil } = await window.supabase.from('perfis').select('*').eq('id', usuarioId).single();
        
        const foto = perfil.foto_url || `https://ui-avatars.com/api/?name=${perfil.nome.replace(/\s/g, '+')}&background=161618&color=fff`;
        const nome = perfil.nome;
        const anoAtual = new Date().getFullYear();
        const idCurto = `4LA-ALU-${usuarioId.substring(0, 6).toUpperCase()}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${usuarioId}`;
        
        let corStatus = "#4CAF50";
        let textoStatus = "✅ MEMBRO ATIVO";
        if (perfil.plano_pausado) { corStatus = "#ff5252"; textoStatus = "🔴 INATIVO"; }
        else if (perfil.assinante) { textoStatus = "✅ VIP (ATIVO)"; }

        let textoFaixaDB = (perfil.faixa || 'Branca').toLowerCase();
        let nomeLimpoFaixa = 'BRANCA';
        let fundoFaixaVisual = '#f4f4f4'; 
        let corPontaFaixa = '#111111';
        let corBorda = '#dddddd'; 
        let corSombra = 'rgba(255, 255, 255, 0.2)';
        
        if (textoFaixaDB.includes('cinza')) { 
            nomeLimpoFaixa = 'CINZA'; fundoFaixaVisual = '#9E9E9E'; corBorda = '#9E9E9E'; corSombra = 'rgba(158, 158, 158, 0.4)';
        } else if (textoFaixaDB.includes('amarela')) { 
            nomeLimpoFaixa = 'AMARELA'; fundoFaixaVisual = '#FBC02D'; corBorda = '#FBC02D'; corSombra = 'rgba(251, 192, 45, 0.4)';
        } else if (textoFaixaDB.includes('laranja')) { 
            nomeLimpoFaixa = 'LARANJA'; fundoFaixaVisual = '#FF9800'; corBorda = '#FF9800'; corSombra = 'rgba(255, 152, 0, 0.4)';
        } else if (textoFaixaDB.includes('verde')) { 
            nomeLimpoFaixa = 'VERDE'; fundoFaixaVisual = '#4CAF50'; corBorda = '#4CAF50'; corSombra = 'rgba(76, 175, 80, 0.4)';
        } else if (textoFaixaDB.includes('azul')) { 
            nomeLimpoFaixa = 'AZUL'; fundoFaixaVisual = '#1976D2'; corBorda = '#1976D2'; corSombra = 'rgba(25, 118, 210, 0.4)';
        } else if (textoFaixaDB.includes('roxa')) { 
            nomeLimpoFaixa = 'ROXA'; fundoFaixaVisual = '#6a1b9a'; corBorda = '#ab47bc'; corSombra = 'rgba(171, 71, 188, 0.4)';
        } else if (textoFaixaDB.includes('marrom')) { 
            nomeLimpoFaixa = 'MARROM'; fundoFaixaVisual = '#5D4037'; corBorda = '#8d6e63'; corSombra = 'rgba(141, 110, 99, 0.4)';
        } else if (textoFaixaDB.includes('preta')) { 
            nomeLimpoFaixa = 'PRETA'; fundoFaixaVisual = '#212121'; corPontaFaixa = '#D32F2F'; corBorda = '#666666'; corSombra = 'rgba(255, 255, 255, 0.15)';
        } else if (textoFaixaDB.includes('coral')) { 
            nomeLimpoFaixa = 'CORAL'; fundoFaixaVisual = 'repeating-linear-gradient(to right, #D32F2F 0, #D32F2F 15px, #111111 15px, #111111 30px)'; corBorda = '#D32F2F'; corSombra = 'rgba(211, 47, 47, 0.4)';
        } else if (textoFaixaDB.includes('vermelha')) { 
            nomeLimpoFaixa = 'VERMELHA'; fundoFaixaVisual = '#D32F2F'; corBorda = '#D32F2F'; corSombra = 'rgba(211, 47, 47, 0.4)';
        }

        let qtdGraus = 0;
        let matchGrau = textoFaixaDB.match(/(\d+)/); 
        if (matchGrau) { qtdGraus = parseInt(matchGrau[1]); }
        let grausVisuais = qtdGraus > 6 ? 6 : qtdGraus; 

        let htmlGraus = '';
        for(let i=0; i<grausVisuais; i++) {
            htmlGraus += `<div style="width: 4px; height: 100%; background-color: #fff; border-radius: 1px;"></div>`;
        }

        const textoFinalFaixa = `FAIXA ${nomeLimpoFaixa}` + (qtdGraus > 0 ? ` - ${qtdGraus}º GRAU` : '');

        const htmlCarteirinha = `
            <div class="carteirinha-container" style="border: 2px solid ${corBorda}; box-shadow: 0 0 30px ${corSombra};">
                <div class="carteirinha-header">
                    <h2>4L <span style="color: ${corBorda};">ACADEMY</span></h2>
                    <p>CARTEIRINHA DIGITAL DO ATLETA</p>
                </div>
                <div class="carteirinha-foto-wrapper" style="border: 3px solid ${corBorda};">
                    <img src="${foto}">
                </div>
                <div class="carteirinha-info">
                    <p>NOME:</p>
                    <h3>${nome}</h3>
                    <p>CLASSIFICAÇÃO:</p>
                    <h3 style="font-size: 14px; margin-bottom: 15px;">ATLETA OFICIAL</h3>
                    <div style="margin-top: 15px; display: flex; flex-direction: column; align-items: center;">
                        <div style="position: relative; width: 90%; height: 35px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                            <div style="position: absolute; left: calc(50% - 15px); top: 18px; width: 16px; height: 28px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 0 0 3px 3px; z-index: 1; transform: rotate(25deg); transform-origin: top center; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2);"></div>
                            <div style="position: absolute; right: calc(50% - 15px); top: 18px; width: 16px; height: 34px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 0 0 3px 3px; z-index: 1; transform: rotate(-20deg); transform-origin: top center; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2);"></div>
                            <div style="flex: 1; height: 20px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-right: none; border-radius: 4px 0 0 4px; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2); z-index: 2;"></div>
                            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 36px; height: 26px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-radius: 4px; z-index: 3; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2), 0 3px 5px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; overflow: hidden;">
                                <div style="width: 14px; height: 150%; background: ${fundoFaixaVisual}; border-left: 2px solid rgba(0,0,0,0.8); border-right: 2px solid rgba(0,0,0,0.8); transform: rotate(15deg); box-shadow: inset 0 -2px 3px rgba(0,0,0,0.1);"></div>
                            </div>
                            <div style="flex: 1; height: 20px; background: ${fundoFaixaVisual}; border: 2px solid rgba(0,0,0,0.8); border-left: none; border-radius: 0 4px 4px 0; display: flex; justify-content: flex-end; box-shadow: inset 0 -2px 3px rgba(0,0,0,0.2); overflow: hidden; z-index: 2;">
                                <div style="width: 55px; height: 100%; background-color: ${corPontaFaixa}; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; gap: 3px; border-left: 2px solid rgba(0,0,0,0.8);">
                                    ${htmlGraus}
                                </div>
                            </div>
                        </div>
                        <p style="color: #ccc; font-size: 11px; margin-top: 8px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">${textoFinalFaixa}</p>
                    </div>
                </div>
                <div class="carteirinha-qr">
                    <img src="${qrCodeUrl}" style="width: 100%; height: auto; display: block;">
                    <p style="color: #000; font-size: 9px; font-weight: bold; margin: 5px 0 0 0;">QR ÚNICO PARA CHECK-IN</p>
                </div>
                <div class="carteirinha-footer">
                    <p style="margin:0;">STATUS: <span style="color: ${corStatus}; font-weight: bold;">${textoStatus}</span></p>
                    <p style="margin:0;">VÁLIDA ATÉ: <span style="color: white; font-weight: bold;">31/12/${anoAtual}</span></p>
                    <p style="margin:0;">ID ÚNICO: <span style="color: white; font-weight: bold;">${idCurto}</span></p>
                </div>
            </div>
        `;

        Swal.fire({
            html: htmlCarteirinha,
            background: 'transparent',
            showConfirmButton: false,
            showCloseButton: true,
            padding: '0',
            width: '320px'
        });
        
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível gerar a carteirinha.', background: '#161618', color: '#fff' });
    }
};