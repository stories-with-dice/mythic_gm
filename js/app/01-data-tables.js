/* =========================================================================
   DATA TABLES  (transcribed from the Mythic One-Page GM Emulator cheat sheet)
   ========================================================================= */

// --- Discover Meaning (Action / Description), 50 paired rows covering 1-100
const DISCOVER_ACTION = "Attain,Benefit,Betray,Break,Burden,Change,Character,Communicate,Competition,Conclude,Conflict,Control,Create,Danger,Deceit,Decrease,Delay,Distant,Emotions,Enemies,Environment,Expectations,Failure,Fears,Fight,Gain,Goals,Good,Harm,Help,Increase,Information,Leave,Move,Mundane,Nature,Negative,NPC,Object,Obstacle,Official,PC,Positive,Progress,Setback,Start,Stop,Strange,Surprise,Uncertain".split(",");
const DISCOVER_DESC = "Artificial,Beautiful,Bleak,Bright,Clean,Cold,Colorful,Damaged,Dangerous,Dark,Dirty,Disagreeable,Empty,Extravagant,Feeble,Fragrant,Frightening,Full,Healthy,Heavy,Helpful,Important,Incomplete,Lacking,Large,Light,Loud,Mechanical,Modern,Mundane,Mysterious,Natural,New,Official,Old,Peaceful,Perfect,Powerful,Quiet,Reassuring,Rotten,Rough,Ruined,Rustic,Simple,Small,Strange,Stylish,Valuable,Warm".split(",");
function discoverWord(roll, col){ // col: 'action' or 'desc'; reads the campaign's editable copy
  return tableEntry(col==='action' ? 'meaningAction' : 'meaningDesc', roll);
}

// --- Ask the Game Master odds table: [ExceptionalYesMax, YesMax, NoMax] (ExceptionalNo fills to 100)
const ASK_ODDS = {
  "Certain":            [18,90,98],
  "Nearly Certain":     [17,85,97],
  "Very Likely":        [15,75,95],
  "Likely":             [13,65,93],
  "50/50 or Unknown":   [10,50,90],
  "Unlikely":           [7,35,87],
  "Very Unlikely":      [5,25,85],
  "Nearly Impossible":  [3,15,83],
  "Impossible":         [2,10,82]
};
function askTheGM(oddsKey, roll){
  const [ey,y,n] = ASK_ODDS[oddsKey];
  let answer;
  if(roll<=ey) answer="Exceptional Yes";
  else if(roll<=y) answer="Yes";
  else if(roll<=n) answer="No";
  else answer="Exceptional No";
  const isDouble = roll%11===0 && roll>=11 && roll<=99;
  return {answer, isDouble};
}

// --- Adventure Crafter: Plot Points table. Columns: Action,Tension,Mystery,Social,Personal
// Rows 1-8 Conclusion, 9-16 None (all columns), then 42 paired rows 17-18..99-100
const PLOT_ROWS = [
"Abduction|Betrayal|Alternate|Agreement|Animosity",
"Ambush|Catastrophe|Behavior|Alliance|Betrayal",
"Attack|Choice|Clue|Argument|Bribe",
"Barrier|Coercion|Connected|Celebration|Coercion",
"Battle|Crime|Crime|Community|Connection",
"Catastrophe|Damage|Cryptic|Confrontation|Dependent",
"Chase|Death|Death|Disagreement|Depowered",
"Collateral|Depletion|Disappearance|Duplicitous|Desperate",
"Competition|Diminishment|Discovery|Enemies|Diminishment",
"Conflict|Disappearance|Duplicitous|Fame|Disarmed",
"Confrontation|Enemy|Emergency|Gathering|Duty",
"Crash|Escape|Evidence|Government|Enemies",
"Culmination|Explore|Explore|Headquarters|Ethical",
"Damage|Guarded|Exposed|Inadequate|Family",
"Destroy|Horror|Fraud|Injustice|Flee",
"Destruction|Impending|Information|Innocence|Friend",
"Distraction|Incapacitation|Intercept|Leader|Headquarters",
"Emergency|Intimidation|Law|Lie|Help",
"Escape|Law|Lie|Meeting|Home",
"Frenetic|Location|Lucky|Misbehave|Humiliation",
"Guarded|Night|Misled|Mundane|Incapacitation",
"Harm|Public|Motivation|Observer|Innocence",
"Intensify|Pursued|Object|Organization|Mundane",
"Intervention|Recurrence|Observer|Outcast|Obligation",
"Lethal|Remote|Reappearance|Outside|Observer",
"Location|Repercussion|Resource|Preparation|Offer",
"Object|Resource|Revelation|Protect|Past",
"Peace|Revenge|Secret|Reinforcements|Personal",
"Physical|Risky|Solved|Religion|Persuasion",
"Progress|Rural|Source|Revenge|Possession",
"Protect|Shady|Stop|Rural|Power",
"Pursued|Strange|Strange|Savior|Preparation",
"Rescue|Survivor|Suspicion|Scapegoat|Protect",
"Risky|Suspicion|Theft|Servant|Protected",
"Stop|Threat|Theory|Special|Pursued",
"Strange|Trapped|Threat|Suspicion|Repercussion",
"Survivor|Travel|Unexpected|Tension|Revenge",
"Theft|Ultimatum|Unknown|Transaction|Scapegoat",
"Travel|Unknown|Unlikely|Travel|Schism",
"Turnabout|Urban|Unusual|Trouble|Servant",
"Urgency|Urgency|Useful|Urban|Talk",
"Victory|Vulnerability|Vulnerability|Work|Ultimatum"
].map(r=>r.split("|"));
const THEMES = ["Action","Tension","Mystery","Social","Personal"];
const PLOT_TABLE_KEYS = ["plotAction","plotTension","plotMystery","plotSocial","plotPersonal"]; // RANDOM_TABLES keys, same order as THEMES
function themeFromD10(d10){ return THEMES[Math.floor((d10-1)/2)]; } // 1-2,3-4,...9-10
function plotPointWord(themeIdx, roll){ // themeIdx 0-4, roll 1-100
  if(roll<=8) return "Conclusion";
  if(roll<=16) return "None";
  return tableEntry(PLOT_TABLE_KEYS[themeIdx], roll); // rows 17-100, editable per campaign
}

// --- Location Crafter
const LOCATION_DESCRIPTORS = "Abandoned,Active,Artistic,Atmosphere,Average,Beautiful,Bizarre,Bleak,Bright,Business,Clean,Clothing,Clue,Cold,Colorful,Colorless,Communication,Complicated,Consumable,Container,Cramped,Creepy,Crude,Damaged,Dangerous,Dark,Deactivated,Deliberate,Desired,Domestic,Empty,Enclosed,Energy,Equipment,Expended,Familiar,Flora,Fortunate,Fragile,Fragrant,Frightening,Full,Guidance,Healing,Helpful,Important,Impressive,Inactive,Large,Light,Lonely,Loud,Meaningful,Mechanical,Messy,Moving,Multiple,Mundane,Mysterious,Natural,New,Occupied,Odd,Official,Old,Open,Ornate,Peaceful,Personal,Portal,Powerful,Prized,Protected,Protection,Purposeful,Quiet,Rare,Ready,Reassuring,Resource,Rustic,Simple,Small,Stolen,Storage,Strange,Stylish,Suspicious,Tall,Threatening,Tool,Unpleasant,Useful,Useless,Valuable,Warm,Warning,Watery,Weapon,Welcoming".split(",");
function areaElement(v){ // v = 1d10+PP
  if(v<=1) return {el:"Expected"};
  if(v===2) return {el:"Location Descriptor", d:"location"};
  if(v===3) return {el:"Encounter Descriptor", d:"encounter"};
  if(v===4) return {el:"Object Descriptor", d:"object"};
  if(v===5) return {el:"Positive Descriptor", d:"positive"};
  if(v===6) return {el:"Expected, Return"};
  if(v===7) return {el:"Location Descriptor", d:"location"};
  if(v===8) return {el:"Encounter Descriptor", d:"encounter"};
  if(v===9) return {el:"Object Descriptor", d:"object"};
  if(v===10) return {el:"Negative Descriptor", d:"negative"};
  if(v===11) return {el:"Expected"};
  if(v===12) return {el:"Location Descriptor", d:"location"};
  if(v===13) return {el:"Encounter Descriptor", d:"encounter"};
  if(v===14) return {el:"Object Descriptor", d:"object"};
  if(v===15) return {el:"Expected, Exit"};
  if(v===16) return {el:"Expected"};
  if(v===17) return {el:"Expected, Complete"};
  return {el:"Expected, PP-6"};
}

// --- Creature Crafter
const CREATURE_DESCRIPTORS = "Amorphous,Amphibious,Animal,Aquatic,Arachnid,Armed,Armored,Artificial,Avian,Beautiful,Brutish,Carapace,Clawed,Clothed,Cold,Colorful,Composite,Crawling,Creepy,Damaged,Dangerous,Decrepit,Delicate,Dirty,Domesticated,Elements,Energy,Equipped,Eyes,Fangs,Fragrant,Frightening,Fungal,Furry,Gaunt,Glowing,Graceful,Group,Growling,Heavy,Horns,Humanoid,Insectlike,Intelligent,Intimidating,Laden,Large,Leathery,Lethal,Levitating,Limbs,Loud,Mammalian,Mandibles,Markings,Mechanical,Metallic,Mighty,Mouth,Movement,Multiple,Muscular,Mysterious,Natural,Nightmarish,Obscured,Pale,Plant,Powered,Powerful,Reptilian,Scales,Shambling,Silent,Sinister,Slow,Small,Solitary,Spiked,Stationary,Steaming,Sticky,Stinger,Strange,Tail,Tall,Tentacled,Tongue,Toothy,Transparent,Twisted,Unnatural,Verbal,Warm,Watery,Weak,Weapon,Wings,Wormish,Young".split(",");
const ABILITY_WORDS = "Absorb,Attach,Attack,Bypass,Change,Chemical,Cloud,Cold,Conceal,Constrain,Control,Counteract,Create,Damage,Deceive,Defense,Destroy,Detect,Distance,Duplicate,Elements,Emission,Energy,Environment,Extra,Fast,Fire,Flight,Heal,Heat,Illness,Light,Mental,Minor,Object,Pain,Perception,Poison,Radius,Resistance,Skill,Stealth,Strange,Strength,Stun,Summon,Suppress,Travel,Water,Weakness".split(",");
function abilityWord(roll){ return tableEntry('creatureAbilities', roll); }
const INITIAL_BEHAVIOR = {1:"Inert, motionless",2:"Moving, traveling",3:"Moving, traveling",4:"Wary and alert",5:"Friendly",6:"Attacking, aggressive",7:"Feeding",8:"Working, doing something",9:"Defensive, protecting itself",10:"Exhibits an Ability"};
const NEW_BEHAVIOR_TEXT = {
  low:"The creature acts as you expect, or continues doing what it was doing if you don't have an expectation.",
  mid:"The creature's activity proceeds to the next expected step, or it continues what it's doing but with greater intensity.",
  nine:"Roll again on Initial Behavior for the creature's next action.",
  ten:"The creature exhibits an Ability."
};
function newBehaviorResult(v){
  if(v<=6) return NEW_BEHAVIOR_TEXT.low;
  if(v<=8) return NEW_BEHAVIOR_TEXT.mid;
  if(v===9) return NEW_BEHAVIOR_TEXT.nine;
  return NEW_BEHAVIOR_TEXT.ten;
}
const STAT_MOD = {1:"About 50% lower",2:"About 25% lower",3:"About 25% lower",4:"What you expect",5:"What you expect",6:"What you expect",7:"What you expect",8:"About 25% higher",9:"About 25% higher",10:"About 50% higher"};

// --- Character Crafter
const CHARACTER_DESCRIPTORS = "Academic,Aggressive,Agile,Artistic,Athletic,Authority,Awareness,Bizarre,Block,Body,Brave,Charm,Cheat,Collector,Combat,Common,Communication,Community,Comprehension,Conflict,Connection,Control,Create,Crude,Dangerous,Dark,Deceptive,Defense,Detect,Domestic,Education,Elements,Elite,Emotion,Endurance,Enemy,Energy,Enhanced,Entertain,Environment,Equipment,Exceptional,Executive,Experienced,Fast,Find,Finesse,Force,Guard,Guide,Harm,Heal,Helpful,Heritage,Heroic,Information,Insight,Intimidating,Knowledge,Lethal,Limitation,Locate,Medical,Melee,Military,Mind,Move,Mundane,Mysterious,Nature,Object,Obstacle,Offense,Official,Old,Outsider,Perception,Performance,Power,Practical,Principles,Professional,Ranged,Rare,Reflexes,Religion,Repair,Resistant,Resource,Responsibility,Rogue,Science,Senses,Social,Strange,Strong,Take,Technology,Travel,Weapon".split(",");
const NPC_STAT_MOD = {1:"Weaken the value a lot",2:"Weaken the value a little",3:"Weaken the value a little",4:"Use the value you expect",5:"Use the value you expect",6:"Use the value you expect",7:"Use the value you expect",8:"Strengthen the value a little",9:"Strengthen the value a little",10:"Strengthen the value a lot"};
// NPC Behavior Context (1d100): 20 rows of 5 numbers each. A 10-number band
// (1-10 … 31-40) is two equal rows.
const BEHAVIOR_CONTEXT = [
  "Based on Identity Keywords","Based on Identity Keywords",
  "Based on Mind Keywords","Based on Mind Keywords",
  "Based on Body Keywords","Based on Body Keywords",
  "Based on Talent Keywords","Based on Talent Keywords",
  "Helps themself","Is helpful","Causes harm","Gives something, item or information",
  "Opposes PC","Seeks something","Protects something","Expresses an emotion",
  "Is confused or undecided","Acts strangely or unexpectedly","Tries to take something",
  "Tries to end the encounter"
];
function behaviorContext(roll){ return tableEntry('npcBehavior', roll); }

// --- Mystery Matrix
const MYSTERY_DESCRIPTORS = "Accident,Aggressive,Ambition,Anger,Attack,Betray,Bribe,Business,Change,Clothing,Code,Communication,Conflict,Container,Control,Cooperation,Damage,Danger,Deliberate,Deny,Desperate,Discarded,Discover,Dispute,Document,Domicile,Emotion,Empty,Enemy,Equipment,Fake,Family,Fear,Find,Flee,Friend,Give,Goal,Greed,Group,Harm,Hate,Help,Helpful,Hidden,Hurt,Inform,Information,Jealousy,Leadership,Legal,Lethal,Lies,Location,Locked,Lost,Love,Loyal,Mechanical,Misfortune,Missing,Mistake,Motive,Mundane,Mysterious,Nature,New,Night,NPC,Obligation,Old,Partial,PC,Personal,Plot,Portal,Possession,Power,Protect,Rare,Representative,Resource,Rumor,Science,Strange,Surprise,Suspicious,Take,Technology,Threaten,Tool,Travel,Trust,Unusual,Valuable,Vehicle,Vengeance,Wealth,Weapon,Witness".split(",");
function mysteryElement(total){ // total = 1d100 + boxCount
  if(total<=15) return "nothing";
  if(total<=35) return "newClue";
  if(total<=50) return "newSuspect";
  if(total<=70) return "newConnectedClue";
  if(total<=80) return "newConnectedSuspect";
  if(total<=100) return "connectExisting";
  return "clincher";
}
function pickDie(n){
  const sizes=[4,6,8,10,12,20];
  for(const s of sizes) if(s>=n) return s;
  return 20;
}

// --- Scene Adjustment Table, rows 1-6 (Mythic GME 2e; 7-10 = two adjustments,
// see sceneAdjustment() in 14-tab-mythic-gme.js)
const SCENE_ADJUSTMENTS = [
  'Remove A Character', 'Add A Character', 'Reduce/Remove An Activity',
  'Increase An Activity', 'Remove An Object', 'Add An Object'
];

/* -------------------------------------------------------------------------
   EDITABLE RANDOM TABLES
   Every table whose rows are plain text for the player to read. The campaign
   keeps a copy only of the tables the user changed, in campaign().tables
   ({ key: [string] }, sanitizeTables() in 03); tableList(key) falls back to
   the default above. The Settings modal (21-settings.js) edits them.

   A roll keeps the die the rules give (`sides`), and the rows share the
   numbers above `offset` evenly: 50 rows on 1d100 = 2 numbers per row, as on
   the cheat sheet. A repeated row is more likely. Tables whose rows drive the
   app's logic (Ask the GM odds, Location / Mystery / Crisis elements, Player
   Emulator ratings, Node focus) are not in this list.
   ------------------------------------------------------------------------- */
const RANDOM_TABLE_MAX_ROWS = 300;
const RANDOM_TABLE_MAX_LEN = 200;
const tableTenFaces = obj => Array.from({ length: 10 }, (_, i) => obj[i + 1]);
const RANDOM_TABLES = [
  { key:'meaningAction',       group:'Meaning Tables', label:'Actions',                     sides:100, rows:DISCOVER_ACTION,       usedBy:'Game Master (Discover Meaning, Random Event), Mythic GME, Published Adventures, 3-Act Story, Node Narratives' },
  { key:'meaningDesc',         group:'Meaning Tables', label:'Descriptions',                sides:100, rows:DISCOVER_DESC,         usedBy:'Game Master (Discover Meaning, Random Event), Mythic GME, Published Adventures, 3-Act Story, Node Narratives' },
  { key:'sceneAdjustments',    group:'Mythic GME',     label:'Scene Adjustment Table (rows 1-6)', sides:6, rows:SCENE_ADJUSTMENTS, usedBy:'Mythic GME and Node Narratives, for an Altered Scene (rolls 7-10 make two adjustments from this list)' },
  ...THEMES.map((t, i) => ({ key:PLOT_TABLE_KEYS[i], group:'Adventure Crafter', label:`Plot Points: ${t}`, sides:100, offset:16, rows:PLOT_ROWS.map(r => r[i]), usedBy:`Adventure Crafter, ${t} theme (rolls 1-8 = Conclusion and 9-16 = None stay fixed)` })),
  { key:'locationDescriptors', group:'Location Crafter', label:'Descriptors',               sides:100, rows:LOCATION_DESCRIPTORS,  usedBy:'Location Crafter, Explore Area' },
  { key:'creatureDescriptors', group:'Creature Crafter', label:'Descriptors',               sides:100, rows:CREATURE_DESCRIPTORS,  usedBy:'Creature Crafter, Creature Features' },
  { key:'creatureAbilities',   group:'Creature Crafter', label:'Abilities',                 sides:100, rows:ABILITY_WORDS,         usedBy:'Creature Crafter, Ability (and Behavior roll 10)' },
  { key:'creatureStatMod',     group:'Creature Crafter', label:'Statistics',                sides:10,  rows:tableTenFaces(STAT_MOD),    usedBy:'Creature Crafter, Statistic' },
  { key:'creatureBehavior',    group:'Creature Crafter', label:'Initial Behavior',          sides:10,  rows:tableTenFaces(INITIAL_BEHAVIOR), usedBy:'Creature Crafter, Initial Behavior (a roll of 10 also rolls an Ability)' },
  { key:'characterDescriptors',group:'Character Crafter', label:'Descriptors',              sides:100, rows:CHARACTER_DESCRIPTORS, usedBy:'Character Crafter, Identity / Mind / Body / Talent' },
  { key:'npcStatMod',          group:'Character Crafter', label:'NPC Statistics',           sides:10,  rows:tableTenFaces(NPC_STAT_MOD), usedBy:'Character Crafter, NPC Statistic' },
  { key:'npcBehavior',         group:'Character Crafter', label:'NPC Behavior Context',     sides:100, rows:BEHAVIOR_CONTEXT,      usedBy:'Character Crafter, Behavior Context' },
  { key:'mysteryDescriptors',  group:'Mystery Matrix',   label:'Descriptors',               sides:100, rows:MYSTERY_DESCRIPTORS,   usedBy:'Mystery Matrix, new Clues and Suspects' }
];
const RANDOM_TABLE_BY_KEY = Object.fromEntries(RANDOM_TABLES.map(t => [t.key, t]));

// One row of user text: a string, trimmed, without < or > (rows are shown as
// HTML on the tabs), at most RANDOM_TABLE_MAX_LEN characters. '' = drop it.
function cleanTableRow(s){
  return typeof s === 'string' ? s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, RANDOM_TABLE_MAX_LEN) : '';
}
// A clean list, or null when nothing usable is left.
function cleanTableRows(arr){
  if(!Array.isArray(arr)) return null;
  const rows = arr.map(cleanTableRow).filter(Boolean).slice(0, RANDOM_TABLE_MAX_ROWS);
  return rows.length ? rows : null;
}
function sameTableRows(a, b){ return a.length === b.length && a.every((v, i) => v === b[i]); }

// The rows the current campaign uses for table `key`: its own copy, else the default.
function tableList(key){
  const def = RANDOM_TABLE_BY_KEY[key];
  const c = (typeof STORE !== 'undefined' && STORE) ? campaign() : null;
  const own = c && c.tables && typeof c.tables === 'object' ? cleanTableRows(c.tables[key]) : null;
  return own || def.rows;
}
// The row a roll lands on. The numbers offset+1..sides are shared evenly by the rows.
function tableEntry(key, roll){
  const def = RANDOM_TABLE_BY_KEY[key];
  const rows = tableList(key);
  const off = def.offset || 0;
  const i = Math.ceil((roll - off) * rows.length / (def.sides - off)) - 1;
  return rows[Math.max(0, Math.min(rows.length - 1, i))];
}
