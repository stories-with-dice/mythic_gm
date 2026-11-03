/* =========================================================================
   TAB: NODE NARRATIVES  (Mythic Magazine Volume 71 — "Node Based Narratives")
   -------------------------------------------------------------------------
   Replaces the Threads/Characters Lists with a Node Sheet: Scene, Event,
   Thread and Character Nodes joined by Connections. SHARES the campaign's
   Chaos Factor, scene number and Expected Scene with the Mythic GME tab (all
   on `campaign().gme`); the sheet itself is `campaign().gme.nodeSheet`
   (freshNodeSheet() / sanitizeNodeSheet() in 03-state-persistence.js).

   Rules automated here:
     - Origin Connections: a new Scene Node Connects to the previous Scene
       Node; an Event/Thread/Character Node Connects to the current Scene Node
       (created first if it does not exist yet).
     - Thread and Character Nodes only Connect to Scene and Event Nodes.
     - Each Node has 8 numbered points (1 = top right, then clockwise); one
       Connection per point. A full Node can be duplicated.
     - Influence Node: start at the current Scene Node, roll d4 (or the
       Dynamic Node Die Range) for the number of moves. On a Node with more
       than one usable Connection, roll d8 and count clockwise to the first
       Connected point. A Connection back to the starting Scene Node is never
       usable. Doubling back is allowed.
     - Random Events / Interrupt Scenes use the Node Random Event Focus Table
       (or the campaign's table, with its NPC/Thread results read as
       "Influence Node"), plus a Meaning word pair.

   Judgment call (logged when it fires): if a move reaches a Node with no
   usable Connection, the walk stops there and that Node is the Influence Node.
   ========================================================================= */

// Node Random Event Focus Table (MM #71 p.11).
const NODE_FOCUS_TABLE = [
  { max: 5,   result: 'Remote Event' },
  { max: 10,  result: 'Ambiguous Event' },
  { max: 20,  result: 'New NPC' },
  { max: 70,  result: 'Influence Node' },
  { max: 80,  result: 'PC Negative' },
  { max: 85,  result: 'PC Positive' },
  { max: 100, result: 'Current Context' }
];
// Regular Event Focus results that the Node system reads as "Influence Node".
const NODE_INFLUENCE_RESULTS = ['npc action', 'npc negative', 'npc positive', 'move toward a thread', 'move away from a thread', 'close a thread'];

function nodeFocusResult(mode, campaignTable, roll){
  const result = rollEventFocus(mode === 'campaign' ? campaignTable : NODE_FOCUS_TABLE, roll);
  const influence = result === 'Influence Node' || NODE_INFLUENCE_RESULTS.includes(result.toLowerCase());
  return { result, influence };
}

// Dynamic Node Die Range (MM #71 p.17): the die for the number of moves.
function nodeMovementDie(sceneNumber, dynamic){
  if(!dynamic || sceneNumber <= 5) return 4;
  if(sceneNumber <= 7) return 6;
  if(sceneNumber <= 9) return 8;
  if(sceneNumber <= 11) return 10;
  if(sceneNumber <= 19) return 12;
  return 20;
}

const NODE_TYPE_LABELS = { scene: 'Scene', event: 'Event', thread: 'Thread', character: 'Character' };
const NODE_INFLUENCE_HINTS = {
  character: 'This Character comes into play: they are there and act, something happens to them, or their earlier actions shape the Scene.',
  thread: 'This Thread gets progress or an obstacle, or it could resolve itself.',
  scene: 'Its influence reflects the main point of that Scene.',
  event: 'Its influence reflects the main point of that Event.'
};

/* ---- Sheet geometry (px). 4 columns; 32 boxes (8 rows) per sheet. ---- */
const NODE_COLS = 4, NODE_SHEET_CELLS = 32;
const NODE_W = 164, NODE_H = 88, NODE_GAP_X = 40, NODE_GAP_Y = 34, NODE_PAD = 18, NODE_SHEET_HEAD = 30;
// Point offsets on a Node box, 1 = top right, then clockwise.
const NODE_SLOT_POS = [null, [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5], [0, 0], [.5, 0]];

function nodeCellXY(cell){
  const col = cell % NODE_COLS, row = Math.floor(cell / NODE_COLS);
  const sheet = Math.floor(cell / NODE_SHEET_CELLS);
  return { x: NODE_PAD + col * (NODE_W + NODE_GAP_X), y: NODE_PAD + (sheet + 1) * NODE_SHEET_HEAD + row * (NODE_H + NODE_GAP_Y) };
}
function nodeSlotXY(node, slot){
  const { x, y } = nodeCellXY(node.cell);
  const [fx, fy] = NODE_SLOT_POS[slot];
  return { x: x + fx * NODE_W, y: y + fy * NODE_H };
}

/* ---- Sheet helpers (pure: they take the sheet `s`, and only mutate it when the name says so) ---- */

// The sheet of the current campaign. A campaign saved before this tab existed has none yet.
function nodeSheet(){
  const g = campaign().gme;
  if(!g.nodeSheet) g.nodeSheet = freshNodeSheet();
  return g.nodeSheet;
}
function nodeById(s, id){ return s.nodes.find(n => n.id === id) || null; }
// Every Connection of a Node, seen from that Node: {link, slot, other, otherSlot}.
function nodeLinksOf(s, id){
  const out = [];
  s.links.forEach(l => {
    if(l.a === id) out.push({ link: l, slot: l.as, other: l.b, otherSlot: l.bs });
    else if(l.b === id) out.push({ link: l, slot: l.bs, other: l.a, otherSlot: l.as });
  });
  return out.sort((x, y) => x.slot - y.slot);
}
function nodeFreeSlots(s, id){
  const used = new Set(nodeLinksOf(s, id).map(x => x.slot));
  return [1, 2, 3, 4, 5, 6, 7, 8].filter(k => !used.has(k));
}
function nodeName(n){
  if(!n) return '(missing Node)';
  const t = n.text.trim() || '(no summary)';
  return n.type === 'scene' ? `Scene ${n.scene}: ${t}` : `${NODE_TYPE_LABELS[n.type]}: ${t}`;
}
// The latest Scene Node for a Scene number (a duplicate wins over the original).
function nodeSceneNode(s, sceneNumber){
  const list = s.nodes.filter(n => n.type === 'scene' && n.scene === sceneNumber);
  return list.length ? list[list.length - 1] : null;
}
// The Scene Node that came before a Scene number: the highest Scene number below it.
function nodePrevScene(s, sceneNumber){
  let best = null;
  s.nodes.forEach(n => {
    if(n.type === 'scene' && n.scene < sceneNumber && (!best || n.scene >= best.scene)) best = n;
  });
  return best;
}
// The free box nearest to `cell` (grid distance), or the first free box.
function nodeFreeCellNear(s, cell){
  const used = new Set(s.nodes.map(n => n.cell));
  const limit = Math.max(NODE_SHEET_CELLS, ...s.nodes.map(n => n.cell + 1)) + NODE_SHEET_CELLS;
  if(cell == null){ let c = 0; while(used.has(c)) c++; return c; }
  const cc = cell % NODE_COLS, cr = Math.floor(cell / NODE_COLS);
  let best = null, bestD = Infinity;
  for(let c = 0; c < limit; c++){
    if(used.has(c)) continue;
    const d = Math.abs(c % NODE_COLS - cc) + Math.abs(Math.floor(c / NODE_COLS) - cr);
    if(d < bestD){ best = c; bestD = d; }
  }
  return best;
}
// The point a new Connection uses on `node`, toward `other`. By default the
// free point nearest the other Node (the least cluttered line). With the
// "Node Choice Or Not" rule, roll d8 and count on to the first free point.
function nodePickSlot(s, node, other, random, roll){
  const free = nodeFreeSlots(s, node.id);
  if(!free.length) return null;
  if(random){
    const r = (roll || rollDie)(8);
    for(let k = 0; k < NODE_SLOTS; k++){
      const slot = ((r - 1 + k) % NODE_SLOTS) + 1;
      if(free.includes(slot)) return slot;
    }
  }
  const o = nodeCellXY(other.cell);
  const ox = o.x + NODE_W / 2, oy = o.y + NODE_H / 2;
  let best = free[0], bestD = Infinity;
  free.forEach(k => {
    const p = nodeSlotXY(node, k);
    const d = (p.x - ox) ** 2 + (p.y - oy) ** 2;
    if(d < bestD){ best = k; bestD = d; }
  });
  return best;
}
// Why two Nodes cannot Connect, or '' when they can.
function nodeConnectError(s, a, b){
  if(!a || !b) return 'Pick two Nodes.';
  if(a.id === b.id) return 'A Node cannot Connect to itself.';
  if(a.eliminated || b.eliminated) return 'An eliminated Node has no Connections.';
  if(!nodeCanConnect(a.type, b.type)) return 'Thread and Character Nodes only Connect to Scene and Event Nodes.';
  if(s.links.some(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) return 'These Nodes are already Connected.';
  if(!nodeFreeSlots(s, a.id).length) return `All 8 points of "${nodeName(a)}" are used. Duplicate the Node to keep Connecting it.`;
  if(!nodeFreeSlots(s, b.id).length) return `All 8 points of "${nodeName(b)}" are used. Duplicate the Node to keep Connecting it.`;
  return '';
}
// Mutates: adds a Connection. `as` / `bs` pick exact points; else nodePickSlot().
function nodeConnect(s, aId, bId, as, bs){
  const a = nodeById(s, aId), b = nodeById(s, bId);
  const error = nodeConnectError(s, a, b);
  if(error) return { error };
  const freeA = nodeFreeSlots(s, a.id), freeB = nodeFreeSlots(s, b.id);
  if(as != null && !freeA.includes(as)) return { error: `Point ${as} of "${nodeName(a)}" is already used.` };
  if(bs != null && !freeB.includes(bs)) return { error: `Point ${bs} of "${nodeName(b)}" is already used.` };
  const link = {
    a: a.id, as: as != null ? as : nodePickSlot(s, a, b, s.randomSlots),
    b: b.id, bs: bs != null ? bs : nodePickSlot(s, b, a, s.randomSlots)
  };
  s.links.push(link);
  return { link };
}
function nodeDisconnect(s, link){ s.links = s.links.filter(l => l !== link); }

// Mutates: adds a Node with its Origin Connection. Returns {node, scene (created), link, error}.
function nodeAdd(s, type, text, sceneNumber){
  text = String(text || '').trim().slice(0, 200);
  if(type === 'scene'){
    const prev = nodePrevScene(s, sceneNumber);
    const node = { id: s.nextId++, type, text, scene: sceneNumber, cell: nodeFreeCellNear(s, prev ? prev.cell : null), eliminated: false };
    s.nodes.push(node);
    const res = prev ? nodeConnect(s, prev.id, node.id) : {};
    return { node, link: res.link || null, error: res.error || '' };
  }
  const ens = nodeEnsureScene(s, sceneNumber);
  const node = { id: s.nextId++, type, text, scene: null, cell: nodeFreeCellNear(s, ens.node.cell), eliminated: false };
  s.nodes.push(node);
  const res = nodeConnect(s, ens.node.id, node.id);
  return { node, scene: ens.created ? ens : null, link: res.link || null, error: res.error || '' };
}
// Mutates: the current Scene Node, created (and Connected to the previous Scene) when missing.
function nodeEnsureScene(s, sceneNumber, text){
  const cur = nodeSceneNode(s, sceneNumber);
  if(cur) return { node: cur, created: false };
  const res = nodeAdd(s, 'scene', text || '', sceneNumber);
  return { node: res.node, created: true, link: res.link };
}
// Mutates: a copy of a Node in a nearby box, with no Connections.
function nodeDuplicate(s, id){
  const n = nodeById(s, id);
  if(!n) return null;
  const copy = { id: s.nextId++, type: n.type, text: n.text, scene: n.scene, cell: nodeFreeCellNear(s, n.cell), eliminated: false };
  s.nodes.push(copy);
  return copy;
}
// Mutates: crosses out a Thread or Character Node and removes its Connections.
function nodeEliminate(s, id){
  const n = nodeById(s, id);
  if(!n || (n.type !== 'thread' && n.type !== 'character')) return false;
  n.eliminated = true;
  s.links = s.links.filter(l => l.a !== id && l.b !== id);
  return true;
}
function nodeDelete(s, id){
  s.nodes = s.nodes.filter(n => n.id !== id);
  s.links = s.links.filter(l => l.a !== id && l.b !== id);
}
function nodeMove(s, id, cell){
  const n = nodeById(s, id);
  if(!n || !Number.isInteger(cell) || cell < 0 || s.nodes.some(x => x.cell === cell)) return false;
  n.cell = cell;
  return true;
}

// Move along Connections from `startId` for `steps` moves. `roll(sides)` is
// injectable for tests. Returns {moves:[{from, d8, checked, slot, to}], end, stop}.
// stop: '' (all moves made), 'noLinks' (the start Node has no Connection) or
// 'deadEnd' (a Node with no usable Connection; the walk ends there).
function nodeWalk(s, startId, steps, roll){
  roll = roll || rollDie;
  const moves = [];
  let cur = startId, stop = '';
  for(let i = 0; i < steps; i++){
    const usable = nodeLinksOf(s, cur).filter(x => x.other !== startId);
    if(!usable.length){ stop = cur === startId ? 'noLinks' : 'deadEnd'; break; }
    let pick = usable[0], d8 = null;
    const checked = [];
    if(usable.length > 1){
      d8 = roll(8);
      for(let k = 0; k < NODE_SLOTS; k++){
        const slot = ((d8 - 1 + k) % NODE_SLOTS) + 1;
        checked.push(slot);
        const hit = usable.find(x => x.slot === slot);
        if(hit){ pick = hit; break; }
      }
    }
    moves.push({ from: cur, d8, checked, slot: pick.slot, to: pick.other });
    cur = pick.other;
  }
  return { moves, end: cur === startId ? null : cur, stop };
}

// transient UI state, cached against renderActive()
let nodeSceneTestHtml = '';
let nodeResultHtml = '';
let nodeMsgHtml = '';            // the last refused action (e.g. a Connection the rules do not allow)
let nodeSelectedId = null;       // the Node shown in the "Selected Node" panel
let nodePendingSlot = null;      // {id, slot}: the first point clicked for a point-to-point Connection
let nodeLastWalk = null;         // {start, ids:[...], links:[...], end}: the last Influence Node path, highlighted on the sheet
let nodeOptionsOpen = false;     // "Options" card, collapsed by default

const NODE_FLOW_HTML = `
<div class="pub-flow">
  <div class="flow-group">
    <h4>Record the adventure as Nodes</h4>
    <div class="flow-step"><b>1.</b> Each Scene gets a <b>Scene Node</b> with a short summary. It Connects to the Scene Node before it.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>2.</b> Give important points, Threads and Characters their own <b>Event</b>, <b>Thread</b> and <b>Character Nodes</b>. Each Connects to the Scene it came from.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>3.</b> Connect any Nodes that have to do with each other. Threads and Characters only Connect to Scenes and Events. A Node has 8 points; duplicate a full Node.</div>
  </div>
  <div class="flow-group">
    <h4>When the unexpected happens</h4>
    <div class="flow-step"><b>A.</b> An <b>Altered Scene</b>, an <b>Interrupt Scene</b> or a <b>Random Event</b> can call for an <b>Influence Node</b>. Random Events use the Node Random Event Focus Table.</div>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>B.</b> Start at the current Scene Node. Roll <b>d4</b> for the number of moves along Connections.</div>
    <ul class="flow-branch">
      <li>One usable Connection &rarr; follow it.</li>
      <li>More than one &rarr; roll <b>d8</b>, count clockwise from that point to the first Connection.</li>
      <li>Never move back to the starting Scene Node. Doubling back to other Nodes is fine.</li>
    </ul>
    <div class="flow-arrow">&#9660;</div>
    <div class="flow-step"><b>C.</b> Interpret the Influence Node with the Expected Scene (Altered) or the Meaning words (Interrupt, Random Event).</div>
    <div class="flow-loop">Nodes with more Connections come up more often. Old Nodes fade unless new Connections reach them.</div>
  </div>
</div>`;

function renderNodeBoard(s){
  const maxCell = s.nodes.reduce((m, n) => Math.max(m, n.cell), -1);
  const rows = Math.max(2, Math.floor(maxCell / NODE_COLS) + 2);
  const cells = rows * NODE_COLS;
  const last = nodeCellXY(cells - 1);
  const width = NODE_PAD * 2 + NODE_COLS * NODE_W + (NODE_COLS - 1) * NODE_GAP_X;
  const height = last.y + NODE_H + NODE_PAD;
  const byCell = new Map(s.nodes.map(n => [n.cell, n]));
  const walk = nodeLastWalk || { ids: [], links: [], end: null, start: null };

  const sheetHeads = [];
  for(let sh = 0; sh * NODE_SHEET_CELLS < cells; sh++){
    const { y } = nodeCellXY(sh * NODE_SHEET_CELLS);
    sheetHeads.push(`<div class="node-sheet-head" style="top:${y - NODE_SHEET_HEAD + 2}px">Sheet ${sh + 1}</div>`);
  }

  const lines = s.links.map(l => {
    const a = nodeById(s, l.a), b = nodeById(s, l.b);
    if(!a || !b) return '';
    const p = nodeSlotXY(a, l.as), q = nodeSlotXY(b, l.bs);
    const onWalk = walk.links.includes(l);
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="node-line${onWalk ? ' walk' : ''}"/>`;
  }).join('');

  const boxes = [];
  for(let c = 0; c < cells; c++){
    const { x, y } = nodeCellXY(c);
    const n = byCell.get(c);
    if(!n){
      boxes.push(`<div class="node-cell" data-node-cell="${c}" style="left:${x}px; top:${y}px; width:${NODE_W}px; height:${NODE_H}px" title="${nodeSelectedId != null ? 'Move the selected Node here' : 'Empty box'}"></div>`);
      continue;
    }
    const used = new Set(nodeLinksOf(s, n.id).map(x => x.slot));
    const slots = [1, 2, 3, 4, 5, 6, 7, 8].map(k => {
      const [fx, fy] = NODE_SLOT_POS[k];
      const pending = nodePendingSlot && nodePendingSlot.id === n.id && nodePendingSlot.slot === k;
      return `<button type="button" class="node-slot${used.has(k) ? ' used' : ''}${pending ? ' pending' : ''}" data-node-slot="${n.id}:${k}" style="left:${fx * 100}%; top:${fy * 100}%" title="Point ${k}${used.has(k) ? ' (Connected)' : ''}" aria-label="Point ${k} of ${escapeAttr(nodeName(n))}">${k}</button>`;
    }).join('');
    const cls = ['node-box', 'type-' + n.type,
      n.id === nodeSelectedId ? 'selected' : '',
      n.eliminated ? 'eliminated' : '',
      n.id === walk.end ? 'influence' : (walk.ids.includes(n.id) ? 'walked' : ''),
      n.id === walk.start ? 'walk-start' : ''].filter(Boolean).join(' ');
    boxes.push(`<div class="${cls}" data-node-id="${n.id}" draggable="true" role="button" tabindex="0" aria-pressed="${n.id === nodeSelectedId}" style="left:${x}px; top:${y}px; width:${NODE_W}px; height:${NODE_H}px">
      <div class="node-head"><span class="node-type">${NODE_TYPE_LABELS[n.type]}</span>${n.type === 'scene' ? `<span class="node-scene-num">${n.scene}</span>` : ''}</div>
      <div class="node-text">${escapeAttr(n.text) || '<i>no summary</i>'}</div>
      ${slots}
    </div>`);
  }

  return `<div class="node-board-wrap"><div class="node-board" id="nodeBoard" style="width:${width}px; height:${height}px">
    ${sheetHeads.join('')}
    <svg class="node-lines" width="${width}" height="${height}" aria-hidden="true">${lines}</svg>
    ${boxes.join('')}
  </div></div>`;
}

function renderNodeSelected(s){
  const n = nodeById(s, nodeSelectedId);
  if(!n) return '<div class="small-note">Click a Node to edit it, Connect it, or move it. Click a numbered point, then a point on another Node, to draw a Connection between those two points.</div>';
  const conns = nodeLinksOf(s, n.id);
  const targets = s.nodes.filter(o => !nodeConnectError(s, n, o));
  const rows = conns.map((x, i) => `<li><span class="mnum">${x.slot}</span><span class="txt">&rarr; ${escapeAttr(nodeName(nodeById(s, x.other)))} <span class="small-note">(point ${x.otherSlot})</span></span><button type="button" data-node-unlink="${i}" title="Remove this Connection">&#10005;</button></li>`).join('');
  const canEliminate = (n.type === 'thread' || n.type === 'character') && !n.eliminated;
  return `
    <div class="row" style="align-items:flex-end;">
      <div class="field" style="flex:1; min-width:200px;">
        <label for="nodeEditText">${NODE_TYPE_LABELS[n.type]} Node summary${n.eliminated ? ' (eliminated)' : ''}</label>
        <input type="text" id="nodeEditText" class="field-input" maxlength="200" value="${escapeAttr(n.text)}">
      </div>
      ${n.type === 'scene' ? `<div class="field"><label for="nodeEditScene">Scene #</label><input type="number" id="nodeEditScene" class="field-input" style="width:80px; min-width:0;" min="1" value="${n.scene}"></div>` : ''}
    </div>
    <div class="small-note" style="margin-top:8px;">${conns.length} of ${NODE_SLOTS} points Connected.</div>
    ${conns.length ? `<ul class="gme-list pub-meaning-list">${rows}</ul>` : ''}
    <div class="row" style="margin-top:10px; align-items:flex-end;">
      <div class="field" style="flex:1; min-width:200px;">
        <label for="nodeConnectTarget">Connect to</label>
        <select id="nodeConnectTarget" class="field-input" ${targets.length ? '' : 'disabled'}>
          ${targets.length ? targets.map(o => `<option value="${o.id}">${escapeAttr(nodeName(o))}</option>`).join('') : '<option>No Node can Connect</option>'}
        </select>
      </div>
      <button class="btn" id="btnNodeConnect" ${targets.length ? '' : 'disabled'}>Connect</button>
    </div>
    <div class="row" style="margin-top:12px;">
      <button class="btn small" id="btnNodeDuplicate" title="Make a copy with no Connections, for a Node whose points are all used">Duplicate</button>
      ${canEliminate ? '<button class="btn small" id="btnNodeEliminate" title="Cross out a Thread or Character that is no longer in play">Eliminate</button>' : ''}
      <button class="btn small danger" id="btnNodeDelete">Delete Node</button>
      <button class="btn small" id="btnNodeDeselect">Done</button>
    </div>`;
}

function renderNodeNarratives(){
  const g = campaign().gme;
  const s = nodeSheet();
  if(nodeSelectedId != null && !nodeById(s, nodeSelectedId)) nodeSelectedId = null;
  if(nodePendingSlot && !nodeById(s, nodePendingSlot.id)) nodePendingSlot = null;
  // a campaign switch or a Dropbox pull replaces the Connections: drop a stale path
  if(nodeLastWalk && !nodeLastWalk.links.every(l => s.links.includes(l))) nodeLastWalk = null;
  const die = nodeMovementDie(g.sceneNumber, s.dynamicDie);
  const curScene = nodeSceneNode(s, g.sceneNumber);
  const counts = NODE_TYPES.map(t => `${s.nodes.filter(n => n.type === t).length} ${NODE_TYPE_LABELS[t]}`).join(' &middot; ');

  return `
  ${tabHeader(`Node Based Narratives`, `Record the adventure as a sheet of Nodes and Connections instead of the Threads and Characters Lists. When an Altered Scene, an Interrupt Scene or a Random Event happens, move along the Connections from the current Scene to find an <b>Influence Node</b>. Chaos Factor, Scene number and Expected Scene are shared with the <b>Mythic GME</b> tab.`, NODE_FLOW_HTML)}

  <div class="card">
    <h3 class="block-title">Chaos Factor &amp; Scene</h3>
    <div class="row" style="gap:26px; align-items:center;">
      <div class="pp-readout"><span class="num">${g.chaosFactor}</span><span class="lbl">Chaos Factor (1–9)</span></div>
      <div class="row">
        <button class="btn small" id="btnNodeCfMinus">CF &minus;1</button>
        <button class="btn small" id="btnNodeCfPlus">CF +1</button>
      </div>
      <div class="pp-readout"><span class="num">${g.sceneNumber}</span><span class="lbl">Scene</span></div>
    </div>
    <div class="field" style="margin-top:14px;">
      <label for="nodeExpectedScene">Expected Scene — how you think Scene ${g.sceneNumber} will start</label>
      <textarea id="nodeExpectedScene" class="field-input" rows="4" style="width:100%; resize:vertical;" placeholder="e.g. The PC goes to interview Celeste again.">${escapeAttr(g.expectedScene)}</textarea>
    </div>
    <div class="row"><button class="btn primary" id="btnNodeTestScene">Test vs Chaos Factor</button></div>
    <div class="small-note">Altered Scene → ${s.alteredInfluence ? 'Influence Node' : 'Scene Adjustment + Meaning word'} &nbsp;·&nbsp; Interrupt Scene → Random Event (${s.focusMode === 'node' ? 'Node Random Event Focus Table' : 'campaign Event Focus Table'}) + Meaning words.</div>
    <div id="nodeSceneTestResult" style="margin-top:12px;">${nodeSceneTestHtml}</div>
    <div class="divider"></div>
    <div class="row" style="align-items:flex-end;">
      <div class="field">
        <label for="nodeControl">End of Scene — was the PC in control?</label>
        <select id="nodeControl" class="field-input">
          <option value="in">Yes — in control (Chaos Factor −1)</option>
          <option value="out">No — not in control (Chaos Factor +1)</option>
        </select>
      </div>
      <button class="btn" id="btnNodeEndScene">End Scene &amp; Update CF</button>
    </div>
  </div>

  <div class="card">
    <h3 class="block-title">Node Sheet</h3>
    <div class="row" style="align-items:flex-end;">
      <div class="field" style="flex:1; min-width:200px;">
        <label for="nodeTitle">Adventure name</label>
        <input type="text" id="nodeTitle" class="field-input" maxlength="120" value="${escapeAttr(s.title)}" placeholder="e.g. A Haunting At Shallow Rock">
      </div>
    </div>
    <div class="row" style="align-items:flex-end; margin-top:10px;">
      <div class="field">
        <label for="nodeNewType">New Node</label>
        <select id="nodeNewType" class="field-input" style="min-width:120px;">
          ${NODE_TYPES.map(t => `<option value="${t}" ${t === (curScene ? 'event' : 'scene') ? 'selected' : ''}>${NODE_TYPE_LABELS[t]}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="flex:1; min-width:200px;">
        <label for="nodeNewText">Summary</label>
        <input type="text" id="nodeNewText" class="field-input" maxlength="200" placeholder="e.g. Investigate a murder.">
      </div>
      <button class="btn" id="btnNodeAdd">Add Node</button>
    </div>
    <div class="small-note">${curScene ? `New Nodes Connect to the Scene ${g.sceneNumber} Node.` : `Scene ${g.sceneNumber} has no Node yet. The first new Node (or Influence Node roll) makes it.`} ${counts}.</div>
    ${nodeMsgHtml}

    <div class="row" style="margin-top:12px;">
      <button class="btn primary" id="btnNodeInfluence">Roll Influence Node (d${die})</button>
      <button class="btn" id="btnNodeRandomEvent">Random Event</button>
      ${nodeLastWalk ? '<button class="btn small" id="btnNodeClearWalk">Clear path</button>' : ''}
    </div>
    <div id="nodeResult" style="margin-top:12px;">${nodeResultHtml}</div>

    ${renderNodeBoard(s)}

    <h4 class="node-sub">Selected Node</h4>
    <div id="nodeSelected">${renderNodeSelected(s)}</div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 class="block-title" style="margin:0; padding:0; border:0;">Options</h3>
      <button class="btn small" id="btnNodeOptionsToggle">${nodeOptionsOpen ? 'Hide' : 'Show'}</button>
    </div>
    ${nodeOptionsOpen ? `
    <div class="beat-checks">
      <label><input type="checkbox" id="nodeOptDynamic" ${s.dynamicDie ? 'checked' : ''}> Dynamic Node Die Range — the movement die grows with the Scene number (Scenes 1-5 d4, 6-7 d6, 8-9 d8, 10-11 d10, 12-19 d12, 20+ d20)</label>
      <label><input type="checkbox" id="nodeOptRandomSlots" ${s.randomSlots ? 'checked' : ''}> Node Choice Or Not — roll d8 for the point a new Connection uses, instead of the free point nearest the other Node</label>
      <label><input type="checkbox" id="nodeOptAltered" ${s.alteredInfluence ? 'checked' : ''}> An Altered Scene rolls an Influence Node (off: Scene Adjustment Table + Meaning word)</label>
    </div>
    <div class="field" style="max-width:420px;">
      <label for="nodeOptFocus">Random Event Focus Table</label>
      <select id="nodeOptFocus" class="field-input">
        <option value="node" ${s.focusMode === 'node' ? 'selected' : ''}>Node Random Event Focus Table</option>
        <option value="campaign" ${s.focusMode === 'campaign' ? 'selected' : ''}>Campaign table (Settings), NPC and Thread results → Influence Node</option>
      </select>
    </div>
    <table class="gme-focus-table node-focus-ref">
      <thead><tr><th>1d100</th><th>Node Random Event Focus Table</th></tr></thead>
      <tbody>${NODE_FOCUS_TABLE.map((r, i) => `<tr><td class="range">${(i ? NODE_FOCUS_TABLE[i - 1].max + 1 : 1)}-${r.max}</td><td>${r.result}</td></tr>`).join('')}</tbody>
    </table>
    ` : `<div class="small-note" style="margin-top:6px;">Movement die d${die}${s.dynamicDie ? ' (dynamic)' : ''} &middot; Connection points ${s.randomSlots ? 'rolled' : 'chosen'} &middot; ${s.focusMode === 'node' ? 'Node' : 'campaign'} Event Focus Table</div>`}
  </div>
  `;
}

function wireNodeNarratives(){
  const g = () => campaign().gme;
  const s = () => nodeSheet();
  const LOG = 'Node Narratives';

  // Lines hold user text (Node summaries, Expected Scene), so escape HTML
  // first, then turn the **bold** / *italic* markers into tags.
  const toHtml = (lines, cls) => `<div class="result-box ${cls || 'event'}">${
    lines.map(l => escapeAttr(l).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>')).join('<br>')
  }</div>`;
  const md = t => escapeMd(String(t).replace(/\s*\n\s*/g, ' '));

  function refuse(msg){
    nodeMsgHtml = `<div class="result-box no">${escapeAttr(msg)}</div>`;
    renderActive();
  }

  // Roll an Influence Node. Returns markdown-ish lines and records the path.
  function influenceLines(){
    const sheet = s();
    const sceneNumber = g().sceneNumber;
    const lines = [];
    const ens = nodeEnsureScene(sheet, sceneNumber, g().expectedScene.trim().slice(0, 200));
    if(ens.created) lines.push(`Created the **Scene ${sceneNumber} Node**${ens.link ? ', Connected to the previous Scene Node' : ''}. Edit its summary when the Scene is clear.`);
    const die = nodeMovementDie(sceneNumber, sheet.dynamicDie);
    const steps = rollDie(die);
    const w = nodeWalk(sheet, ens.node.id, steps);
    lines.push(`Moves: d${die} → **${steps}**, starting at ${md(nodeName(ens.node))}`);
    w.moves.forEach((m, i) => {
      const how = m.d8 == null
        ? 'one usable Connection'
        : `d8 ${m.d8}${m.checked.length > 1 ? `, counted ${m.checked.join(' → ')}` : ''}`;
      lines.push(`${i + 1}. point ${m.slot} (${how}) → ${md(nodeName(nodeById(sheet, m.to)))}`);
    });
    const ids = [ens.node.id, ...w.moves.map(m => m.to)];
    const links = w.moves.map(m => sheet.links.find(l => (l.a === m.from && l.b === m.to) || (l.b === m.from && l.a === m.to)));
    nodeLastWalk = { start: ens.node.id, ids, links, end: w.end };
    if(w.stop === 'noLinks'){
      lines.push('The current Scene Node has no Connection to move along, so there is **no Influence Node**. Use the regular rules (Current Context, or the Expected Scene).');
      nodeLastWalk = null;
    } else {
      if(w.stop === 'deadEnd') lines.push(`*Judgment call:* the Node after move ${w.moves.length} has no usable Connection, so the walk stops there.`);
      const end = nodeById(sheet, w.end);
      lines.push(`Influence Node: **${md(nodeName(end))}**`);
      lines.push(NODE_INFLUENCE_HINTS[end.type]);
    }
    persist();
    return lines;
  }

  // A Random Event (or Interrupt Scene) with the Node Event Focus rules.
  function randomEventLines(){
    const sheet = s();
    const fRoll = rollDie(100);
    const f = nodeFocusResult(sheet.focusMode, g().eventFocusTable, fRoll);
    const lines = [`Event Focus (1d100: ${fRoll}) → **${md(f.result)}**${f.influence && f.result !== 'Influence Node' ? ' → read as **Influence Node**' : ''}`];
    if(f.influence) lines.push(...influenceLines());
    if(f.result === 'New NPC') lines.push('Add a Character Node for the new NPC.');
    const m = randomEventWords();
    lines.push(`Meaning: **${m.a.word} / ${m.d.word}** (rolls ${m.a.roll}, ${m.d.roll})`);
    return lines;
  }

  /* ---- Chaos Factor / Scene ---- */
  document.getElementById('btnNodeCfMinus').addEventListener('click', () => {
    g().chaosFactor = Math.max(1, g().chaosFactor - 1);
    persist(); addLog(LOG, `**Chaos Factor** lowered to ${g().chaosFactor}.`); renderActive();
  });
  document.getElementById('btnNodeCfPlus').addEventListener('click', () => {
    g().chaosFactor = Math.min(9, g().chaosFactor + 1);
    persist(); addLog(LOG, `**Chaos Factor** raised to ${g().chaosFactor}.`); renderActive();
  });
  const exp = document.getElementById('nodeExpectedScene');
  exp.addEventListener('input', () => { g().expectedScene = exp.value; persist(); });

  document.getElementById('btnNodeTestScene').addEventListener('click', () => {
    const cf = g().chaosFactor;
    const roll = rollDie(10);
    const type = roll > cf ? 'Expected Scene' : roll % 2 === 1 ? 'Altered Scene' : 'Interrupt Scene';
    const expText = (g().expectedScene || '').trim();
    const lines = [`1d10: **${roll}** vs Chaos Factor **${cf}** → **${type}**`];
    if(expText) lines.push(`Expected: *${md(expText)}*`);
    if(type === 'Expected Scene'){
      lines.push('The Scene starts as you expected.');
    } else if(type === 'Altered Scene'){
      if(s().alteredInfluence){
        lines.push('Use the Influence Node as inspiration for how to Alter the Expected Scene.');
        lines.push(...influenceLines());
      } else {
        const aRoll = rollDie(10);
        const w = oneMeaningWord();
        lines.push(`Scene Adjustment (1d10: ${aRoll}) → **${sceneAdjustment(aRoll)}**`);
        lines.push(`Meaning (${w.label}, 1d100: ${w.roll}) → **${w.word}**`);
      }
    } else {
      lines.push('Ignore the Expected Scene. A Random Event starts the Scene:');
      lines.push(...randomEventLines());
    }
    nodeSceneTestHtml = toHtml(lines, type === 'Expected Scene' ? '' : 'no');
    nodeMsgHtml = '';
    addLog(LOG, `**Test Expected Scene ${g().sceneNumber}** —\n  - ` + lines.join('\n  - '));
    renderActive();
  });

  document.getElementById('btnNodeEndScene').addEventListener('click', () => {
    const inControl = document.getElementById('nodeControl').value === 'in';
    const gme = g();
    const ended = gme.sceneNumber;
    gme.chaosFactor = inControl ? Math.max(1, gme.chaosFactor - 1) : Math.min(9, gme.chaosFactor + 1);
    gme.sceneNumber += 1;
    gme.expectedScene = '';
    nodeSceneTestHtml = '';
    persist();
    addLog(LOG, `**Scene ${ended} ended** — PC ${inControl ? 'in control → Chaos Factor −1' : 'not in control → Chaos Factor +1'} (now ${gme.chaosFactor}). Beginning Scene ${gme.sceneNumber}.`);
    renderActive();
  });

  /* ---- Node Sheet ---- */
  const title = document.getElementById('nodeTitle');
  title.addEventListener('input', () => { s().title = title.value.slice(0, 120); persist(); });

  function addNode(){
    const type = document.getElementById('nodeNewType').value;
    const text = document.getElementById('nodeNewText').value.trim();
    const sheet = s();
    const sceneNumber = g().sceneNumber;
    if(type === 'scene' && nodeSceneNode(sheet, sceneNumber)){
      refuse(`Scene ${sceneNumber} already has a Node. End the Scene first, or Duplicate the Scene Node.`);
      return;
    }
    const res = nodeAdd(sheet, type, text, sceneNumber);
    nodeMsgHtml = res.error ? `<div class="result-box no">${escapeAttr(res.error)}</div>` : '';
    nodeSelectedId = res.node.id;
    persist();
    const parts = [`**${NODE_TYPE_LABELS[type]} Node** — "${md(res.node.text || '(no summary)')}"`];
    if(res.scene) parts.push(`created the Scene ${sceneNumber} Node first`);
    if(res.link) parts.push(`Origin Connection to ${md(nodeName(nodeById(sheet, res.link.a === res.node.id ? res.link.b : res.link.a)))}`);
    addLog(LOG, parts.join(' — ') + '.');
    renderActive();
  }
  document.getElementById('btnNodeAdd').addEventListener('click', addNode);
  document.getElementById('nodeNewText').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addNode(); } });

  document.getElementById('btnNodeInfluence').addEventListener('click', () => {
    const lines = influenceLines();
    nodeResultHtml = toHtml(lines);
    nodeMsgHtml = '';
    addLog(LOG, `**Influence Node** —\n  - ` + lines.join('\n  - '));
    renderActive();
  });
  document.getElementById('btnNodeRandomEvent').addEventListener('click', () => {
    const lines = randomEventLines();
    nodeResultHtml = toHtml(lines);
    nodeMsgHtml = '';
    addLog(LOG, `**Random Event** —\n  - ` + lines.join('\n  - '));
    renderActive();
  });
  const clearWalk = document.getElementById('btnNodeClearWalk');
  if(clearWalk) clearWalk.addEventListener('click', () => { nodeLastWalk = null; renderActive(); });

  /* ---- The board: select, move, point-to-point Connections ---- */
  const board = document.getElementById('nodeBoard');
  board.querySelectorAll('[data-node-id]').forEach(el => {
    const id = Number(el.dataset.nodeId);
    const select = () => {
      nodeSelectedId = nodeSelectedId === id ? null : id;
      nodePendingSlot = null;
      nodeMsgHtml = '';
      renderActive();
    };
    el.addEventListener('click', select);
    el.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); select(); } });
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; });
  });
  board.querySelectorAll('[data-node-cell]').forEach(el => {
    const cell = Number(el.dataset.nodeCell);
    el.addEventListener('click', () => {
      if(nodeSelectedId == null) return;
      if(nodeMove(s(), nodeSelectedId, cell)){ persist(); renderActive(); }
    });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData('text/plain'));
      if(nodeMove(s(), id, cell)){ persist(); renderActive(); }
    });
  });
  board.querySelectorAll('[data-node-slot]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation();
    const [id, slot] = el.dataset.nodeSlot.split(':').map(Number);
    const sheet = s();
    if(!nodeFreeSlots(sheet, id).includes(slot)){ refuse(`Point ${slot} of "${nodeName(nodeById(sheet, id))}" is already Connected.`); return; }
    if(!nodePendingSlot || nodePendingSlot.id === id){
      nodePendingSlot = (nodePendingSlot && nodePendingSlot.slot === slot) ? null : { id, slot };
      nodeMsgHtml = '';
      renderActive();
      return;
    }
    const from = nodePendingSlot;
    nodePendingSlot = null;
    const res = nodeConnect(sheet, from.id, id, from.slot, slot);
    if(res.error){ refuse(res.error); return; }
    nodeMsgHtml = '';
    persist();
    addLog(LOG, `**Connection** — ${md(nodeName(nodeById(sheet, from.id)))} (point ${from.slot}) ↔ ${md(nodeName(nodeById(sheet, id)))} (point ${slot}).`);
    renderActive();
  }));

  /* ---- Selected Node panel (exists only while a Node is selected) ---- */
  const sel = () => nodeById(s(), nodeSelectedId);
  const editText = document.getElementById('nodeEditText');
  if(editText){
    editText.addEventListener('input', () => {
      sel().text = editText.value.slice(0, 200);
      persist();
      const box = board.querySelector(`[data-node-id="${nodeSelectedId}"] .node-text`);
      if(box) box.textContent = sel().text;
    });
    editText.addEventListener('change', () => renderActive());
  }
  const editScene = document.getElementById('nodeEditScene');
  if(editScene) editScene.addEventListener('change', () => {
    const v = Math.max(1, Math.round(Number(editScene.value)) || 1);
    sel().scene = v;
    persist();
    renderActive();
  });
  document.querySelectorAll('[data-node-unlink]').forEach(b => b.addEventListener('click', () => {
    const sheet = s();
    const x = nodeLinksOf(sheet, nodeSelectedId)[Number(b.dataset.nodeUnlink)];
    if(!x) return;
    nodeDisconnect(sheet, x.link);
    if(nodeLastWalk && nodeLastWalk.links.includes(x.link)) nodeLastWalk = null;
    persist();
    addLog(LOG, `**Connection removed** — ${md(nodeName(sel()))} ↔ ${md(nodeName(nodeById(sheet, x.other)))}.`);
    renderActive();
  }));
  const connectBtn = document.getElementById('btnNodeConnect');
  if(connectBtn) connectBtn.addEventListener('click', () => {
    const sheet = s();
    const target = Number(document.getElementById('nodeConnectTarget').value);
    const res = nodeConnect(sheet, nodeSelectedId, target);
    if(res.error){ refuse(res.error); return; }
    nodeMsgHtml = '';
    persist();
    addLog(LOG, `**Connection** — ${md(nodeName(sel()))} (point ${res.link.as}) ↔ ${md(nodeName(nodeById(sheet, target)))} (point ${res.link.bs}).`);
    renderActive();
  });
  const dupBtn = document.getElementById('btnNodeDuplicate');
  if(dupBtn) dupBtn.addEventListener('click', () => {
    const copy = nodeDuplicate(s(), nodeSelectedId);
    if(!copy) return;
    nodeSelectedId = copy.id;
    persist();
    addLog(LOG, `**Node duplicated** — ${md(nodeName(copy))}.`);
    renderActive();
  });
  const elimBtn = document.getElementById('btnNodeEliminate');
  if(elimBtn) elimBtn.addEventListener('click', () => {
    const n = sel();
    if(!confirm(`Eliminate "${nodeName(n)}"? Its Connections are removed.`)) return;
    nodeEliminate(s(), n.id);
    nodeLastWalk = null;
    persist();
    addLog(LOG, `**Node eliminated** — ${md(nodeName(n))} is no longer in play.`);
    renderActive();
  });
  const delBtn = document.getElementById('btnNodeDelete');
  if(delBtn) delBtn.addEventListener('click', () => {
    const n = sel();
    if(!confirm(`Delete "${nodeName(n)}" and its Connections?`)) return;
    nodeDelete(s(), n.id);
    nodeSelectedId = null;
    nodeLastWalk = null;
    persist();
    addLog(LOG, `**Node deleted** — ${md(nodeName(n))}.`);
    renderActive();
  });
  const doneBtn = document.getElementById('btnNodeDeselect');
  if(doneBtn) doneBtn.addEventListener('click', () => { nodeSelectedId = null; nodePendingSlot = null; renderActive(); });

  /* ---- Options (collapsible; its fields exist only while open) ---- */
  document.getElementById('btnNodeOptionsToggle').addEventListener('click', () => { nodeOptionsOpen = !nodeOptionsOpen; renderActive(); });
  [['nodeOptDynamic', 'dynamicDie'], ['nodeOptRandomSlots', 'randomSlots'], ['nodeOptAltered', 'alteredInfluence']].forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if(el) el.addEventListener('change', () => { s()[key] = el.checked; persist(); renderActive(); });
  });
  const focusSel = document.getElementById('nodeOptFocus');
  if(focusSel) focusSel.addEventListener('change', () => { s().focusMode = focusSel.value; persist(); renderActive(); });
}
