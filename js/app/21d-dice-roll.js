/* =========================================================================
   3D DICE ROLLS  (the app side of the rpg-dice-3d library)
   -------------------------------------------------------------------------
   The 3D dice, their skins and their sound are the rpg-dice-3d library
   (js/vendor/rpg-dice-3d/: window.RpgDice3D, RpgDiceSound, RpgDice; a
   vendored copy, see AGENTS.md "Vendor libraries").
   -------------------------------------------------------------------------
   Every user action that rolls dice shows them as 3D dice first:
     1. A click, an Enter key or a change starts a capture (diceActionStart(),
        capture phase on window): `diceCapture` (02) becomes an array.
     2. rollDie() records each roll in it. The first roll covers the page
        (RpgDice3D.cover(): a blurred backdrop), so no frame shows the result
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
const DICE_PALETTE = { mythic:'indigo', classic:'ivory', fantasy:'gold', sf:'sapphire', horror:'crimson' };

// skin: 'theme' (the skin in DICE_PALETTE for the current theme), a
// RpgDice3D.SKIN_IDS id, or 'random' (a random skin for every die). The old
// ids 'wood' and 'nebula' (before the library) read as 'oak' and 'galaxy'.
function diceSkinId(id){
  if(id === 'theme' || id === 'random') return id;
  const sk = window.RpgDice3D && typeof id === 'string' ? RpgDice3D.skin(id) : null;
  return sk ? sk.id : null;
}
function diceSkinOk(id){ return !!diceSkinId(id); }
function loadDiceConfig(){
  const def = { enabled: true, sound: true, skin: 'theme' };
  try{
    const v = JSON.parse(localStorage.getItem(DICE_KEY));
    return v && typeof v === 'object'
      ? { enabled: v.enabled !== false, sound: v.sound !== false, skin: diceSkinId(v.skin) || 'theme' }
      : def;
  }catch(_){ return def; }
}
let diceConfig = loadDiceConfig();
function saveDiceConfig(){ try{ localStorage.setItem(DICE_KEY, JSON.stringify(diceConfig)); }catch(_){} }

// rolls: [{sides, value}] -> the dice for RpgDice3D.throwDice()
// (RpgDice.dieToDice3D). A d100 is a tens die and a units die
// (00 + 0 = 100). Sizes without a 3D shape are a coin with the number on top.
function diceForRolls(rolls){
  const out = [];
  rolls.forEach((r, i) => {
    RpgDice.dieToDice3D(r.sides, r.value).forEach(d => out.push(Object.assign(d, { group: i })));
  });
  return out.slice(0, DICE_MAX);
}

function diceMotionOk(){
  try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return true; }
}
function diceActive(){ return diceConfig.enabled && diceMotionOk() && typeof window.RpgDice3D !== 'undefined'; }

// Called by rollDie() (02) on the first roll of an action.
function diceCaptureStarted(){ if(diceActive()) RpgDice3D.cover(); }

function diceActionStart(e){
  if(diceCapture || !diceActive()) return;
  if(e.type === 'keydown' && e.key !== 'Enter') return;
  if(e.target && e.target.closest && e.target.closest('.rpg-dice3d, #settingsOverlay')) return;
  diceCapture = [];
  setTimeout(diceActionEnd, 0);
}
// The skin for every die: the chosen one, or the theme's.
function diceSkin(){
  if(diceConfig.skin !== 'theme' && diceConfig.skin !== 'random' && RpgDice3D.skin(diceConfig.skin)) return diceConfig.skin;
  return DICE_PALETTE[document.documentElement.dataset.theme || 'classic'] || 'ivory';
}
// "Random": each die gets its own random skin.
function diceSkinned(list){
  if(diceConfig.skin !== 'random') return list;
  const ids = RpgDice3D.SKIN_IDS;
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
  if(diceConfig.sound && window.RpgDiceSound) RpgDiceSound.context();   // still in the user's action: the browser allows audio
  diceLastRun = RpgDice3D.throwDice(diceSkinned(diceForRolls(rolls)), {
    skin: diceSkin(),
    sound: diceConfig.sound,
    size: 70,
    backdrop: true,        // a blurred backdrop until the reveal (cover() showed it already)
    skipOnClick: true,     // a click on the dice skips to the landing
    revealDelay: 0.35,
    hold: 1.6,
    onSettled: reveal
  });
  if(!diceLastRun) RpgDice3D.uncover();   // no WebGL: show the result at once
}
// Escape skips to the landing while the dice roll.
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && window.RpgDice3D && RpgDice3D.isRolling()){ e.stopPropagation(); RpgDice3D.skip(); }
}, true);
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
        ${RpgDice3D.SKINS.map(s => `<option value="${s.id}">${escapeAttr(s.label)}</option>`).join('')}
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
