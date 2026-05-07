// ==========================================
// 1. CARREGAR DASHBOARD E PENDENTES
// ==========================================
window.carregarPendentes = async function() {
    if (typeof carregarAniversariantes === 'function') carregarAniversariantes(); 
    
    const lista = document.getElementById('lista-pendentes');
    const txtRecebido = document.getElementById('total-recebido');
    const txtPendente = document.getElementById('total-pendente');
    const txtPrevisao = document.getElementById('total-previsao');
    const txtAlunosCount = document.getElementById('total-alunos-count');
    
    if(!lista) return;

    lista.innerHTML = `
        <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid #333;"><div style="display: flex; justify-content: space-between; margin-bottom: 15px;"><div class="skeleton" style="width: 140px; height: 18px;"></div><div class="skeleton" style="width: 25px; height: 18px;"></div></div><div style="display: flex; gap: 8px;"><div class="skeleton" style="flex: 2; height: 32px; border-radius: 6px;"></div><div class="skeleton" style="flex: 1; height: 32px; border-radius: 6px;"></div></div></div>
        <div class="card-status" style="padding: 15px; margin-bottom: 12px; border-left: 4px solid #333;"><div style="display: flex; justify-content: space-between; margin-bottom: 15px;"><div class="skeleton" style="width: 110px; height: 18px;"></div><div class="skeleton" style="width: 25px; height: 18px;"></div></div><div style="display: flex; gap: 8px;"><div class="skeleton" style="flex: 2; height: 32px; border-radius: 6px;"></div><div class="skeleton" style="flex: 1; height: 32px; border-radius: 6px;"></div></div></div>
    `;

    try {
        const { data: mensalidades } = await supabase.from('mensalidades').select('*');
        const { data: todosAlunos } = await supabase.from('perfis').select('id, nome, telefone, plano_pausado, cargo').neq('cargo', 'professor');

        let totalPago = 0; let totalEmAberto = 0;
        
        (mensalidades || []).forEach(m => {
            let valor = parseFloat(m.valor) || 0;
            if (m.status.toLowerCase().trim() === 'pago') totalPago += valor;
            else totalEmAberto += valor;
        });

        if(txtRecebido) txtRecebido.innerText = `R$ ${totalPago},00`;
        if(txtPendente) txtPendente.innerText = `R$ ${totalEmAberto},00`;
        if(txtPrevisao) txtPrevisao.innerText = `R$ ${totalPago + totalEmAberto},00`;
        if(txtAlunosCount) txtAlunosCount.innerText = (todosAlunos || []).filter(a => a.plano_pausado !== true).length;

        const pendentes = (mensalidades || []).filter(m => m.status.toLowerCase().trim() === 'pendente');
        
        if (pendentes.length === 0) {
            lista.innerHTML = `<p style="color: #4CAF50; text-align: center; margin-top: 20px;">✅ Tudo em dia!</p>`;
            return;
        }

        lista.innerHTML = ""; 
        for (const mens of pendentes) {
            const aluno = (todosAlunos || []).find(a => a.id === mens.aluno_id);
            if (aluno && aluno.plano_pausado === true) continue;

            const nome = aluno ? aluno.nome : "Desconhecido";
            const tel = aluno ? aluno.telefone : "";
            
            lista.innerHTML += `
            <div class="card-status" style="padding: 16px; margin-bottom: 15px; border-left: 4px solid #ff5252; background: #1a1a1c; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <p style="color: white; font-weight: 800; font-size: 16px; margin: 0 0 4px 0;">${nome}</p>
                        <p style="color: #888; font-size: 12px; margin: 0; text-transform: uppercase;">${mens.mes} &bull; <strong style="color: #ff5252; font-size: 13px;">R$ ${mens.valor}</strong></p>
                    </div>
                    <button onclick="cancelarCobranca('${mens.id}')" style="background: rgba(255, 82, 82, 0.1); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer;">🗑️</button>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="darBaixa('${mens.id}')" style="flex: 2; background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; color: #4CAF50; padding: 12px; border-radius: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; cursor: pointer;">✅ Dar Baixa</button>
                    <button onclick="cobrarNoZap('${tel}', '${nome}', '${mens.mes}', '${mens.valor}')" style="flex: 1; background: #25D366; border: none; color: #000; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 900; text-transform: uppercase; display: flex; justify-content: center; align-items: center; gap: 6px; cursor: pointer;">💬 Zap</button>
                </div>
            </div>`;
        }
    } catch (err) { lista.innerHTML = `<p style="color: #ff5252; text-align: center;">Erro ao buscar dados.</p>`; }
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
    const mensagem = `Olá, *${nome}*! Oss! 🥋\n\nPassando para lembrar da sua mensalidade de *${mes}* na 4L Academy.\n\n💰 *Valor:* R$ ${valor},00\n\n📱 *Pague no App:* https://ccbteusml-svg.github.io/?modo=app\n\n_Ou Pix (Celular):_ *92985589868*\n\nNos vemos no tatame!`;
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
};

window.cancelarCobranca = async function(id) {
    const result = await Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#E53935', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff' });
    if(result.isConfirmed) { await supabase.from('mensalidades').delete().eq('id', id); carregarPendentes(); }
};

window.darBaixa = async function(id) {
    const result = await Swal.fire({ title: 'Recebido?', icon: 'question', showCancelButton: true, confirmButtonColor: '#4CAF50', cancelButtonColor: '#333', confirmButtonText: 'Sim', cancelButtonText: 'Não', background: '#161618', color: '#fff' });
    if(result.isConfirmed) { await supabase.from('mensalidades').update({ status: 'pago' }).eq('id', id); carregarPendentes(); }
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
            
            if (!mesBruto || !valorPadrao) {
                Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Preencha o Mês e o Valor.', background: '#161618', color: '#fff' }); return;
            }
            
            let mes = mesBruto.replace(/\s+/g, '');
            mes = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
            
            Swal.fire({ title: 'Verificando...', background: '#161618', color: '#fff', didOpen: () => { Swal.showLoading() } });

            try {
                const { data: alunosManuais } = await supabase.from('perfis').select('id, valor_mensalidade, plano_pausado').neq('cargo', 'professor').eq('assinante', false); 
                const alunosAtivos = (alunosManuais || []).filter(aluno => aluno.plano_pausado !== true);

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
                Swal.fire({ icon: 'success', title: 'Geradas!', text: `${alunosParaCobrar.length} cobranças.`, background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
                document.getElementById('mes-geral').value = '';
                carregarPendentes(); 

            } catch (err) { Swal.fire({ icon: 'error', title: 'Erro', text: err.message, background: '#161618', color: '#fff' }); }
        });
    }

    const btnRobo = document.getElementById('btn-disparar-robos');
    if(btnRobo) {
        btnRobo.addEventListener('click', async (e) => {
            const btn = e.target; btn.innerText = "⏳ Disparando..."; btn.disabled = true;
            try {
                await supabase.functions.invoke('robo-cobranca');
                Swal.fire({ icon: 'success', title: 'Enviado!', text: 'Cobranças disparadas.', background: '#161618', color: '#fff', confirmButtonColor: '#4CAF50' });
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Falhou!', text: 'Erro ao enviar avisos.', background: '#161618', color: '#fff', confirmButtonColor: '#E53935' });
            } finally {
                btn.innerText = "🤖 FORÇAR DISPARO DE AVISOS"; btn.disabled = false;
            }
        });
    }
});
