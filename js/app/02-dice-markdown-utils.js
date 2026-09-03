/* =========================================================================
   DICE / MARKDOWN UTILS
   ========================================================================= */
function rollDie(sides){ return 1 + Math.floor(Math.random()*sides); }
function pad2(n){ return n<10 ? "0"+n : ""+n; }
function timestamp(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function escapeMd(s){ return (s||"").replace(/\|/g,"\\|"); }
function escapeAttr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
