(function () {
  'use strict';
  var L = window.Logic;
  var STORE = 'anotador-expediciones-v1';
  var COLS = [
    { name: 'Roja', sym: '♥︎' }, { name: 'Naranja', sym: '●' }, { name: 'Amarilla', sym: '■' },
    { name: 'Verde', sym: '▲' }, { name: 'Azul', sym: '✚' }, { name: 'Violeta', sym: '★' }
  ];
  var ART = '🏺', DIE = '🎲', ARROW = '⇧';

  var $ = function (id) { return document.getElementById(id); };
  var state = load();
  var modal = null; // nombre del modal abierto por el usuario (pad, menu, ...) o prompt automático

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.player) return s;
      // Formato anterior (varios jugadores por teléfono): se conserva la hoja que estaba a la vista.
      if (s && s.players && s.players.length) return { player: s.players[s.cur] || s.players[0] };
    } catch (e) { /* estado inválido: se empieza de cero */ }
    return { player: L.newPlayer() };
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* sin almacenamiento */ } }
  function me() { return state.player; }
  function fmt(n) { return n < 0 ? '−' + (-n) : String(n); }
  function rowToGrid(r) { return r >= 7 ? 12 - r : r >= 4 ? 13 - r : 14 - r; }
  function bridgeName(i) { return i < 6 ? 'la expedición ' + COLS[i].name.toLowerCase() + ' ' + COLS[i].sym : i === L.ART_BRIDGE ? 'los artefactos ' + ART : 'los dados ' + DIE; }

  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // ---------- Render ----------
  function render() {
    save();
    renderSheet();
    $('btnUndo').disabled = state.finished || !me().hist.length;
    $('btnPass').disabled = !!state.finished;
    prompts();
  }

  function at(row, col, cls, inner, attrs) {
    return '<div class="' + cls + '" style="grid-row:' + row + ';grid-column:' + col + '"' + (attrs || '') + '>' + (inner || '') + '</div>';
  }
  // El puntaje queda oculto hasta que el jugador da por terminada la partida.
  function scoreBox(row, col, cls, v, attrs, plus) {
    if (!state.finished) return at(row, col, 'scorebox ' + cls, '', attrs);
    return at(row, col, 'scorebox ' + cls + (v < 0 ? ' negv' : v === 0 ? ' zero' : ''), (plus ? '+' : '') + fmt(v), attrs);
  }

  function renderSheet() {
    var p = me(), s = L.score(p), h = '', c, r;

    for (r = 1; r <= 9; r++) {
      h += at(rowToGrid(r), 1, 'lbl' + (L.ROW_PTS[r - 1] < 0 ? ' neg' : ''), fmt(L.ROW_PTS[r - 1]));
      var right = r === 9 ? '100<br>0' : fmt(L.ART_PTS[r - 1]);
      h += at(rowToGrid(r), 11, 'lbl' + (L.ART_PTS[r - 1] < 0 ? ' neg' : ''), right);
      h += at(rowToGrid(r), 9, 'sym art' + (p.art >= r ? ' on' : ''), '<em>' + ART + '</em>', ' data-art="1"');
      h += at(rowToGrid(r), 10, 'sym dice' + (p.dice >= r ? ' on' : ''), '<em>' + DIE + '</em>', ' data-pass="1"');
    }
    h += at(14, 1, 'lbl neg', '−50');

    for (c = 0; c < 6; c++) {
      var col = p.cols[c], n = col.nums.length, gc = c + 2;
      h += scoreBox(1, gc, 'c' + c, s.cols[c], ' data-col="' + c + '"');
      h += at(2, gc, 'endart' + (col.top ? ' on' : ''), ART, ' data-col="' + c + '"');
      for (r = 1; r <= 9; r++) {
        var sp = L.SPECIAL[c][r], mark = sp === 'A' ? ART : sp === 'R' ? ARROW : '';
        var cls = 'cell c' + c, inner;
        if (r <= n) { cls += ' full'; inner = col.nums[r - 1] + (mark ? '<span class="mini">' + mark + '</span>' : ''); }
        else { if (r === n + 1) cls += ' next'; inner = mark ? '<span class="mark' + (sp === 'R' ? ' arrow' : '') + '">' + mark + '</span>' : ''; }
        h += at(rowToGrid(r), gc, cls, inner, ' data-col="' + c + '"');
      }
      h += bridgeCell(p, c, gc);
      var cc = col.circle ? ' on' : n ? ' off' : '';
      h += at(14, gc, 'circle c' + c + cc, '<i>' + (col.circle ? '✕<small>×2</small>' : COLS[c].sym) + '</i>', ' data-col="' + c + '"');
    }
    h += bridgeCell(p, L.ART_BRIDGE, 9) + bridgeCell(p, L.DICE_BRIDGE, 10);

    h += scoreBox(1, 9, '', s.art) + scoreBox(1, 10, '', s.dice) + scoreBox(1, 11, 'small', s.bridges, '', true);
    if (state.finished) h += '<div class="total" style="grid-row:14"><small>' + (s.exhausted ? 'AGOTADO · ' : '') + 'TOTAL</small><b class="' + (s.total < 0 ? 'negv' : '') + '">' + fmt(s.total) + '</b></div>';
    else h += '<button class="total finish" style="grid-row:14" data-finish="1"><small>TERMINAR</small><b>🏁</b></button>';
    $('sheet').innerHTML = h;
  }

  function bridgeCell(p, i, gc) {
    var b = p.bridges[i];
    return at(6, gc, 'bridge' + (b ? ' ' + b : ''), '<i>20</i>', ' data-bridge="' + i + '"');
  }

  // ---------- Modales ----------
  // En la versión web, cada diálogo suma una entrada al historial para que el botón Atrás
  // del teléfono lo cierre en vez de salir de la app. En el APK lo maneja la actividad (onAndroidBack).
  var useHistory = location.protocol !== 'file:', pushed = false;
  function pushModalState() { history.pushState({ modal: true }, ''); pushed = true; }

  function open(name, html, colorIdx) {
    modal = name;
    if (useHistory && !pushed) pushModalState();
    var o = $('overlay');
    o.innerHTML = '<div class="modal' + (colorIdx != null ? ' c' + colorIdx : '') + '">' + html + '</div>';
    o.hidden = false;
  }
  function hideModal() { modal = null; $('overlay').hidden = true; $('overlay').innerHTML = ''; }
  function close() {
    hideModal();
    if (pushed) { pushed = false; history.back(); }
  }
  window.addEventListener('popstate', function () {
    if (!pushed) return; // lo disparó close()
    pushed = false;
    if (isDismissable()) hideModal();
    else if (modal) pushModalState(); // las preguntas de puente y aceleración hay que responderlas
  });

  // Preguntas automáticas que deja pendiente la última anotación: primero puentes, después aceleración.
  function prompts() {
    if (modal && modal !== 'bridge' && modal !== 'accel') return;
    var p = me(), b = L.pendingBridge(p);
    if (b >= 0) return showBridge(b);
    if (p.accel) {
      if (!L.accelOptions(p).length) { L.skipAccel(p); save(); }
      else return showAccel();
    }
    if (modal) close();
  }

  function showBridge(i) {
    open('bridge',
      '<h2>¡Cruzaste el puente de ' + bridgeName(i) + '!</h2>' +
      '<p>Suma 20 puntos solo si fuiste el primero en cruzarlo (o si lo cruzaron varios en este mismo turno).</p>' +
      '<div class="list">' +
      '<button class="opt plain" data-bridge-ans="1" data-i="' + i + '"><span class="s" style="color:var(--gold)">⦿</span><span>Fui el primero<small>+20 puntos</small></span></button>' +
      '<button class="opt plain" data-bridge-ans="0" data-i="' + i + '"><span class="s" style="color:var(--muted)">⊘</span><span>Ya lo había cruzado otro<small>Sin bono</small></span></button>' +
      '</div>', i < 6 ? i : null);
  }

  function showAccel() {
    var p = me(), opts = L.accelOptions(p);
    var h = '<h2>' + ARROW + ' Aceleración</h2><p>Avanzá un casillero en cualquier expedición repitiendo su último número (o un 1 si es nueva).</p><div class="list">';
    opts.forEach(function (o) {
      var extra = [];
      var txt;
      if (o.kind === 'top') { txt = 'Marcar el artefacto final'; extra.push(ART + ' tacha un artefacto'); }
      else {
        txt = 'Escribir ' + o.value + ' en el casillero ' + o.row;
        if (o.row === 1) extra.push('empieza la expedición' + (p.cols[o.c].circle ? ' (×2)' : ''));
        if (o.special === 'A') extra.push(ART + ' artefacto');
        if (o.special === 'R') extra.push(ARROW + ' otra aceleración');
        if (o.bridge) extra.push('cruza el puente');
      }
      h += '<button class="opt c' + o.c + '" data-accel="' + o.c + '"><span class="s">' + COLS[o.c].sym + '</span><span>' + txt +
        (extra.length ? '<small>' + extra.join(' · ') + '</small>' : '') + '</span></button>';
    });
    h += '<button class="opt plain" data-accel="-1"><span class="s"></span><span>No acelerar</span></button></div>';
    open('accel', h);
  }

  function showPad(c) {
    var p = me(), col = p.cols[c], n = col.nums.length, sub;
    if (n === 0) sub = col.circle ? 'Círculo ×2 marcado. Empezá con cualquier número del 1 al 9.' : 'Sin empezar. Con el 0 marcás el círculo de puntos dobles.';
    else if (n < 9) sub = 'Casillero ' + (n + 1) + ' · tiene que ser ' + col.nums[n - 1] + ' o más. El 0 no se puede usar acá.';
    else if (!col.top) sub = 'Expedición completa: con ' + col.nums[8] + ' o más marcás el artefacto final.';
    else sub = 'Expedición completa: no admite más anotaciones.';
    var h = '<h2><span style="color:rgb(var(--c))">' + COLS[c].sym + '</span> Expedición ' + COLS[c].name.toLowerCase() + '</h2><p>' + sub + '</p><div class="pad">';
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(function (d) {
      var o = L.dieOption(p, c, d);
      var small = d === 0 ? '✕ doble' : '';
      h += '<button data-die="' + d + '" data-c="' + c + '"' + (o.ok ? '' : ' disabled') + '>' + d + (small ? '<small>' + small + '</small>' : '') + '</button>';
    });
    h += '</div><div class="row"><button class="btn ghost" data-act="close">Cancelar</button></div>';
    open('pad', h, c);
  }

  function showMenu() {
    open('menu', '<h2>Menú</h2><div class="list">' +
      (state.finished
        ? '<button class="opt plain" data-act="results"><span class="s">🏆</span><span>Resumen de puntaje</span></button>' +
          '<button class="opt plain" data-act="reopen"><span class="s">↺</span><span>Reabrir partida<small>Oculta el puntaje y desbloquea la hoja</small></span></button>'
        : '<button class="opt plain" data-act="finish"><span class="s">🏁</span><span>Terminar partida<small>Muestra el puntaje y bloquea la hoja</small></span></button>') +
      '<button class="opt plain" data-act="rules"><span class="s">📖</span><span>Reglas rápidas</span></button>' +
      '<button class="opt plain" data-act="new"><span class="s">＋</span><span>Nueva partida<small>Borra las hojas actuales</small></span></button>' +
      '<button class="opt plain" data-act="close"><span class="s"></span><span>Cerrar</span></button></div>');
  }

  function showResults() {
    var s = L.score(me());
    var rows = [['Expediciones', s.exp], [ART + ' Artefactos', s.art], [DIE + ' Dados' + (s.exhausted ? ' (agotado)' : ''), s.dice], ['Puentes', s.bridges]];
    var h = '<h2>Resumen de puntaje</h2><table class="res">';
    rows.forEach(function (r) { h += '<tr><td>' + r[0] + '</td><td>' + fmt(r[1]) + '</td></tr>'; });
    h += '<tr class="win"><td>Total</td><td>' + fmt(s.total) + '</td></tr></table>' +
      '<div class="row"><button class="btn ghost" data-act="close">Volver</button><button class="btn gold" data-act="new">Nueva partida</button></div>' +
      '<div class="row"><button class="btn ghost" data-act="reopen">↺ Reabrir partida</button></div>';
    open('results', h);
  }

  function showFinish() {
    open('finish', '<h2>¿Terminar la partida?</h2><p>Se muestra tu puntaje y la hoja queda bloqueada (no se puede anotar, pasar ni deshacer) hasta que la reabras desde el menú.</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">Seguir jugando</button><button class="btn gold" data-act="finished">Terminar</button></div>');
  }

  function showNew() {
    open('new', '<h2>¿Empezar una nueva partida?</h2><p>Se borra la hoja actual y no se puede deshacer.</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn gold" data-act="start">Borrar y empezar</button></div>');
  }

  function showRules() {
    open('rules', '<h2>Reglas rápidas</h2><ol class="rules">' +
      '<li>Tocá una expedición y elegí el número del dado. Se anota de abajo hacia arriba y cada número (1 a 9) tiene que ser igual o mayor que el anterior.</li>' +
      '<li>Un 0 en una expedición sin empezar marca el círculo: esa expedición vale doble (para bien o para mal). Es el único uso del 0: si la expedición ya empezó o ya tiene el círculo, ese 0 no se puede elegir.</li>' +
      '<li>' + ARROW + ' Aceleración: avanzás gratis un casillero en cualquier expedición repitiendo su último número (un 1 si es nueva). Se pueden encadenar.</li>' +
      '<li>' + ART + ' Artefacto: se tacha solo un artefacto de la columna derecha. Con los 9 casilleros llenos, otro número válido marca el artefacto final (una vez por expedición).</li>' +
      '<li>Si no podés o no querés anotar, tocá «Pasar» y se tacha un dado. Con 9 dados tachados quedás agotado: esa columna vale 0, pero seguís jugando.</li>' +
      '<li>Puentes: al llegar al 7.º casillero (o 7.º artefacto o dado) ganás 20 puntos solo si sos el primero. Si otro jugador cruza un puente antes que vos, tocá su 20 para tacharlo y no te va a preguntar cuando llegues. Después de cruzarlo, tocá el 20 para corregirlo.</li>' +
      '<li>El puntaje se ve recién al tocar «Terminar»; después la hoja queda bloqueada, salvo que la reabras desde el menú.</li>' +
      '<li>Puntaje: el casillero más alto de cada expedición da los puntos de la izquierda; los artefactos y dados, los de la derecha.</li>' +
      '<li>La partida termina al final del turno en que todos los jugadores están agotados o se cruzaron los 8 puentes entre todos.</li>' +
      '</ol><div class="row"><button class="btn ghost" data-act="close">Cerrar</button></div>');
  }

  // ---------- Eventos ----------
  function closest(el, attr) { while (el && el !== document.body) { if (el.hasAttribute && el.hasAttribute(attr)) return el; el = el.parentNode; } return null; }

  $('sheet').addEventListener('click', function (e) {
    var el;
    if (state.finished) { toast('La partida terminó. Desde el menú podés reabrirla o empezar una nueva.'); return; }
    if (closest(e.target, 'data-finish')) showFinish();
    else if ((el = closest(e.target, 'data-bridge'))) {
      var i = +el.dataset.bridge, reached = L.bridgeReached(me(), i), b = L.toggleBridge(me(), i);
      if (!b && reached) return;
      render();
      if (!reached) toast(b ? 'Puente de ' + bridgeName(i) + ' tachado: ya lo cruzó otro jugador.' : 'Puente de ' + bridgeName(i) + ' destachado.');
      else toast(b === 'won' ? 'Puente ganado: +20.' : 'Puente sin bono.');
    } else if ((el = closest(e.target, 'data-col'))) showPad(+el.dataset.col);
    else if (closest(e.target, 'data-art')) toast('Los artefactos se tachan solos al anotar en un casillero ' + ART + '.');
    else if (closest(e.target, 'data-pass')) toast('Para tachar un dado usá «Pasar».');
  });

  $('btnUndo').addEventListener('click', function () { if (L.undo(me())) { toast('Deshecho.'); render(); } });
  $('btnMenu').addEventListener('click', showMenu);
  $('btnPass').addEventListener('click', function () {
    var p = me();
    if (L.refuse(p)) toast(p.dice >= 9 ? 'Dado tachado: 9/9, quedaste agotado.' : 'Dado tachado: ' + p.dice + '/9.');
    else toast('Ya estás agotado: pasás sin efecto.');
    render();
  });

  $('overlay').addEventListener('click', function (e) {
    var el, p = me();
    if (e.target === $('overlay')) { if (isDismissable()) close(); return; }
    if ((el = closest(e.target, 'data-die'))) {
      var c = +el.dataset.c, o = L.applyDie(p, c, +el.dataset.die);
      close();
      if (o && o.kind === 'top') toast('Artefacto final marcado.');
      render();
    } else if ((el = closest(e.target, 'data-bridge-ans'))) {
      L.resolveBridge(p, +el.dataset.i, el.dataset.bridgeAns === '1'); render();
    } else if ((el = closest(e.target, 'data-accel'))) {
      var ac = +el.dataset.accel;
      if (ac < 0) L.skipAccel(p); else L.accelerate(p, ac);
      render();
    } else if ((el = closest(e.target, 'data-act'))) {
      var a = el.dataset.act;
      if (a === 'close') close();
      else if (a === 'results') showResults();
      else if (a === 'rules') showRules();
      else if (a === 'new') showNew();
      else if (a === 'finish') showFinish();
      else if (a === 'reopen') { delete state.finished; close(); render(); toast('Partida reabierta: el puntaje vuelve a estar oculto.'); }
      else if (a === 'finished') { state.finished = true; close(); render(); showResults(); }
      else if (a === 'start') { state = { player: L.newPlayer() }; close(); render(); toast('Hoja nueva.'); }
    }
  });

  function isDismissable() { return modal === 'pad' || modal === 'menu' || modal === 'rules' || modal === 'results' || modal === 'new' || modal === 'finish'; }

  // Botón Atrás de Android: cierra el modal abierto si se puede cerrar. Devuelve true si lo manejó.
  window.onAndroidBack = function () {
    if (isDismissable()) { close(); return true; }
    return !!modal; // las preguntas de puente y aceleración hay que responderlas
  };

  // Versión web (iPhone/PWA): funcionar sin conexión y mantener la pantalla encendida.
  // En el APK esto no aplica: la página se carga desde file:// y la actividad ya mantiene la pantalla.
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  function keepAwake() {
    if (navigator.wakeLock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(function () {});
  }
  document.addEventListener('visibilitychange', keepAwake);
  keepAwake();

  render();
})();
