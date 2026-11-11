// Reglas y puntaje de la hoja. Sin dependencias de DOM para poder testearlo con node.
(function (root) {
  'use strict';

  // Puntos de una expedición según el casillero más alto escrito (1..9, de abajo hacia arriba).
  var ROW_PTS = [-20, -15, -10, 5, 10, 15, 30, 35, 50];
  // Puntos de las columnas de artefactos y de dados según cuántos símbolos hay tachados.
  var ART_PTS = [-40, -30, -20, 10, 20, 30, 60, 70, 100];
  var DICE_PTS = [-40, -30, -20, 10, 20, 30, 60, 70, 0];
  var CIRCLE_ONLY_PTS = -50; // círculo marcado sin ningún número (se duplica => -100)
  var BRIDGE_PTS = 20;
  var BRIDGE_ROW = 7;

  // Casilleros especiales por expedición: fila (1..9) -> 'A' artefacto, 'R' aceleración (flecha).
  var SPECIAL = [
    { 3: 'A', 4: 'A', 6: 'A' },         // rojo
    { 3: 'A', 4: 'R', 6: 'A' },         // naranja
    { 3: 'A', 4: 'R', 6: 'A' },         // amarillo
    { 2: 'R', 4: 'A', 5: 'R', 8: 'R' }, // verde
    { 2: 'R', 4: 'A', 5: 'R', 8: 'R' }, // azul
    { 2: 'R', 4: 'R', 5: 'R', 8: 'R' }  // violeta
  ];

  var ART_BRIDGE = 6, DICE_BRIDGE = 7;

  function newPlayer() {
    var cols = [];
    for (var i = 0; i < 6; i++) cols.push({ circle: false, nums: [], top: false });
    return {
      cols: cols,
      art: 0,      // artefactos tachados (0..9)
      dice: 0,     // dados tachados por pasar (0..9)
      bridges: [null, null, null, null, null, null, null, null], // null | 'pending' | 'won' | 'lost'
      accel: false, // hay una aceleración pendiente de resolver
      hist: []
    };
  }

  function snap(p) {
    p.hist.push(JSON.stringify({ cols: p.cols, art: p.art, dice: p.dice, bridges: p.bridges, accel: p.accel }));
    if (p.hist.length > 300) p.hist.shift();
  }

  function undo(p) {
    if (!p.hist.length) return false;
    var s = JSON.parse(p.hist.pop());
    p.cols = s.cols; p.art = s.art; p.dice = s.dice; p.bridges = s.bridges; p.accel = s.accel;
    return true;
  }

  function gainArtefact(p) {
    if (p.art >= 9) return;
    p.art++;
    if (p.art === BRIDGE_ROW && p.bridges[ART_BRIDGE] === null) p.bridges[ART_BRIDGE] = 'pending';
  }

  function afterFill(p, c) {
    var row = p.cols[c].nums.length;
    if (row === BRIDGE_ROW && p.bridges[c] === null) p.bridges[c] = 'pending';
    var s = SPECIAL[c][row];
    if (s === 'A') gainArtefact(p);
    else if (s === 'R') p.accel = true;
  }

  // Qué pasa al elegir el dado de número `d` (0..9) junto con el color de la columna `c`.
  function dieOption(p, c, d) {
    var col = p.cols[c], n = col.nums.length;
    // El 0 solo sirve para marcar el círculo de una expedición sin empezar; nunca vale 10.
    if (d === 0) return { kind: 'circle', ok: n === 0 && !col.circle };
    if (n < 9) return { kind: 'num', value: d, row: n + 1, ok: n === 0 || d >= col.nums[n - 1] };
    return { kind: 'top', value: d, ok: !col.top && d >= col.nums[8] };
  }

  function applyDie(p, c, d) {
    var o = dieOption(p, c, d);
    if (!o.ok) return null;
    snap(p);
    var col = p.cols[c];
    if (o.kind === 'circle') col.circle = true;
    else if (o.kind === 'num') { col.nums.push(o.value); afterFill(p, c); }
    else { col.top = true; gainArtefact(p); }
    return o;
  }

  function refuse(p) {
    snap(p);
    if (p.dice >= 9) return false; // ya agotado: pasar no tiene efecto
    p.dice++;
    if (p.dice === BRIDGE_ROW && p.bridges[DICE_BRIDGE] === null) p.bridges[DICE_BRIDGE] = 'pending';
    return true;
  }

  // Expediciones que se pueden acelerar ahora.
  function accelOptions(p) {
    var out = [];
    for (var c = 0; c < 6; c++) {
      var col = p.cols[c], n = col.nums.length;
      if (n < 9) {
        out.push({ c: c, kind: 'num', value: n ? col.nums[n - 1] : 1, row: n + 1, special: SPECIAL[c][n + 1] || null, bridge: n + 1 === BRIDGE_ROW });
      } else if (!col.top) {
        out.push({ c: c, kind: 'top' });
      }
    }
    return out;
  }

  function accelerate(p, c) {
    var opts = accelOptions(p), o = null;
    for (var i = 0; i < opts.length; i++) if (opts[i].c === c) o = opts[i];
    if (!p.accel || !o) return null;
    p.accel = false;
    var col = p.cols[c];
    if (o.kind === 'num') { col.nums.push(o.value); afterFill(p, c); }
    else { col.top = true; gainArtefact(p); }
    return o;
  }

  // Solo cuando no hay ninguna expedición para acelerar: la aceleración es obligatoria.
  function skipAccel(p) { p.accel = false; }

  function pendingBridge(p) { return p.bridges.indexOf('pending'); }

  function resolveBridge(p, i, won) { p.bridges[i] = won ? 'won' : 'lost'; }

  // Si el jugador ya llegó al casillero del puente (7.º casillero, artefacto o dado).
  function bridgeReached(p, i) {
    var n = i < 6 ? p.cols[i].nums.length : i === ART_BRIDGE ? p.art : p.dice;
    return n >= BRIDGE_ROW;
  }

  // Tocar un puente: antes de llegar, lo tacha o destacha (otro jugador lo cruzó primero,
  // así al llegar no hay nada que preguntar); después de cruzarlo, alterna entre ganado y perdido.
  // Devuelve el nuevo estado, o null si no se puede tocar.
  function toggleBridge(p, i) {
    var b = p.bridges[i];
    if (b === 'pending') return null;
    snap(p);
    if (!bridgeReached(p, i)) p.bridges[i] = b === 'lost' ? null : 'lost';
    else p.bridges[i] = b === 'won' ? 'lost' : 'won';
    return p.bridges[i];
  }

  function colScore(col) {
    var n = col.nums.length;
    var base = n === 0 ? (col.circle ? CIRCLE_ONLY_PTS : 0) : ROW_PTS[n - 1];
    return col.circle ? base * 2 : base;
  }

  function score(p) {
    var cols = p.cols.map(colScore);
    var exp = cols.reduce(function (a, b) { return a + b; }, 0);
    var art = p.art ? ART_PTS[p.art - 1] : 0;
    var dice = p.dice ? DICE_PTS[p.dice - 1] : 0;
    var bridges = p.bridges.filter(function (b) { return b === 'won'; }).length * BRIDGE_PTS;
    return { cols: cols, exp: exp, art: art, dice: dice, bridges: bridges, total: exp + art + dice + bridges, exhausted: p.dice >= 9 };
  }

  var api = {
    ROW_PTS: ROW_PTS, ART_PTS: ART_PTS, DICE_PTS: DICE_PTS, SPECIAL: SPECIAL, BRIDGE_ROW: BRIDGE_ROW,
    ART_BRIDGE: ART_BRIDGE, DICE_BRIDGE: DICE_BRIDGE,
    newPlayer: newPlayer, undo: undo, dieOption: dieOption, applyDie: applyDie, refuse: refuse,
    accelOptions: accelOptions, accelerate: accelerate, skipAccel: skipAccel,
    pendingBridge: pendingBridge, resolveBridge: resolveBridge, toggleBridge: toggleBridge, bridgeReached: bridgeReached,
    score: score
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
