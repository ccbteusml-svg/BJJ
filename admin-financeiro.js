// ==========================================
// 1. CARREGAR DASHBOARD E PENDENTES
// ==========================================
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = (str) => {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
}

window.renderizarPendentes = function(mensalidades, todosAlunos) {
    const lista = document.getElementById('lista-pendentes');
    const txtRecebido = document.getElementById('total-recebido');
    const txtPendente = document.getElementById('total-pendente');
    const txtPrevisao = document.getElementById('total-previsao');
    const txtAlunosCount = document.getElementById('total-alunos-count');

    if (!lista) return;

    let totalPago = 0;
    let totalEmAberto = 0;

    (mensalidades || []).forEach(m => {
        let valor = parseFloat(m.valor) || 0;
        if (m.status.toLowerCase().trim() === 'pago') totalPago += valor;
        else totalEmAberto += valor;
    });

    if (txtRecebido) txtRecebido.innerText = `R$ ${totalPago},00`;
    if (txtPendente) txtPendente.innerText = `R$ ${totalEmAberto},00`;
    if (txtPrevisao) txtPrevisao.innerText = `R$ ${totalPago + totalEmAberto},00`;
    if (txtAlunosCount) txtAlunosCount.innerText = (todosAlunos || []).filter(a => a.plano_pausado !== true).length;

    const pendentes = (mensalidades || []).filter(m => m.status.toLowerCase().trim() === 'pendente');

    if (pendentes.length === 0) {
        lista.innerHTML = '';
        const msg = document.createElement('p');
        msg.style.cssText = 'color: #4CAF50; text-align: center; margin-top: 20px;';
        msg.textContent = '✅ Tudo em dia!';
        lista.appendChild(msg);
        return;
    }

    lista.innerHTML = "";
    for (const mens of pendentes) {
        const aluno = (todosAlunos || []).find(a => a.id === mens.aluno_id);
        if (aluno && aluno.plano_pausado === true) continue;

        const nome = aluno ? aluno.nome : "Desconhecido";
        const tel = aluno ? aluno.telefone : "";

        const card = document.createElement('div');
        card.className = 'card-status';
        card.style.cssText = 'padding: 16px; margin-bottom: 15px; border-left: 4px solid #ff5252; background: #1a1a1c; border-radius: 10px;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';

        const info = document.createElement('div');

        const pNome = document.createElement('p');
        pNome.style.cssText = 'color: white; font-weight: 800; font-size: 16px; margin: 0 0 4px 0;';
        pNome.textContent = nome;
        info.appendChild(pNome);

        const pMes = document.createElement('p');
        pMes.style.cssText = 'color: #888; font-size: 12px; margin: 0; text-transform: uppercase;';
        pMes.innerHTML = `${escapeHtml(mens.mes)} &bull; <strong style="color: #ff5252; font-size: 13px;">R$ ${mens.valor}</strong>`;
        info.appendChild(pMes);

        header.appendChild(info);

        const btnDel = document.createElement('button');
        btnDel.style.cssText = 'background: rgba(255, 82, 82, 0.1); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer;';
        btnDel.textContent = '🗑️';
        btnDel.onclick = () => cancelarCobranca(mens.id);
        header.appendChild(btnDel);

        card.appendChild(header);

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 10px;';

        const btnBaixa = document.createElement('button');
        btnBaixa.style.cssText = 'flex: 2; background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; color: #4CAF50; padding: 12px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; cursor: pointer;';
        btnBaixa.textContent = '✅ Dar Baixa';
        btnBaixa.onclick = () => darBaixa(mens.id);
        actions.appendChild(btnBaixa);

        const btnZap = document.createElement('button');
        btnZap.style.cssText = 'flex: 1; background: #25D366; border: none; color: #000; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 900; text-transform: uppercase; display: flex; justify-content: center; align-items: center; gap: 6px; cursor: pointer;';
        btnZap.textContent = '💬 Zap';
        btnZap.onclick = () => cobrarNoZap(tel, nome, mens.mes, mens.valor);
        actions.appendChild(btnZap);

        card.appendChild(actions);
        lista.appendChild(card);
    }
};

// ==========================================
// 2. AÇÕES DE COBRANÇA INDIVIDUAL
// ==========================================
window.cobrarNoZap = function(telefone, nome, mes, valor) {
    if(!telefone || telefone.length < 10) { 
        Swal.fire({ icon: 'error', title: 'Inválido', text: 'Sem WhatsApp cadastrado.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
        return; 
    }
    const numeroLimpo = telefone.replace(/\D/g, '');
    const mensagem = `Olá, *${nome}*! Oss! 🥋

Passando para lembrar da sua mensalidade de *${mes}* na 4L Academy.

💰 *Valor:* R$ ${valor},00

📱 *Pague no App:* https://ccbteusml-svg.github.io/?modo=app

_Ou Pix (Celular):_ *92985589868*

Nos vemos no tatame!`;
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
};

window.cancelarCobranca = async function(id) {
    const result = await Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff' });
    if(result.isConfirmed) { 
        await supabase.from('mensalidades').delete().eq('id', id); 
        if(typeof iniciarPainelAdmin === 'function') iniciarPainelAdmin(); 
    }
};


window.darBaixa = async function(id) {
    const result = await Swal.fire({ title: 'Recebido?', icon: 'question', showCancelButton: true, confirmButtonColor: '#4CAF50', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff' });
    if(result.isConfirmed) { 
        await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id); 
        if(typeof iniciarPainelAdmin === 'function') iniciarPainelAdmin(); 
    }
};


// ==========================================
// 3. GERAR MENSALIDADES E ROBÔ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const btnGerarMes = document.getElementById('btn-gerar-mes');
    if (btnGerarMes) {
        btnGerarMes.addEventListener('click', async () => {
            let mesBruto = document.getElementById('mes-geral').value.trim();
            const valorPadrao = document.getElementById('valor-geral').value;

            if (!mesBruto || mesBruto.length < 3) {
                Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe um mês válido.', background: '#161618', color: '#fff' }); return;
            }
            if (!valorPadrao || isNaN(parseFloat(valorPadrao)) || parseFloat(valorPadrao) <= 0) {
                Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe um valor válido maior que zero.', background: '#161618', color: '#fff' }); return;
            }

            let mes = mesBruto.replace(/\s+/g, '');
            mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();

            Swal.fire({ title: 'Verificando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

            try {
                // ✅ CORRIGIDO: Busca todos os alunos e filtra no JS (inclui assinante=null)
                const { data: alunosManuais } = await supabase.from('perfis').select('id, valor_mensalidade, plano_pausado, assinante').neq('cargo', 'professor'); 
                const alunosAtivos = (alunosManuais || []).filter(aluno => aluno.plano_pausado !== true && !aluno.assinante);

                if (alunosAtivos.length === 0) {
                    Swal.fire({ icon: 'info', title: 'Vazio', text: 'Nenhum aluno ativo sem VIP.', background: '#161618', color: '#fff' }); return;
                }

                const { data: mensalidadesExistentes } = await supabase.from('mensalidades').select('aluno_id').eq('mes', mes);
                const alunosJaCobrados = new Set((mensalidadesExistentes || []).map(m => m.aluno_id));
                const alunosParaCobrar = alunosAtivos.filter(aluno => !alunosJaCobrados.has(aluno.id));

                if (alunosParaCobrar.length === 0) {
                    Swal.fire({ icon: 'info', title: 'Tudo Certo!', text: `Todos já cobrados em ${mes}.`, background: '#161618', color: '#fff' }); return;
                }

                const cobrancas = alunosParaCobrar.map(aluno => ({
                    aluno_id: aluno.id, mes: mes, valor: aluno.valor_mensalidade || parseFloat(valorPadrao), status: 'pendente'
                }));

                await supabase.from('mensalidades').insert(cobrancas);
                Swal.fire({ icon: 'success', title: 'Geradas!', text: `${cobrancas.length} cobranças.`, background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
                document.getElementById('mes-geral').value = '';
                if(typeof iniciarPainelAdmin === 'function') iniciarPainelAdmin();

            } catch (err) { Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' }); }
        });
    }

    const btnRobo = document.getElementById('btn-disparar-robos');
    if(btnRobo) {
        btnRobo.addEventListener('click', async (e) => {
            const btn = e.target; btn.innerText = "⏳ Disparando..."; btn.disabled = true;
            try {
                const { data, error } = await supabase.functions.invoke('robo-financeiro');

                if (error) throw error;

                Swal.fire({ 
                    icon: 'info', 
                    title: 'Aviso do Robô', 
                    text: data.message || 'Comando executado.', 
                    background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' 
                });

            } catch (err) {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Deu erro no Robô!', 
                    text: err.message, 
                    background: '#161618', color: '#fff', confirmButtonColor: '#E53935' 
                });
            } finally {
                btn.innerText = "🤖 FORÇAR DISPARO DE AVISOS"; btn.disabled = false;
            }
        });
    }
});