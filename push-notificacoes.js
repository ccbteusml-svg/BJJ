// push-notificacoes.js (v5) — Notificações push do aluno.
// - Corrige "Registration failed - push service error" (inscrição presa com chave antiga)
// - Pergunta automática ao entrar no app (1x por aparelho, com botão de ação)
// Depende de: supabase-config.js (cliente "supabase") e do sw.js registrado.

const PUSH_VAPID_PUBLIC_KEY = 'BO912HKLd3rAnCY1kOL1sberMAbuxmKWhNAsmEMWMHPZx-8RP6yse1KYfqBpa32QqyLtO-FxsVoiVLeCVTMLfFA';

// Converte a chave VAPID (base64url) para o formato que o navegador exige
function _pushUrlBase64ParaUint8(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function _pushSuportado() {
  return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}

function _pushAlerta(titulo, texto, icone) {
  if (window.Swal) {
    Swal.fire({ title: titulo, text: texto, icon: icone, confirmButtonColor: '#B71C1C' });
  } else {
    alert(titulo + '\n\n' + texto);
  }
}

// Atualiza o texto/estado do botao conforme a inscricao atual
async function _pushAtualizarBotao() {
  const btn = document.getElementById('btn-push');
  if (!btn || !_pushSuportado()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      btn.textContent = '🔔 NOTIFICAÇÕES ATIVAS (TOQUE PARA DESATIVAR)';
      btn.dataset.ativo = '1';
    } else {
      btn.textContent = '🔔 ATIVAR NOTIFICAÇÕES';
      btn.dataset.ativo = '0';
    }
  } catch (e) {
    console.warn('[Push] Nao foi possivel verificar inscricao:', e);
  }
}

// Inscreve no serviço de push — com auto-recuperação do erro
// "Registration failed - push service error": acontece quando existe uma
// inscrição velha presa com a chave VAPID anterior. Solução: desinscreve e tenta de novo.
async function _pushInscrever(reg) {
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Já inscrito: confere se a chave é a ATUAL. Se for antiga, refaz.
    try {
      const chaveAtual = _pushUrlBase64ParaUint8(PUSH_VAPID_PUBLIC_KEY);
      const chaveSub = sub.options && sub.options.applicationServerKey
        ? new Uint8Array(sub.options.applicationServerKey) : null;
      const mesmaChave = chaveSub && chaveSub.length === chaveAtual.length
        && chaveSub.every((b, i) => b === chaveAtual[i]);
      if (!mesmaChave) {
        console.warn('[Push] Inscrição com chave antiga detectada — refazendo...');
        await sub.unsubscribe();
        sub = null;
      }
    } catch (eComp) {
      console.warn('[Push] Falha ao comparar chaves, refazendo inscrição:', eComp);
      try { await sub.unsubscribe(); } catch (_) {}
      sub = null;
    }
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _pushUrlBase64ParaUint8(PUSH_VAPID_PUBLIC_KEY)
      });
    } catch (e1) {
      console.warn('[Push] 1ª tentativa falhou (' + (e1.message || e1) + ') — limpando e tentando de novo...');
      try { const velha = await reg.pushManager.getSubscription(); if (velha) await velha.unsubscribe(); } catch (_) {}
      await new Promise(r => setTimeout(r, 800));
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _pushUrlBase64ParaUint8(PUSH_VAPID_PUBLIC_KEY)
      });
    }
  }
  return sub;
}

// Fluxo de ATIVAÇÃO (usado pelo botão e pela pergunta automática)
window.ativarNotificacoes = async function () {
  if (!_pushSuportado()) {
    _pushAlerta('Não suportado', 'Este navegador não suporta notificações push. Abra pelo app instalado.', 'warning');
    return false;
  }

  const reg = await navigator.serviceWorker.ready;

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    _pushAlerta('Permissão negada', 'Para receber cobranças e avisos, libere as notificações nas configurações do navegador/app.', 'warning');
    return false;
  }

  const sub = await _pushInscrever(reg);

  const { data: { user }, error: erroUser } = await supabase.auth.getUser();
  if (erroUser || !user) throw new Error('Usuário não autenticado. Faça login novamente.');

  const json = sub.toJSON();
  const { error: erroInsert } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    }, { onConflict: 'endpoint' });

  if (erroInsert) throw erroInsert;
  return true;
};

// Chamado pelo botao no painel (Ajustes > Aplicativo)
window.toggleNotificacoes = async function () {
  if (!_pushSuportado()) {
    _pushAlerta('Não suportado', 'Este navegador não suporta notificações push. Abra pelo app instalado.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-push');
  const jaAtivo = btn && btn.dataset.ativo === '1';

  try {
    const reg = await navigator.serviceWorker.ready;

    // ---------- DESATIVAR ----------
    if (jaAtivo) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      _pushAlerta('Desativado', 'Você não receberá mais notificações neste aparelho.', 'info');
      await _pushAtualizarBotao();
      return;
    }

    // ---------- ATIVAR ----------
    const ok = await window.ativarNotificacoes();
    if (ok) {
      _pushAlerta('Tudo certo! 🔔', 'Notificações ativadas neste aparelho. Você vai receber lembretes de mensalidade e avisos da academia.', 'success');
    }
    await _pushAtualizarBotao();
  } catch (e) {
    console.error('[Push] Erro ao alternar notificacoes:', e);
    _pushAlerta('Erro', 'Não consegui ativar as notificações: ' + (e.message || e), 'error');
  }
};

// 🔔 PERGUNTA AUTOMÁTICA: ao entrar no app, se o aluno nunca decidiu sobre
// notificações neste aparelho, mostra um convite amigável (1x a cada 7 dias).
async function _pushPerguntaAutomatica() {
  if (!_pushSuportado()) return;
  if (!window.Swal) return;

  try {
    // Só pergunta se: permissão ainda não decidida E sem inscrição ativa
    if (Notification.permission !== 'default') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) return;

    // Respeita o "agora não" por 7 dias
    const ultimoConvite = parseInt(localStorage.getItem('4l_push_convite') || '0');
    if (Date.now() - ultimoConvite < 7 * 24 * 60 * 60 * 1000) return;

    localStorage.setItem('4l_push_convite', String(Date.now()));

    const r = await Swal.fire({
      title: '🔔 Ativar notificações?',
      html: '<p style="color:#aaa;font-size:14px;line-height:1.6;margin:0;">Receba <b style="color:#fff;">lembretes de mensalidade</b> e os <b style="color:#fff;">avisos do mural</b> direto no seu celular.</p>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ativar 🔔',
      cancelButtonText: 'Agora não',
      confirmButtonColor: '#E53935',
      cancelButtonColor: '#333',
      background: '#161618',
      color: '#fff'
    });

    if (r.isConfirmed) {
      try {
        const ok = await window.ativarNotificacoes();
        if (ok) _pushAlerta('Tudo certo! 🔔', 'Notificações ativadas. Você vai receber lembretes e avisos da academia.', 'success');
        await _pushAtualizarBotao();
      } catch (e) {
        console.error('[Push] Erro na ativação automática:', e);
        _pushAlerta('Erro', 'Não consegui ativar: ' + (e.message || e), 'error');
      }
    }
  } catch (e) {
    console.warn('[Push] Pergunta automática falhou (não fatal):', e);
  }
}

// Quando a tela carregar, sincroniza o estado do botao e pergunta se necessário
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_pushAtualizarBotao, 1500);
  // Pergunta depois de 4s — dá tempo da home carregar e não briga com outros popups
  setTimeout(_pushPerguntaAutomatica, 4000);
});
