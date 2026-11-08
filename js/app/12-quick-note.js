/* =========================================================================
   QUICK NOTE (rich Markdown editor via EasyMDE — Enter commits a note to the log)
   ========================================================================= */
let noteMDE = null;
function renderNoteSection(){
  const host = document.getElementById('noteSection');
  host.innerHTML = `
  <h2 class="tool-title">Quick Note</h2>
  <p class="tool-desc">Jot anything in Markdown — session notes, an aside, a reminder. Enter adds it to the Campaign Log; Shift+Enter starts a new line.</p>
  <textarea id="noteEditor"></textarea>
  `;
  wireNoteSection();
}
function wireNoteSection(){
  if(noteMDE){ try{ noteMDE.toTextArea(); }catch(e){} noteMDE = null; }
  noteMDE = new EasyMDE({
    element: document.getElementById('noteEditor'),
    autofocus: false,
    spellChecker: false,
    autoDownloadFontAwesome: false,
    status: false,
    minHeight: "100px",   // fits the right column (EasyMDE default: 300px)
    placeholder: "Write a note in Markdown…",
    toolbar: ["bold","italic","strikethrough","heading","|","quote","unordered-list","ordered-list","table","|","link","code","horizontal-rule","|","preview"],
    shortcuts: { toggleFullScreen: null, toggleSideBySide: null }
  });
  const existingKeys = noteMDE.codemirror.getOption("extraKeys") || {};
  noteMDE.codemirror.setOption("extraKeys", Object.assign({}, existingKeys, {
    "Enter": function(cm){
      const text = noteMDE.value().trim();
      if(!text) return;
      addLog('Note', text);
      noteMDE.value('');
    },
    "Shift-Enter": "newlineAndIndent"
  }));
}
