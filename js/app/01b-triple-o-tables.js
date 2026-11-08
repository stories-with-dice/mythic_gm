/* =========================================================================
   TRIPLE-O TABLES  (Triple-O: The Player Character Emulator, v1.0.2)
   -------------------------------------------------------------------------
   Transcribed from "Triple-O" by Cezar Capacle (Critical Kit Ltd, 2026).
   The text of Triple-O is licensed CC BY-SA 4.0
   (https://creativecommons.org/licenses/by-sa/4.0/), so the tables in this
   file are shared under CC BY-SA 4.0 too (see NOTICE.md). They are not
   under this project's CC BY-NC 4.0 license.

   Every table is a d66 roll: two d6, tens die first (11..66), 36 rows in
   order 11,12,..16,21,..66. The rows are registered as editable random
   tables (RANDOM_TABLES, 01-data-tables.js) with `sides: 36`: the tab turns
   the d66 into 1..36 with tripleOIndex(), so tableEntry() maps one number
   to one row, and an edited table with more or fewer rows still works.
   This file loads right after 01, before 03 reads RANDOM_TABLES.
   ========================================================================= */

// Spark tables: abstract words to interpret (Action + Focus is the usual pair).
const TRIPLE_O_ACTION = [
  "Abort", "Advance", "Aim", "Block", "Break", "Challenge",
  "Climb", "Collide", "Combat", "Concentrate", "Consolidate", "Coordinate",
  "Cover", "Deceive", "Deflect", "Delve", "Destroy", "Dodge",
  "Endure", "Force", "Grab", "Help", "Impact", "Intensify",
  "Invest", "Knock down", "Lose", "Oppose", "Penetrate", "Persevere",
  "Probe", "Protect", "Retreat", "Separate", "Stun", "Surprise"
];
const TRIPLE_O_FOCUS = [
  "Advantage", "Ally", "Balance", "Barrier", "Chance", "Control",
  "Courage", "Damage", "Defense", "Determination", "Environment", "Fear",
  "Ferocity", "Focus", "Impulse", "Instinct", "Maneuver", "Object",
  "Opening", "Position", "Posture", "Power", "Precision", "Pride",
  "Reach", "Resource", "Senses", "Speed", "Strategy", "Strength",
  "Subtlety", "Technique", "Weakness", "Weapon", "Wits", "Wound"
];
const TRIPLE_O_METHOD = [
  "Adaptation", "Agility", "Camouflage", "Coercion", "Cunning", "Deception",
  "Distraction", "Fear", "Guile", "Imitation", "Improvisation", "Ingenuity",
  "Instinct", "Intimidation", "Knowledge", "Magic", "Manipulation", "Observation",
  "Patience", "Persistence", "Resilience", "Sacrifice", "Scheming", "Sorcery",
  "Speed", "Stealth", "Strategy", "Strength", "Subterfuge", "Surprise",
  "Technology", "Tenacity", "Terrain", "Trickery", "Violence", "Weapons"
];
const TRIPLE_O_DISPOSITION = [
  "Aggressive", "Aloof", "Ambivalent", "Antagonistic", "Bold", "Cautious",
  "Cheerful", "Confident", "Cooperative", "Curious", "Defensive", "Detached",
  "Dismissive", "Distrustful", "Eager", "Enthusiastic", "Friendly", "Guarded",
  "Helpful", "Hostile", "Indifferent", "Inquisitive", "Interested", "Inviting",
  "Open", "Optimistic", "Pessimistic", "Reluctant", "Resentful", "Respectful",
  "Suspicious", "Sympathetic", "Timid", "Uninterested", "Warm", "Wary"
];
const TRIPLE_O_MOTIVATION = [
  "Ambition", "Anger", "Atonement", "Betrayal", "Challenge", "Curiosity",
  "Despair", "Duty", "Empathy", "Envy", "Faith", "Fear",
  "Greed", "Guilt", "Hate", "Honor", "Hope", "Ideology",
  "Justice", "Knowledge", "Legacy", "Love", "Loyalty", "Mastery",
  "Obsession", "Passion", "Pride", "Regret", "Rivalry", "Sacrifice",
  "Shame", "Sorrow", "Survival", "Thrill", "Tradition", "Vengeance"
];
const TRIPLE_O_DYNAMICS = [
  "Admiring", "Affectionate", "Amused", "Comfortable", "Competitive", "Conflicted",
  "Contemptuous", "Deferential", "Defiant", "Dependent", "Disappointed", "Distant",
  "Envious", "Exasperated", "Fascinated", "Grateful", "Guilty", "Indifferent",
  "Inspired", "Intimidated", "Intrigued", "Judgmental", "Loyal", "Observant",
  "Patronizing", "Protective", "Resentful", "Respectful", "Skeptical", "Supportive",
  "Suspicious", "Sympathetic", "Teasing", "Threatened", "Trusting", "Uneasy"
];
const TRIPLE_O_APPROACHES = [
  "Aggressively", "Carefully", "Cheerfully", "Clumsily", "Covertly", "Daringly",
  "Decisively", "Desperately", "Diplomatically", "Directly", "Discreetly", "Dramatically",
  "Efficiently", "Erratically", "Frantically", "Gently", "Grudgingly", "Hastily",
  "Hesitantly", "Honestly", "Impulsively", "Indirectly", "Intuitively", "Lazily",
  "Loudly", "Methodically", "Naively", "Nervously", "Patiently", "Playfully",
  "Precisely", "Quietly", "Recklessly", "Reluctantly", "Ruthlessly", "Stubbornly"
];

// Specific tables: concrete actions for one kind of situation (zine text, v1.0.2).
const TRIPLE_O_COMBAT = [
  "Aim carefully, wait for an opening", "Attack directly with primary weapon", "Attack with secondary weapon",
  "Attempt to disarm the enemy", "Attempt to flee", "Call for a combined action",
  "Call for parley", "Cast a spell or use a special ability", "Change elevation (climb, jump)",
  "Charge recklessly", "Create difficult terrain or obstacles", "Destroy enemy cover or resources",
  "Distract or mislead", "Draw attention/taunt the enemy", "Drop your weapons/surrender",
  "Fall back and regroup", "Flank or reposition", "Force movement (push, pull, reposition)",
  "Grapple or restrain an opponent", "Heal, buff, or protect an ally", "Help or assist an ally’s action",
  "Hold position and guard", "Improvise a weapon", "Look for a weakness",
  "Make a feint or fake attack", "Rally/inspire to boost morale", "Ready an action to respond to a trigger",
  "Set up an ambush or trap", "Switch weapons or tactics", "Take cover or duck behind something",
  "Target a leader or key figure", "Try to intimidate or scare them off", "Use a consumable item",
  "Use environment to their advantage", "Withdraw or disengage safely", "Yell a warning or call for help"
];
const TRIPLE_O_SOCIAL = [
  "Appeal to emotion", "Appeal to logic", "Appeal to rules, laws, or customs",
  "Appeal to their values or beliefs", "Apply leverage/blackmail", "Ask probing questions",
  "Bluff or exaggerate", "Bribe or offer incentive", "Challenge to a duel, contest, or wager",
  "Compliment or flatter someone", "Confide a secret", "Directly inquire about a piece of information",
  "Empathize with their situation or feelings", "Exploit rivalries or conflicting interests", "Give a gift or token of goodwill",
  "Haggle over price or terms", "Invoke shared values, traditions, or history", "Invoke status, rank, or reputation",
  "Make a concession to move talks", "Misdirect or change the subject", "Name-drop important connections",
  "Offer a trade or bargain", "Offer help or assistance", "Perform/entertain to win favor",
  "Pretend to agree", "Promise something uncertain", "Read the room for mood and dynamics",
  "Set and enforce boundaries", "Share a personal story or vulnerability", "Speak honestly and openly",
  "Stay silent and observe", "Tell a joke or lighten the mood", "Try to charm or impress",
  "Try to find common ground", "Try to read their intentions", "Use threats or a show of force"
];
const TRIPLE_O_EXPLORATION = [
  "Assess the terrain ahead", "Check for traps or hazards", "Climb or seek vantage point",
  "Collect specimens or samples", "Cover tracks", "Document discoveries",
  "Forage for food, water, or supplies", "Hold back and observe", "Hunt or fish",
  "Leave messages or signs", "Listen for echoes/water/wind/animals", "Look for magical or strange phenomena",
  "Look for shelter from the elements", "Look for signs of civilization", "Look for tracks or signs of passage",
  "Map or mark the area", "Navigate by stars/sun/landmarks", "Observe wildlife patterns for clues",
  "Produce source of light or heat", "Propose a change in marching order or pace", "Propose a short rest",
  "Rush to cover more ground", "Scout ahead carefully", "Search for hidden paths",
  "Send a companion or summoned being ahead", "Stand guard or keep watch", "Stay alert and move slowly",
  "Study the weather", "Suggest to press on for longer", "Suggest to split up the group",
  "Take a risk to save time", "Test the air or water", "Test the ground or depth",
  "Try a different route", "Try to identify a plant, creature, or landmark", "Use a specialized instrument"
];
const TRIPLE_O_DELVING = [
  "Adjust formation or spacing", "Backtrack to a previous junction", "Check for pressure plates or tripwires",
  "Check for recent signs of passage or presence", "Check the ceiling for hazards or instability", "Climb or take the high ground",
  "Collect samples", "Cover tracks or conceal presence", "Create a distraction, lure, or decoy",
  "Document findings and warnings", "Examine remains or debris for clues", "Examine the structure for weaknesses",
  "Feel for air currents or temperature changes", "Follow an unexplored route", "Hide in the shadows or a crawlspace",
  "Listen at a door, wall, or passage", "Look for creature tracks, territorial signs, or lair markings", "Map the layout and connections",
  "Mark your path to avoid going in circles", "Peek into a room using a mirror or tool", "Probe the floor or walls with a pole",
  "Push recklessly onward", "Rally the group for a breather", "Scout ahead of the party",
  "Seal, block, or barricade an entry", "Search for hidden doors, passages, or mechanisms", "Search for hidden loot or cached supplies",
  "Search for inscriptions, carvings, or symbols", "Send a familiar or summoned creature ahead first", "Send a light source ahead",
  "Sense for magical residues", "Set tripwires, alarms, or warning markers", "Sniff the air for gas, smoke, rot, or chemicals",
  "Study architecture for purpose, origin, logic, or age", "Tend to wounds, fatigue, or morale", "Toss something ahead to test a room"
];
const TRIPLE_O_INTERPRETATION = [
  "Believe it’s a trap or test", "Believe they are being lied to or deceived", "Connect it to a larger pattern",
  "Dismiss it as a distraction or misdirection", "Feel a strong sense of personal duty or responsibility", "Feel distrust or suspicion",
  "Feel intense, unfiltered curiosity or fascination", "Feel nostalgia or déjà vu", "Feel overwhelmed",
  "Get a strong gut feeling that something is wrong", "Interpret it as a symbolic message or warning", "Misinterpret the situation entirely",
  "Misjudge the intentions of others", "Obsess over one detail", "Overanalyze every detail",
  "Rationalize it away", "Read it as a bad omen or a dark portent", "Recognize something as valuable or useful",
  "See connections to previous events", "See hidden danger or threat", "See it as a challenge or provocation",
  "Seize it as the perfect chance to act", "Sense opportunity or advantage", "Suspect a hidden reward or secret is nearby",
  "Suspect an ambush", "Take it as an invitation or welcome", "Take it at face value",
  "Take it personally", "Think it’s a coincidence", "Think it’s a performance or an act",
  "Treat it as a key clue to a larger mystery", "Treat it as fate or destiny", "Trust intuition over logic",
  "Try to read between the lines", "View it as a puzzle that needs to be solved", "View it as an audition or chance to impress"
];
const TRIPLE_O_DOWNTIME = [
  "Admit a fear or weakness", "Ask an ally for advice on a personal dilemma", "Ask someone about their motives",
  "Compare beliefs or philosophies", "Confess a secret, a lie, or a hidden motive", "Confide a lingering doubt",
  "Cook, share food, or offer a drink with intention", "Debate a moral choice", "Discuss long-term dreams for when the journey ends",
  "Express admiration or gratitude", "Express homesickness or longing", "Gamble or play a game of chance or skill",
  "Grieve something lost", "Indulge in a personal coping mechanism or vice", "Inquire about an ally’s homeland or family",
  "Offer comfort or encouragement", "Ponder about the true nature of their enemies", "Practice a skill or hobby",
  "Pray, meditate, or observe a personal tradition", "Propose a solemn pact", "Question the group’s direction or purpose",
  "Rally the group with a speech or toast", "Share a cultural ritual, song, or saying", "Share a keepsake or memento and its story",
  "Share a story from their childhood", "Share rumors or speculation", "Sing, play music, or perform for the group",
  "Suggest a change in plans", "Talk about a dream you once had", "Talk about someone you left behind",
  "Tease, joke, or try to lighten the mood", "Tell a story of failure or glory", "Tend to wounds or worn gear",
  "Try to teach an ally a minor skill, trick, or phrase", "Wander off alone into the dark", "Write, sketch, or record thoughts"
];
const TRIPLE_O_PLANNING = [
  "Avoid confrontation entirely", "Call in a favor or old debt", "Consult omens, divination, or spiritual guidance",
  "Contact or negotiate with a potential ally/faction", "Debate moral/ethical/practical costs", "Defer to the party’s leader",
  "Eliminate a specific threat first", "Follow instinct and improvise", "Gather more local rumors or intel",
  "Hire local help or muscle", "Learn the local terrain", "Look for a local contact, fence, informant, or insider",
  "Make final personal preparations", "Pivot to a secondary lead", "Plan a distraction or diversion",
  "Prepare healing or protective measures", "Propose a high-stakes gamble", "Push for a direct, immediate strike",
  "Question the entire mission’s purpose", "Repair, upgrade, enchant, or modify equipment", "Rest and recover before acting",
  "Restock and audit supplies", "Scrap the plan and start over", "Seek an expert, sage, guide, or specialist",
  "Send someone undercover", "Set a trap or ambush", "Set signals, code words, or fallback points",
  "Share previously withheld knowledge", "Split the party", "Study maps, charts, myths, or historical records",
  "Train or practice a specific skill/tactic", "Use bribery or social leverage", "Volunteer for the dangerous part",
  "Volunteer to scout ahead alone", "Wait for better timing/weather/specific event", "Warn of a potential trap"
];

// Table key → label, kind ('spark' | 'specific') and when to use it. The keys
// are RANDOM_TABLES keys (`to` prefix), so a campaign can edit every table.
const TRIPLE_O_TABLES = [
  { key:'toAction',         label:'Action',         kind:'spark',    rows:TRIPLE_O_ACTION,         use:'What they do right now.' },
  { key:'toFocus',          label:'Focus',          kind:'spark',    rows:TRIPLE_O_FOCUS,          use:'What they pay attention to.' },
  { key:'toMethod',         label:'Method',         kind:'spark',    rows:TRIPLE_O_METHOD,         use:'How they approach problems.' },
  { key:'toDisposition',    label:'Disposition',    kind:'spark',    rows:TRIPLE_O_DISPOSITION,    use:'Their mood or attitude.' },
  { key:'toMotivation',     label:'Motivation',     kind:'spark',    rows:TRIPLE_O_MOTIVATION,     use:'What drives them: goals, desires, fears.' },
  { key:'toDynamics',       label:'Dynamics',       kind:'spark',    rows:TRIPLE_O_DYNAMICS,       use:'How they feel about another character.' },
  { key:'toApproaches',     label:'Approaches',     kind:'spark',    rows:TRIPLE_O_APPROACHES,     use:'The manner of an action.' },
  { key:'toCombat',         label:'Combat',         kind:'specific', rows:TRIPLE_O_COMBAT,         use:'What a character does during a fight.' },
  { key:'toSocial',         label:'Social',         kind:'specific', rows:TRIPLE_O_SOCIAL,         use:'A conversation with a goal in mind.' },
  { key:'toExploration',    label:'Exploration',    kind:'specific', rows:TRIPLE_O_EXPLORATION,    use:'Travel, scouting or searching in open terrain.' },
  { key:'toDelving',        label:'Delving',        kind:'specific', rows:TRIPLE_O_DELVING,        use:'A dungeon, ruin, cave or other dangerous enclosed place.' },
  { key:'toInterpretation', label:'Interpretation', kind:'specific', rows:TRIPLE_O_INTERPRETATION, use:'Something that needs reading: a remark, a clue, a strange sign.' },
  { key:'toDowntime',       label:'Downtime',       kind:'specific', rows:TRIPLE_O_DOWNTIME,       use:'Resting, camping or killing time.' },
  { key:'toPlanning',       label:'Planning',       kind:'specific', rows:TRIPLE_O_PLANNING,       use:'Somewhere safe, deciding the next move.' }
];
const TRIPLE_O_TABLE_BY_KEY = Object.fromEntries(TRIPLE_O_TABLES.map(t => [t.key, t]));

TRIPLE_O_TABLES.forEach(t => {
  const def = { key:t.key, group:'Triple-O', label:`${t.label} (d66, ${t.kind === 'spark' ? 'spark' : 'specific'} table)`, sides:36, rows:t.rows, usedBy:`Triple-O tab. ${t.use}` };
  RANDOM_TABLES.push(def);
  RANDOM_TABLE_BY_KEY[def.key] = def;
});

// A d66 pair (tens, ones) → 1..36, the row number in the order above.
function tripleOIndex(tens, ones){ return (tens - 1) * 6 + ones; }
