/* =========================================================================
   DICE / MARKDOWN UTILS
   ========================================================================= */
// Every die in the app goes through rollDie(). While a user action runs,
// `diceCapture` (21d-dice-roll.js) is an array, and each roll is recorded in
// it for the 3D dice. The first roll covers the page at once (diceCaptureStarted()).
let diceCapture = null;
function rollDie(sides){
  const r = 1 + Math.floor(Math.random()*sides);
  if(diceCapture){
    diceCapture.push({ sides, value: r });
    if(diceCapture.length === 1 && typeof diceCaptureStarted === 'function') diceCaptureStarted();
  }
  return r;
}
function pad2(n){ return n<10 ? "0"+n : ""+n; }
function timestamp(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function escapeMd(s){ return (s||"").replace(/\|/g,"\\|"); }
// True while an IME (Japanese, Chinese, Korean input) composes text: the
// Enter that confirms a candidate must not submit. Safari sends that keydown
// after compositionend (isComposing false), so keyCode 229 catches it.
function isComposing(e){ return e.isComposing || e.keyCode === 229; }
function escapeAttr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
