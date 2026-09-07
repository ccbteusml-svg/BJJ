// push-notificacoes.js — Ativa/desativa notificacoes push no celular do aluno.
// Depende de: supabase-config.js (cliente "supabase") e do sw.js registrado.

const PUSH_VAPID_PUBLIC_KEY = 'BEEUGELCz7RKv87oYERLOnwMiTiLJApZalGzr6Oz1qT1v0JBDGTtyS13Qc5khWHsw0PPQAlDFpTM0px8S85ZTJ0';

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
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      _pushAlerta('Permissão negada', 'Para receber cobranças e avisos, libere as notificações nas configurações do navegador/app.', 'warning');
      return;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _pushUrlBase64ParaUint8(PUSH_VAPID_PUBLIC_KEY)
      });
    }

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

    _pushAlerta('Tudo certo! 🔔', 'Notificações ativadas neste aparelho. Você vai receber lembretes de mensalidade e avisos da academia.', 'success');
    await _pushAtualizarBotao();
  } catch (e) {
    console.error('[Push] Erro ao alternar notificacoes:', e);
    _pushAlerta('Erro', 'Não consegui ativar as notificações: ' + (e.message || e), 'error');
  }
};

// Quando a tela carregar, sincroniza o estado do botao
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_pushAtualizarBotao, 1500);
});
