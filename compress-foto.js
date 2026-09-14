/* ============================================================
   4L ACADEMY — Compressor de fotos (v1)
   Comprime a foto NO PRÓPRIO CELULAR antes de enviar:
   - Redimensiona para no máximo 800px no maior lado
     (foto de perfil não precisa mais que isso)
   - Ajusta a qualidade JPEG até o arquivo ficar ≤ ~280KB
     (resultado típico: 100KB a 300KB)
   Uso:   const fotoLeve = await window.comprimirFoto(arquivo);
   ============================================================ */
window.comprimirFoto = function (file, opcoes) {
    opcoes = opcoes || {};
    var DIM_MAX = opcoes.maxDim || 800;      // px no maior lado
    var ALVO_KB = opcoes.alvoKB || 280;      // teto de tamanho
    var Q_INICIAL = 0.82;                    // qualidade inicial
    var Q_MINIMA = 0.35;                     // nunca passa disso

    return new Promise(function (resolve, reject) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            return reject(new Error('O arquivo escolhido não é uma imagem.'));
        }
        var url = URL.createObjectURL(file);
        var img = new Image();

        img.onload = function () {
            try {
                var w = img.naturalWidth, h = img.naturalHeight;
                var escala = Math.min(1, DIM_MAX / Math.max(w, h));
                w = Math.max(1, Math.round(w * escala));
                h = Math.max(1, Math.round(h * escala));

                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);

                var q = Q_INICIAL;
                (function tentar() {
                    canvas.toBlob(function (blob) {
                        if (!blob) return reject(new Error('Falha ao comprimir a imagem.'));
                        var kb = blob.size / 1024;
                        if (kb <= ALVO_KB || q <= Q_MINIMA) {
                            var nomeJpg = (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg';
                            var novoArquivo = new File([blob], nomeJpg, { type: 'image/jpeg' });
                            console.log('[compress-foto]', Math.round(file.size / 1024) + 'KB → ' + Math.round(kb) + 'KB (' + w + 'x' + h + ')');
                            resolve(novoArquivo);
                        } else {
                            q = Math.max(Q_MINIMA, q - 0.12);
                            tentar();
                        }
                    }, 'image/jpeg', q);
                })();
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };

        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error('Não foi possível ler esta imagem.'));
        };

        img.src = url;
    });
};
