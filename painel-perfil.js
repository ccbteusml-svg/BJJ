// ==========================================
// 1. CARREGAR AVISOS (MURAL)
// ==========================================
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = (str) => {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
}

window.carregarAvisos = async function() {
    const lista = document.getElementById('lista-avisos');
    if(!lista) return;
    lista.innerHTML = '';
    const msgBusca = document.createElement('p');
    msgBusca.style.cssText = 'color: #aaaaaa; text-align: center; margin-top: 20px;';
    msgBusca.textContent = 'Buscando...';
    lista.appendChild(msgBusca);

    const { data: avisos, error } = await window.supabase.from('avisos').select('*');

    if (error || !avisos || avisos.length === 0) {
        lista.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding: 20px; text-align: center;';
        const p = document.createElement('p');
        p.style.cssText = 'color: #aaaaaa; margin: 0;';
        p.textContent = 'Nenhum aviso no momento. Bom treino!';
        card.appendChild(p);
        lista.appendChild(card);
        return;
    }

    lista.innerHTML = '';
    // CORREÇÃO: usa slice() para não modificar o array original
    for (const aviso of avisos.slice().reverse()) {
        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding: 20px; margin-bottom: 15px; border-left: 4px solid var(--cor-destaque); text-align: left;';

        const h4 = document.createElement('h4');
        h4.style.cssText = 'color: white; font-size: 16px; margin-bottom: 8px;';
        h4.textContent = aviso.titulo || '';
        card.appendChild(h4);

        const p = document.createElement('p');
        p.style.cssText = 'color: #aaaaaa; font-size: 14px; line-height: 1.5; margin: 0;';
        p.textContent = aviso.mensagem || '';
        card.appendChild(p);

        lista.appendChild(card);
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

            // Validação: tipo de arquivo
            const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!tiposPermitidos.includes(arquivo.type)) {
                Swal.fire({ icon: 'warning', title: 'Formato inválido', text: 'Envie uma imagem JPG, PNG ou WEBP.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                return;
            }
            // Validação: tamanho máximo 5MB
            if (arquivo.size > 5 * 1024 * 1024) {
                Swal.fire({ icon: 'warning', title: 'Arquivo muito grande', text: 'O limite é 5MB.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
                return;
            }

            Swal.fire({ title: 'Enviando foto...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

            try {
                const { data: { session } } = await window.supabase.auth.getSession();
                if (!session) throw new Error("Sessão expirada. Faça login novamente.");

                const usuarioId = session.user.id;
                // CORREÇÃO: usa extensão fixa .jpg para evitar arquivos duplicados com extensões diferentes
                const fileName = `${usuarioId}/perfil.jpg`;

                const { error: uploadError } = await window.supabase.storage
                    .from('fotos_perfil')
                    .upload(fileName, arquivo, { upsert: true, contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = window.supabase.storage
                    .from('fotos_perfil')
                    .getPublicUrl(fileName);

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
// 3. GERADOR DA CARTEIRINHA DIGITAL (VERSÃO LITE)
// ==========================================
window.abrirCarteirinha = async function() {
    Swal.fire({ title: 'Gerando Carteirinha...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const usuarioId = session.user.id;
        const { data: perfil } = await window.supabase.from('perfis').select('*').eq('id', usuarioId).single();
        if (!perfil) throw new Error("Perfil não encontrado");

        const foto = perfil.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nome)}&background=161618&color=fff`;
        const nome = perfil.nome;
        const anoAtual = new Date().getFullYear();

        let corStatus = "#4CAF50";
        let textoStatus = "✅ MEMBRO ATIVO";
        if (perfil.plano_pausado) { corStatus = "#ff5252"; textoStatus = "🔴 INATIVO"; }

        let textoFaixaDB = (perfil.faixa || 'Branca').toLowerCase();
        let corBorda = '#E53935';

        if (textoFaixaDB.includes('branca')) corBorda = '#f5f5f5';
        else if (textoFaixaDB.includes('cinza')) corBorda = '#9E9E9E';
        else if (textoFaixaDB.includes('amarela')) corBorda = '#FBC02D';
        else if (textoFaixaDB.includes('laranja')) corBorda = '#FF9800';
        else if (textoFaixaDB.includes('verde')) corBorda = '#4CAF50';
        else if (textoFaixaDB.includes('azul')) corBorda = '#1976D2';
        else if (textoFaixaDB.includes('roxa')) corBorda = '#ab47bc';
        else if (textoFaixaDB.includes('marrom')) corBorda = '#8d6e63';
        else if (textoFaixaDB.includes('preta')) corBorda = '#ffffff';
        else if (textoFaixaDB.includes('coral') || textoFaixaDB.includes('vermelha')) corBorda = '#D32F2F';

        let qtdGraus = 0;
        let matchGrau = textoFaixaDB.match(/(\d+)/); 
        if (matchGrau) { qtdGraus = parseInt(matchGrau[1]); }

        let textoFaixa = (perfil.faixa || 'Branca').toUpperCase();

        // CORREÇÃO: adiciona barrinhas de grau visualmente se houver
        let grausHtml = '';
        if (qtdGraus > 0) {
            grausHtml = `<div style="display:flex;gap:4px;justify-content:center;margin-top:6px;">${Array(qtdGraus).fill('<span style="width:8px;height:8px;background:#fff;border-radius:50%;display:inline-block;"></span>').join('')}</div>`;
        }

        // Dados escapados para uso seguro no template
        const safeNome = escapeHtml(nome);
        const safeTextoFaixa = escapeHtml(textoFaixa);

        const htmlCarteirinha = `
            <div style="background: linear-gradient(135deg, #111 0%, #000 100%); border-radius: 16px; padding: 30px 20px; text-align: center; position: relative; overflow: hidden; border: 1px solid ${corBorda}; box-shadow: 0 0 30px ${corBorda}33;">

                <div style="margin-bottom: 20px;">
                    <h2 style="font-style: italic; font-size: 20px; margin: 0; color: white; font-weight: 900;">4L <span style="color: ${corBorda};">ACADEMY</span></h2>
                    <p style="font-size: 9px; color: #888; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase;">Carteirinha do Atleta</p>
                </div>

                <div style="position: relative; width: 110px; height: 110px; margin: 0 auto 20px;">
                    <img src="${foto}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid ${corBorda}; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                </div>

                <div style="margin-bottom: 20px;">
                    <p style="font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">NOME</p>
                    <h3 style="color: white; font-weight: 800; text-transform: uppercase; margin: 0; font-size: 16px;">${safeNome}</h3>
                </div>

                <div style="margin-bottom: 10px;">
                    <p style="font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">FAIXA / GRAU</p>
                    <h3 style="color: ${corBorda}; font-weight: 800; text-transform: uppercase; margin: 0; font-size: 14px; letter-spacing: 1px;">🥋 ${safeTextoFaixa}</h3>
                    ${grausHtml}
                </div>

                <div style="background: rgba(255,255,255,0.03); border-radius: 10px; padding: 12px; margin-bottom: 15px;">
                    <p style="margin: 0; font-size: 11px; color: #aaa;">STATUS: <span style="color: ${corStatus}; font-weight: bold;">${textoStatus}</span></p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #aaa;">VÍNCULO: <span style="color: white; font-weight: bold;">${anoAtual}</span></p>
                </div>

                <p style="font-size: 9px; color: #555; margin: 15px 0 0; letter-spacing: 0.5px;">4L Academy — Brazilian Jiu-Jitsu</p>
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
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível gerar a carteirinha.', background: '#161618', color: '#fff' });
    }
};
