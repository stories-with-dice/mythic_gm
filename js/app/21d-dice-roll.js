/* =========================================================================
   3D DICE ROLLS  (the app side of 21c-dice-3d.js)
   -------------------------------------------------------------------------
   Every user action that rolls dice shows them as 3D dice first:
     1. A click, an Enter key or a change starts a capture (diceActionStart(),
        capture phase on window): `diceCapture` (02) becomes an array.
     2. rollDie() records each roll in it. The first roll covers the page
        (Dice3D.cover(): a blurred backdrop), so no frame shows the result
        before the dice.
     3. After the action's handlers (setTimeout 0), diceActionEnd() turns
        the rolls into dice (diceForRolls()) and throws them.
     4. The dice land on the rolled numbers; after a short delay the backdrop
        fades and the result shows (with the .result-new highlight again).
   A click on the dice or Escape skips to the landing. With 3D dice off, with
   no WebGL, or with "reduce motion" set, the result shows at once.
   The settings are per device (localStorage, DICE_KEY), like the theme.
   ========================================================================= */
const DICE_KEY = DBX_KEY_PREFIX + 'mythicToolkit_dice';
const DICE_MAX = 20;   // at most this many dice on the table; more rolls still count
const DICE_SHAPES = { 3:'d3', 4:'d4', 5:'d5', 6:'d6', 7:'d7', 8:'d8', 10:'d10', 12:'d12', 14:'d14', 16:'d16', 20:'d20', 24:'d24', 30:'d30' };
const DICE_PALETTE = { mythic:'indigo', classic:'ivory', fantasy:'gold', sf:'sapphire', horror:'crimson' };

// skin: 'theme' (the skin in DICE_PALETTE for the current theme), a
// Dice3D.SKINS id, or 'random' (a random skin for every die).
function diceSkinOk(id){ return id === 'theme' || id === 'random' || !!(window.Dice3D && Dice3D.SKINS[id]); }
function loadDiceConfig(){
  const def = { enabled: true, sound: true, skin: 'theme' };
  try{
    const v = JSON.parse(localStorage.getItem(DICE_KEY));
    return v && typeof v === 'object'
      ? { enabled: v.enabled !== false, sound: v.sound !== false, skin: diceSkinOk(v.skin) ? v.skin : 'theme' }
      : def;
  }catch(_){ return def; }
}
let diceConfig = loadDiceConfig();
function saveDiceConfig(){ try{ localStorage.setItem(DICE_KEY, JSON.stringify(diceConfig)); }catch(_){} }

// rolls: [{sides, value}] -> the dice for Dice3D.throwDice(). A d100 is a
// tens die and a units die (00 + 0 = 100). Sizes without a 3D shape are a
// coin with the number on top.
function diceForRolls(rolls){
  const out = [];
  rolls.forEach((r, i) => {
    const v = r.value;
    if(r.sides === 100){
      const tens = Math.floor((v % 100) / 10);
      out.push({ shape:'d10t', top: tens === 0 ? '00' : `${tens}0`, pair:true, group:i, sides:100 });
      out.push({ shape:'d10u', top: String(v % 10), pair:true, group:i, sides:100 });
    } else if(DICE_SHAPES[r.sides]){
      out.push({ shape: DICE_SHAPES[r.sides], top: String(v), group:i, sides:r.sides });
    } else {
      out.push({ shape:'token', top: String(v), group:i, sides:r.sides });
    }
  });
  return out.slice(0, DICE_MAX);
}

function diceMotionOk(){
  try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return true; }
}
function diceActive(){ return diceConfig.enabled && diceMotionOk() && typeof window.Dice3D !== 'undefined'; }

// Called by rollDie() (02) on the first roll of an action.
function diceCaptureStarted(){ if(diceActive()) Dice3D.cover(); }

function diceActionStart(e){
  if(diceCapture || !diceActive()) return;
  if(e.type === 'keydown' && e.key !== 'Enter') return;
  if(e.target && e.target.closest && e.target.closest('#diceStage, #settingsOverlay')) return;
  diceCapture = [];
  setTimeout(diceActionEnd, 0);
}
// The skin for every die: the chosen one, or the theme's.
function diceSkin(){
  if(diceConfig.skin !== 'theme' && diceConfig.skin !== 'random' && Dice3D.SKINS[diceConfig.skin]) return diceConfig.skin;
  return DICE_PALETTE[document.documentElement.dataset.theme || 'classic'] || 'ivory';
}
// "Random": each die gets its own random skin.
function diceSkinned(list){
  if(diceConfig.skin !== 'random') return list;
  const ids = Dice3D.SKIN_IDS;
  return list.map(d => Object.assign({}, d, { skin: ids[Math.floor(Math.random() * ids.length)] }));
}
let diceLastRun = null;   // the last throw (tests read it)
function diceActionEnd(){
  const rolls = diceCapture || [];
  diceCapture = null;
  if(!rolls.length) return;
  // Results this action added: highlight them again when they show.
  const fresh = Array.from(document.querySelectorAll('#panelSplit .result-box.result-new'));
  const reveal = () => fresh.forEach(b => { b.classList.remove('result-new'); void b.offsetWidth; b.classList.add('result-new'); });
  diceLastRun = Dice3D.throwDice(diceSkinned(diceForRolls(rolls)), {
    palette: diceSkin(),
    sound: diceConfig.sound,
    onSettled: reveal
  });
  if(!diceLastRun) Dice3D.uncover();   // no WebGL: show the result at once
}
window.addEventListener('click', diceActionStart, true);
window.addEventListener('keydown', diceActionStart, true);
window.addEventListener('change', diceActionStart, true);

/* ----- Settings: the "Dice" section (#settingsDice) ----- */
function renderDiceSettings(){
  const host = document.getElementById('settingsDice');
  if(!host) return;
  host.innerHTML = `
    <label class="row settings-check"><input type="checkbox" id="diceEnabled" ${diceConfig.enabled ? 'checked' : ''}> <span>3D dice: throw the dice before each result</span></label>
    <label class="row settings-check"><input type="checkbox" id="diceSound" ${diceConfig.sound ? 'checked' : ''} ${diceConfig.enabled ? '' : 'disabled'}> <span>Dice sound</span></label>
    <div class="field" style="margin-top:8px;">
      <label for="diceSkin">Dice skin</label>
      <select id="diceSkin" class="field-input" ${diceConfig.enabled ? '' : 'disabled'}>
        <option value="theme">Match the theme</option>
        ${Dice3D.SKIN_IDS.map(id => `<option value="${id}">${escapeAttr(Dice3D.SKINS[id].label)}</option>`).join('')}
        <option value="random">Random (a skin for every die)</option>
      </select>
    </div>
    <div class="small-note">Click the dice or press Escape to skip to the result. With "reduce motion" set on this device, the dice do not show. Saved in this browser only.</div>`;
  document.getElementById('diceEnabled').addEventListener('change', e => { diceConfig.enabled = e.target.checked; saveDiceConfig(); renderDiceSettings(); });
  document.getElementById('diceSound').addEventListener('change', e => { diceConfig.sound = e.target.checked; saveDiceConfig(); });
  const skinSel = document.getElementById('diceSkin');
  skinSel.value = diceConfig.skin;
  skinSel.addEventListener('change', () => { diceConfig.skin = diceSkinOk(skinSel.value) ? skinSel.value : 'theme'; saveDiceConfig(); });
}
