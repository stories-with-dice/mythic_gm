/* Node Narratives tab (17b-tab-node-narratives.js) plus its gme.nodeSheet
   state model / sanitiser (03-state-persistence.js). Mythic Magazine #71. */

describe('Node Narratives tab', () => {

  beforeEach(() => { resetApp(); showTab('nodes'); });

  const sheet = () => campaign().gme.nodeSheet;
  const addNode = (type, text) => {
    setValue('#nodeNewType', type);
    setValue('#nodeNewText', text);
    click('#btnNodeAdd');
    return sheet().nodes[sheet().nodes.length - 1];
  };
  // Fixed d8 rolls for nodeWalk(): consumed in order.
  const rolls = seq => { let i = 0; return () => seq[i++]; };
  // A hand-built sheet: nodes as [id, type, text, scene], links as [a, as, b, bs].
  const build = (nodes, links) => {
    const s = freshNodeSheet();
    s.nodes = nodes.map(([id, type, text, scene], i) => ({ id, type, text, scene: scene || null, cell: i, eliminated: false }));
    s.links = links.map(([a, as, b, bs]) => ({ a, as, b, bs }));
    s.nextId = nodes.length + 1;
    return s;
  };

  describe('placement + render', () => {
    it('is registered as a tab, after 3-Act Story', () => {
      const idx = TABS.findIndex(t => t.id === 'nodes');
      expect(idx).toBeGreaterThan(-1);
      expect(TABS[idx - 1].id).toBe('threeAct');
    });
    it('renders an empty sheet, and the ? shows the intro with the flowchart', () => {
      expect($('#panelHost')).toContain('Node Based Narratives');
      expect($('#nodeBoard')).toBeTruthy();
      expect($$('#nodeBoard .node-box')).toHaveLength(0);
      click('#panelHost [data-intro-toggle]');
      expect(document.querySelector('#panelHost .tool-intro-more .pub-flow')).toBeTruthy();
    });
    it('makes a sheet for a campaign saved before this tab existed', () => {
      delete campaign().gme.nodeSheet;
      showTab('nodes');
      expect(sheet()).toEqual(freshNodeSheet());
    });
  });

  describe('tables', () => {
    it('Node Random Event Focus Table bands', () => {
      const r = n => nodeFocusResult('node', [], n).result;
      expect(r(1)).toBe('Remote Event');
      expect(r(10)).toBe('Ambiguous Event');
      expect(r(11)).toBe('New NPC');
      expect(r(21)).toBe('Influence Node');
      expect(r(70)).toBe('Influence Node');
      expect(r(71)).toBe('PC Negative');
      expect(r(85)).toBe('PC Positive');
      expect(r(86)).toBe('Current Context');
      expect(nodeFocusResult('node', [], 50).influence).toBe(true);
      expect(nodeFocusResult('node', [], 15).influence).toBe(false);
    });
    it('the campaign table reads NPC and Thread results (not New NPC) as Influence Node', () => {
      const t = defaultEventFocus();
      expect(nodeFocusResult('campaign', t, 30)).toEqual({ result: 'NPC Action', influence: true });
      expect(nodeFocusResult('campaign', t, 60)).toEqual({ result: 'Move Away From A Thread', influence: true });
      expect(nodeFocusResult('campaign', t, 70)).toEqual({ result: 'Close A Thread', influence: true });
      expect(nodeFocusResult('campaign', t, 15)).toEqual({ result: 'New NPC', influence: false });
      expect(nodeFocusResult('campaign', t, 90)).toEqual({ result: 'Current Context', influence: false });
    });
    it('movement die: d4, or the Dynamic Node Die Range by Scene number', () => {
      expect(nodeMovementDie(30, false)).toBe(4);
      expect([1, 5, 6, 7, 8, 9, 10, 11, 12, 19, 20, 99].map(n => nodeMovementDie(n, true)))
        .toEqual([4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 20, 20]);
    });
    it('Thread and Character Nodes only Connect to Scene and Event Nodes', () => {
      expect(nodeCanConnect('thread', 'character')).toBe(false);
      expect(nodeCanConnect('character', 'character')).toBe(false);
      expect(nodeCanConnect('thread', 'event')).toBe(true);
      expect(nodeCanConnect('scene', 'event')).toBe(true);
    });
  });

  describe('moving along Connections (nodeWalk)', () => {
    // MM #71 p.20: start at Scene 3, d4 = 4; Scene 2 rolls 1 and counts on
    // past the start Node to Scene 1; then 6 = Emily, then 1 = the Event.
    const shallowRock = () => build(
      [[1, 'scene', 'Party', 1], [2, 'scene', 'Chased', 2], [3, 'scene', 'Wright', 3],
       [4, 'character', 'Emily Wright'], [5, 'event', 'Whispering shadow'], [6, 'thread', 'What is the Shadow?']],
      [[3, 6, 2, 2], [2, 4, 1, 8], [1, 6, 4, 2], [1, 2, 5, 6], [4, 1, 5, 5], [2, 6, 6, 1]]);

    it('follows the magazine example to the Influence Node', () => {
      const w = nodeWalk(shallowRock(), 3, 4, rolls([1, 6, 1]));
      expect(w.moves.map(m => m.to)).toEqual([2, 1, 4, 5]);
      expect(w.moves[0].d8).toBe(null);               // one usable Connection: no roll
      expect(w.moves[1].checked).toEqual([1, 2, 3, 4]); // 2 leads back to the start: skipped
      expect(w.end).toBe(5);
      expect(w.stop).toBe('');
    });
    it('can double back, but never to the starting Scene Node', () => {
      const w = nodeWalk(shallowRock(), 3, 3, rolls([6, 8]));
      expect(w.moves.map(m => m.to)).toEqual([2, 6, 2]);
      expect(w.moves.every(m => m.to !== 3)).toBe(true);
    });
    it('no Connection from the start: no Influence Node', () => {
      const w = nodeWalk(build([[1, 'scene', 'x', 1]], []), 1, 3);
      expect(w.stop).toBe('noLinks');
      expect(w.end).toBe(null);
    });
    it('a dead end stops the walk on that Node', () => {
      const s = build([[1, 'scene', 'a', 1], [2, 'scene', 'b', 2], [3, 'character', 'c']], [[2, 6, 1, 2], [2, 4, 3, 8]]);
      const w = nodeWalk(s, 2, 4, rolls([4]));
      expect(w.moves.map(m => m.to)).toEqual([3]);
      expect(w.stop).toBe('deadEnd');
      expect(w.end).toBe(3);
    });
  });

  describe('sheet helpers', () => {
    it('a full Node (8 points) refuses a 9th Connection', () => {
      const s = freshNodeSheet();
      nodeAdd(s, 'scene', 'Busy', 1);
      for (let i = 0; i < 8; i++) expect(nodeAdd(s, 'character', 'NPC ' + i, 1).error).toBe('');
      const res = nodeAdd(s, 'character', 'One too many', 1);
      expect(res.error).toContain('Duplicate the Node');
      expect(res.link).toBe(null);
      expect(nodeFreeSlots(s, s.nodes[0].id)).toEqual([]);
    });
    it('the random-point rule rolls d8 and counts on to a free point', () => {
      const s = build([[1, 'scene', 'a', 1], [2, 'event', 'b'], [3, 'event', 'c']], [[1, 3, 2, 1]]);
      expect(nodePickSlot(s, s.nodes[0], s.nodes[2], true, () => 3)).toBe(4);
      expect(nodePickSlot(s, s.nodes[0], s.nodes[2], true, () => 8)).toBe(8);
    });
    it('eliminating a Character removes its Connections; Scenes cannot be eliminated', () => {
      const s = freshNodeSheet();
      nodeAdd(s, 'scene', 'S', 1);
      const c = nodeAdd(s, 'character', 'Gone', 1).node;
      expect(nodeEliminate(s, s.nodes[0].id)).toBe(false);
      expect(nodeEliminate(s, c.id)).toBe(true);
      expect(c.eliminated).toBe(true);
      expect(s.links).toHaveLength(0);
      expect(nodeConnectError(s, s.nodes[0], c)).toContain('eliminated');
    });
  });

  describe('sanitizeNodeSheet', () => {
    it('falls back to a fresh sheet for junk, and sanitizeCampaign(null) has one', () => {
      expect(sanitizeNodeSheet(null)).toEqual(freshNodeSheet());
      expect(sanitizeNodeSheet('x')).toEqual(freshNodeSheet());
      expect(sanitizeCampaign(null).gme.nodeSheet).toEqual(freshNodeSheet());
    });
    it('drops bad Nodes, dedupes ids and boxes, and keeps nextId above every id', () => {
      const s = sanitizeNodeSheet({
        nodes: [
          { id: 4, type: 'scene', text: 'A', scene: 0, cell: 2 },
          { id: 4, type: 'event', text: 'B', cell: 2 },
          { id: 9, type: 'monster', text: 'C' },
          null,
          { id: 'x', type: 'thread', text: 5, eliminated: true }
        ],
        nextId: 1, focusMode: 'nope', alteredInfluence: 'yes', dynamicDie: 1
      });
      expect(s.nodes.map(n => n.type)).toEqual(['scene', 'event', 'thread']);
      expect(new Set(s.nodes.map(n => n.id)).size).toBe(3);
      expect(new Set(s.nodes.map(n => n.cell)).size).toBe(3);
      expect(s.nodes[0].scene).toBe(1);
      expect(s.nodes[1].scene).toBe(null);
      expect(s.nodes[2].text).toBe('');
      expect(s.nodes[2].eliminated).toBe(true);
      expect(s.nextId).toBeGreaterThan(Math.max(...s.nodes.map(n => n.id)));
      expect(s.focusMode).toBe('node');
      expect(s.alteredInfluence).toBe(true);
      expect(s.dynamicDie).toBe(true);
    });
    it('drops Connections the rules do not allow', () => {
      const s = sanitizeNodeSheet({
        nodes: [
          { id: 1, type: 'scene', scene: 1, cell: 0 }, { id: 2, type: 'character', cell: 1 },
          { id: 3, type: 'thread', cell: 2 }, { id: 4, type: 'character', cell: 3, eliminated: true }
        ],
        links: [
          { a: 1, as: 1, b: 2, bs: 5 },   // ok
          { a: 2, as: 1, b: 3, bs: 1 },   // character - thread
          { a: 1, as: 1, b: 3, bs: 2 },   // point 1 of Node 1 already used
          { a: 2, as: 2, b: 1, bs: 3 },   // the same pair again
          { a: 1, as: 9, b: 3, bs: 2 },   // no point 9
          { a: 1, as: 4, b: 4, bs: 2 },   // eliminated Node
          { a: 1, as: 4, b: 1, bs: 5 },   // to itself
          { a: 1, as: 6, b: 77, bs: 1 },  // missing Node
          { a: 1, as: 7, b: 3, bs: 3 }    // ok
        ]
      });
      expect(s.links).toEqual([{ a: 1, as: 1, b: 2, bs: 5 }, { a: 1, as: 7, b: 3, bs: 3 }]);
    });
  });

  describe('the tab UI', () => {
    it('Add Node: the first Scene Node, then an Origin Connection for each new Node', () => {
      const scene = addNode('scene', 'Investigate a murder.');
      expect(scene.scene).toBe(1);
      const celeste = addNode('character', 'Celeste, the daughter and heir.');
      expect(sheet().links).toHaveLength(1);
      expect(nodeLinksOf(sheet(), celeste.id)[0].other).toBe(scene.id);
      expect($$('#nodeBoard .node-box')).toHaveLength(2);
      expect($$('#nodeBoard .node-line')).toHaveLength(1);
      expect(lastLog().section).toBe('Node Narratives');
      expect(lastLog().md).toContain('Origin Connection to Scene 1');
    });
    it('a Node added before the Scene has one creates the Scene Node first', () => {
      addNode('event', 'Possible secret plotting.');
      expect(sheet().nodes.map(n => n.type)).toEqual(['scene', 'event']);
      expect(lastLog().md).toContain('created the Scene 1 Node first');
    });
    it('a second Scene Node for the same Scene is refused; after End Scene it Connects to the last one', () => {
      addNode('scene', 'One');
      addNode('scene', 'Again');
      expect(sheet().nodes).toHaveLength(1);
      expect($('#panelHost')).toContain('Scene 1 already has a Node');
      click('#btnNodeEndScene');
      expect(campaign().gme.sceneNumber).toBe(2);
      const two = addNode('scene', 'Two');
      expect(two.scene).toBe(2);
      expect(nodeLinksOf(sheet(), two.id).map(x => x.other)).toEqual([sheet().nodes[0].id]);
    });
    it('clicking two points draws a Connection on exactly those points', () => {
      addNode('scene', 'S');
      const ev = addNode('event', 'E');
      const th = addNode('thread', 'T');
      const linkCount = sheet().links.length;
      click(`[data-node-slot="${ev.id}:3"]`);
      expect($(`[data-node-slot="${ev.id}:3"]`).classList.contains('pending')).toBe(true);
      click(`[data-node-slot="${th.id}:7"]`);
      expect(sheet().links).toHaveLength(linkCount + 1);
      expect(sheet().links[linkCount]).toEqual({ a: ev.id, as: 3, b: th.id, bs: 7 });
      expect(lastLog().md).toContain('point 3');
    });
    it('a Thread-to-Character Connection is refused with a message', () => {
      addNode('scene', 'S');
      const th = addNode('thread', 'T');
      const ch = addNode('character', 'C');
      const before = sheet().links.length;
      const free = nodeFreeSlots(sheet(), th.id)[0];
      click(`[data-node-slot="${th.id}:${free}"]`);
      click(`[data-node-slot="${ch.id}:${nodeFreeSlots(sheet(), ch.id)[0]}"]`);
      expect(sheet().links).toHaveLength(before);
      expect($('#panelHost')).toContain('only Connect to Scene and Event Nodes');
    });
    it('the Selected Node panel: edit, Connect to, Duplicate, Eliminate, Delete', async () => {
      addNode('scene', 'S');
      const ev = addNode('event', 'Plot');
      const ch = addNode('character', 'Brandon');
      expect(nodeSelectedId).toBe(ch.id);   // a new Node is selected
      click(`[data-node-id="${ch.id}"]`);   // a click on the selected Node deselects it
      expect(nodeSelectedId).toBe(null);
      expect($('#nodeEditText')).toBeNull();
      click(`[data-node-id="${ch.id}"]`);
      expect(nodeSelectedId).toBe(ch.id);
      setValue('#nodeEditText', 'Brandon, shady bartender');
      expect(ch.text).toBe('Brandon, shady bartender');
      setValue('#nodeConnectTarget', String(ev.id));
      click('#btnNodeConnect');
      expect(nodeLinksOf(sheet(), ch.id).map(x => x.other)).toContain(ev.id);
      click('#btnNodeDuplicate');
      const copy = sheet().nodes[sheet().nodes.length - 1];
      expect(copy.text).toBe('Brandon, shady bartender');
      expect(nodeLinksOf(sheet(), copy.id)).toHaveLength(0);
      expect(nodeSelectedId).toBe(copy.id);
      click(`[data-node-id="${ch.id}"]`);
      await withDialogs({ confirm: true }, () => click('#btnNodeEliminate'));
      expect(ch.eliminated).toBe(true);
      expect(nodeLinksOf(sheet(), ch.id)).toHaveLength(0);
      expect($(`[data-node-id="${ch.id}"]`).classList.contains('eliminated')).toBe(true);
      await withDialogs({ confirm: true }, () => click('#btnNodeDelete'));
      expect(nodeById(sheet(), ch.id)).toBe(null);
      expect(nodeSelectedId).toBe(null);
    });
    it('a selected Node moves to an empty box when you click it', () => {
      const s = addNode('scene', 'S');
      expect(nodeSelectedId).toBe(s.id);
      const empty = Number($('[data-node-cell]').dataset.nodeCell);
      click(`[data-node-cell="${empty}"]`);
      expect(s.cell).toBe(empty);
    });
    it('Roll Influence Node walks from the current Scene and highlights the result', async () => {
      addNode('scene', 'S1');
      const ch = addNode('character', 'Theodore');
      await withRolls([1], () => click('#btnNodeInfluence'));   // d4 = 1
      expect($('#nodeResult')).toContain('Influence Node: Character: Theodore');
      expect($(`[data-node-id="${ch.id}"]`).classList.contains('influence')).toBe(true);
      expect($$('#nodeBoard .node-line.walk')).toHaveLength(1);
      expect(lastLog().md).toContain('**Influence Node**');
      click('#btnNodeClearWalk');
      expect($$('#nodeBoard .node-line.walk')).toHaveLength(0);
    });
    it('Roll Influence Node with no Connection says so', async () => {
      await withRolls([2], () => click('#btnNodeInfluence'));
      expect(sheet().nodes).toHaveLength(1);   // the Scene 1 Node was created
      expect($('#nodeResult')).toContain('no Influence Node');
    });
    it('the result escapes Node text', async () => {
      addNode('scene', 'S1');
      addNode('character', '<img src=x onerror=alert(1)>');
      await withRolls([1], () => click('#btnNodeInfluence'));
      expect($('#nodeResult img')).toBeNull();
      expect($('#nodeBoard img')).toBeNull();
    });
    it('scene test: Expected, Altered (Influence Node), Interrupt (Node Event Focus)', async () => {
      addNode('scene', 'S1');
      addNode('character', 'Theodore');
      await withRolls([9], () => click('#btnNodeTestScene'));          // 9 > CF 5
      expect($('#nodeSceneTestResult')).toContain('Expected Scene');
      await withRolls([3, 1], () => click('#btnNodeTestScene'));       // odd ≤ CF, d4 = 1
      expect($('#nodeSceneTestResult')).toContain('Altered Scene');
      expect($('#nodeSceneTestResult')).toContain('Influence Node: Character: Theodore');
      await withRolls([4, 30, 1, 50, 50], () => click('#btnNodeTestScene')); // even ≤ CF, d100 30
      expect($('#nodeSceneTestResult')).toContain('Interrupt Scene');
      expect($('#nodeSceneTestResult')).toContain('Event Focus (1d100: 30)');
      expect($('#nodeSceneTestResult')).toContain('Influence Node: Character: Theodore');
      expect($('#nodeSceneTestResult')).toContain('Meaning:');
    });
    it('with the Altered option off, an Altered Scene uses the Scene Adjustment Table', async () => {
      click('#btnNodeOptionsToggle');
      const cb = $('#nodeOptAltered');
      cb.checked = false; cb.dispatchEvent(new Event('change'));
      expect(sheet().alteredInfluence).toBe(false);
      await withRolls([3, 2, 1, 50], () => click('#btnNodeTestScene'));
      expect($('#nodeSceneTestResult')).toContain('Scene Adjustment');
      expect($('#nodeSceneTestResult')).not.toContain('Influence Node:');
    });
    it('Random Event: a non-Influence result has no walk, New NPC asks for a Character Node', async () => {
      await withRolls([15, 50, 50], () => click('#btnNodeRandomEvent'));
      expect($('#nodeResult')).toContain('New NPC');
      expect($('#nodeResult')).toContain('Add a Character Node');
      expect(sheet().nodes).toHaveLength(0);
    });
    it('the result of the last roll survives a re-render', async () => {
      addNode('scene', 'S1');
      addNode('character', 'Theodore');
      await withRolls([1], () => click('#btnNodeInfluence'));
      click('#btnNodeCfPlus');
      expect($('#nodeResult')).toContain('Theodore');
    });
    it('shares the Chaos Factor and Scene with the Mythic GME tab', () => {
      click('#btnNodeCfPlus');
      click('#btnNodeEndScene');
      expect(campaign().gme.chaosFactor).toBe(5);
      expect(campaign().gme.sceneNumber).toBe(2);
      showTab('gme');
      expect($('#panelHost')).toContain('Scene 2 will start');
    });
    it('the Options card: dynamic die and focus table', () => {
      expect($('#nodeOptDynamic')).toBeNull();
      click('#btnNodeOptionsToggle');
      const cb = $('#nodeOptDynamic');
      cb.checked = true; cb.dispatchEvent(new Event('change'));
      expect(sheet().dynamicDie).toBe(true);
      setValue('#nodeOptFocus', 'campaign');
      expect(sheet().focusMode).toBe('campaign');
      campaign().gme.sceneNumber = 12; persist(); showTab('nodes');
      expect($('#btnNodeInfluence').textContent).toContain('d12');
    });
  });
});
