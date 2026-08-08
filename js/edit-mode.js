/* Local-only live editor: whole-page text editing, JSON data editing, a
   resizable figure/text boxes, and a publish button.
   Does nothing at all unless the page is served from localhost/127.0.0.1 AND
   tools/dev_server.py (not a plain static server) is the one serving it.
   Never active on the deployed site. */

(function () {
  "use strict";

  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocal) return;

  // Elements populated at runtime by main.js from data/*.json — excluded from
  // the editable region (both from being typed into and from what gets saved
  // into index.html) since their real content lives in those JSON files.
  const DYNAMIC_IDS = [
    "heroLinks",
    "pubList",
    "pendingList",
    "experienceList",
    "educationList",
    "skillsGrid",
    "awardList",
    "contactLinks",
    "footerName"
  ];
  const DYNAMIC_PLACEHOLDERS = {
    heroLinks: "<!-- injected by main.js -->",
    pubList: "<!-- injected by main.js -->",
    pendingList: "<h3>In progress</h3>\n      <!-- injected by main.js -->",
    experienceList: "<!-- injected -->",
    educationList: "<!-- injected -->",
    skillsGrid: "<!-- injected -->",
    awardList: "<!-- injected -->",
    contactLinks: "<!-- injected -->",
    footerName: ""
  };

  const DATA_FILES = [
    "site.json",
    "publications.json",
    "publications-pending.json",
    "experience.json",
    "education.json",
    "skills.json",
    "awards.json"
  ];

  let editing = false;
  let dirty = false;
  let publishing = false;

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  const panel = el(`
    <div id="localEditor" style="
      position:fixed; right:16px; bottom:16px; z-index:1000;
      font-family:'IBM Plex Mono', monospace; font-size:12px;
      background:#16181B; color:#ECE8DD; border:1px solid #3A3D43;
      padding:10px 12px; display:flex; flex-direction:column; gap:6px;
      width:420px; max-width:calc(100vw - 32px); max-height:calc(100vh - 32px);
      overflow:auto; box-shadow:0 4px 16px rgba(0,0,0,0.3);">

      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span style="opacity:0.6;">LOCAL EDITOR</span>
        <button id="editCollapseBtn" type="button" title="Collapse/expand" style="
          font:inherit; cursor:pointer; background:none; color:#ECE8DD;
          border:1px solid #3A3D43; padding:2px 6px;">–</button>
      </div>

      <div id="editorBody" style="display:flex; flex-direction:column; gap:8px;">
        <div>
          <div style="opacity:0.55; margin-bottom:4px;">PAGE TEXT</div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button id="editToggleBtn" type="button" style="
              font:inherit; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; padding:4px 8px;">Enable editing</button>
            <button id="editSaveBtn" type="button" disabled style="
              font:inherit; cursor:pointer; background:#A8551E; color:#fff;
              border:1px solid #A8551E; padding:4px 8px; opacity:0.4;">Save</button>
          </div>
          <div style="opacity:0.45; font-size:10.5px; margin-top:4px;">
            Every heading/paragraph on the page becomes editable. Drag the
            bottom-right corner of figure boxes or text blocks to resize —
            resizing sets a fixed size that won't shrink for small screens,
            so check mobile after resizing anything.
          </div>
        </div>

        <div>
          <div style="opacity:0.55; margin-bottom:4px;">DATA FILES (publications, experience, etc.)</div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select id="dataFileSelect" style="
              font:inherit; background:#0F1114; color:#ECE8DD; border:1px solid #3A3D43;
              padding:4px 6px;">
              <option value="">Choose a file…</option>
            </select>
            <button id="saveJsonBtn" type="button" disabled style="
              font:inherit; cursor:pointer; background:#A8551E; color:#fff;
              border:1px solid #A8551E; padding:4px 8px; opacity:0.4;">Save JSON</button>
          </div>
          <textarea id="jsonEditor" spellcheck="false" style="
            display:none; width:100%; margin-top:6px; box-sizing:border-box;
            font-family:inherit; font-size:11px; background:#0F1114; color:#ECE8DD;
            border:1px solid #3A3D43; padding:6px; resize:vertical;"
            rows="12"></textarea>
        </div>

        <div>
          <div style="opacity:0.55; margin-bottom:4px;">PUBLISH</div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <input id="commitMsgInput" type="text" placeholder="Update site content" style="
              font:inherit; background:#0F1114; color:#ECE8DD; border:1px solid #3A3D43;
              padding:4px 6px; width:170px;">
            <button id="publishBtn" type="button" style="
              font:inherit; cursor:pointer; background:#2C6E49; color:#fff;
              border:1px solid #2C6E49; padding:4px 8px;">Publish to GitHub</button>
          </div>
        </div>

        <div id="editStatus" style="opacity:0.85; min-height:1em;"></div>
        <pre id="publishLog" style="
          display:none; margin:0; max-height:160px; overflow:auto; white-space:pre-wrap;
          background:#0F1114; border:1px solid #3A3D43; padding:6px; font-size:11px;"></pre>
      </div>
    </div>
  `);

  DATA_FILES.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    panel.querySelector("#dataFileSelect").appendChild(opt);
  });

  const style = document.createElement("style");
  style.textContent = `
    .editor-leaf {
      outline: 1px dashed rgba(168,85,30,0.5);
      outline-offset: 2px;
      cursor: text;
    }
    .editor-leaf:focus {
      outline: 2px solid #A8551E;
      background: rgba(168,85,30,0.06);
    }
    .editor-leaf.is-dirty {
      background: rgba(168,85,30,0.1);
    }
  `;

  function setStatus(msg, isError) {
    const s = panel.querySelector("#editStatus");
    s.textContent = msg;
    s.style.color = isError ? "#E0684A" : "#8FBF7F";
  }

  function setLog(text) {
    const pre = panel.querySelector("#publishLog");
    if (!text) {
      pre.style.display = "none";
      pre.textContent = "";
    } else {
      pre.style.display = "block";
      pre.textContent = text;
    }
  }

  function setSaveEnabled(enabled) {
    const btn = panel.querySelector("#editSaveBtn");
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? "1" : "0.4";
  }

  // Tags safe to leave inline inside a leaf (bold/italic/etc within running
  // text) without treating them as separately-editable units of their own.
  const PASSTHROUGH_INLINE = new Set(["STRONG", "EM", "SUB", "SUP", "BR", "CODE", "B", "I"]);

  function isPassthroughOnly(el) {
    return Array.from(el.children).every((c) => PASSTHROUGH_INLINE.has(c.tagName));
  }

  // Walk the editable region and find the smallest sensible editable units:
  // an element with only text/inline-formatting content becomes one leaf
  // (its own separate contentEditable island, so Ctrl+A only ever selects
  // that one heading/paragraph/label — never the whole page). Elements that
  // group several such leaves (nav lists, fact rows, spec tables, ...) are
  // recursed into instead of being made editable themselves.
  function collectLeaves(root) {
    const leaves = [];
    function walk(node) {
      let foundInside = false;
      Array.from(node.children).forEach((child) => {
        if (DYNAMIC_IDS.includes(child.id)) return;
        if (child.id === "localEditor") return;
        if (child.textContent.trim() === "") return; // decorative/empty, nothing to edit
        if (isPassthroughOnly(child)) {
          leaves.push(child);
          foundInside = true;
          return;
        }
        const before = leaves.length;
        walk(child);
        if (leaves.length === before) {
          // Nothing editable found deeper in — fall back to this container
          // itself so its text isn't silently unreachable.
          leaves.push(child);
        }
        foundInside = true;
      });
      return foundInside;
    }
    walk(root);
    return leaves;
  }

  function toggleEditing() {
    editing = !editing;
    document.body.classList.toggle("local-editing", editing);
    const root = document.getElementById("editableRoot");

    if (editing) {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {
        /* best-effort; harmless if unsupported */
      }
      const leaves = collectLeaves(root);
      leaves.forEach((leaf) => {
        leaf.contentEditable = "true";
        leaf.classList.add("editor-leaf");
        leaf.addEventListener("input", onLeafInput);
      });
    } else {
      root.querySelectorAll(".editor-leaf").forEach((leaf) => {
        leaf.contentEditable = "false";
        leaf.classList.remove("editor-leaf");
        leaf.removeEventListener("input", onLeafInput);
      });
    }

    panel.querySelector("#editToggleBtn").textContent = editing ? "Disable editing" : "Enable editing";
    if (!editing) setSaveEnabled(false);
  }

  function onLeafInput(e) {
    e.target.classList.add("is-dirty");
    dirty = true;
    setSaveEnabled(true);
  }

  function buildSaveableHtml() {
    const clone = document.getElementById("editableRoot").cloneNode(true);
    DYNAMIC_IDS.forEach((id) => {
      const node = clone.querySelector("#" + id);
      if (node) node.innerHTML = DYNAMIC_PLACEHOLDERS[id];
    });
    // Local-editor-only attributes/classes on every leaf; resize-drag inline
    // width/height on .figure-frame/.hero-content/etc. are kept as-is.
    clone.querySelectorAll(".editor-leaf").forEach((leaf) => {
      leaf.removeAttribute("contenteditable");
      leaf.classList.remove("editor-leaf", "is-dirty");
      if (!leaf.getAttribute("class")) leaf.removeAttribute("class");
    });
    // main.js adds is-broken/has-image at runtime depending on whether a
    // figure image currently loads — transient state, not something to
    // freeze into the saved source (it would wrongly hide a real image
    // added later, or show a stale placeholder for one removed later).
    clone.querySelectorAll(".figure-frame img.is-broken").forEach((img) => {
      img.classList.remove("is-broken");
      if (!img.getAttribute("class")) img.removeAttribute("class");
    });
    clone.querySelectorAll(".figure-frame.has-image").forEach((frame) => {
      frame.classList.remove("has-image");
      if (!frame.getAttribute("class")) frame.removeAttribute("class");
    });
    return clone.outerHTML;
  }

  async function saveChanges() {
    setStatus("Saving…", false);
    try {
      const res = await fetch("/__save__", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: buildSaveableHtml() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      dirty = false;
      setSaveEnabled(false);
      setStatus("Saved ✓ — refresh to see the clean version", false);
      return true;
    } catch (err) {
      setStatus(
        "Save failed — are you running tools/dev_server.py (not a plain static server)? " + err.message,
        true
      );
      return false;
    }
  }

  async function loadJsonFile(filename) {
    const textarea = panel.querySelector("#jsonEditor");
    const saveBtn = panel.querySelector("#saveJsonBtn");
    if (!filename) {
      textarea.style.display = "none";
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.4";
      return;
    }
    try {
      const res = await fetch("data/" + filename, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      textarea.value = JSON.stringify(JSON.parse(text), null, 2);
      textarea.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      setStatus(`Loaded ${filename}`, false);
    } catch (err) {
      setStatus("Couldn't load " + filename + ": " + err.message, true);
    }
  }

  async function saveJsonFile() {
    const select = panel.querySelector("#dataFileSelect");
    const textarea = panel.querySelector("#jsonEditor");
    const filename = select.value;
    if (!filename) return;

    let parsed;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (err) {
      setStatus("Invalid JSON — " + err.message, true);
      return;
    }

    setStatus(`Saving ${filename}…`, false);
    try {
      const res = await fetch("/__save-json__", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: filename, data: parsed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(`Saved ${filename} ✓ — refresh to see it live`, false);
    } catch (err) {
      setStatus("Save failed: " + err.message, true);
    }
  }

  async function publishChanges() {
    if (publishing) return;

    if (dirty) {
      const saved = await saveChanges();
      if (!saved) return;
    }

    publishing = true;
    const btn = panel.querySelector("#publishBtn");
    btn.disabled = true;
    btn.style.opacity = "0.5";
    setLog("");
    setStatus("Publishing to GitHub…", false);

    const message = panel.querySelector("#commitMsgInput").value.trim();

    try {
      const res = await fetch("/__publish__", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.nothing_to_publish) {
        setStatus("Nothing to publish — no changes since the last commit.", false);
      } else {
        setStatus("Published ✓ — live in a minute or two.", false);
        panel.querySelector("#commitMsgInput").value = "";
      }
      if (data.log) setLog(data.log);
    } catch (err) {
      setStatus("Publish failed: " + err.message, true);
    } finally {
      publishing = false;
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(panel);
    document.head.appendChild(style);

    panel.querySelector("#editToggleBtn").addEventListener("click", toggleEditing);
    panel.querySelector("#editSaveBtn").addEventListener("click", saveChanges);
    panel.querySelector("#publishBtn").addEventListener("click", publishChanges);
    panel.querySelector("#dataFileSelect").addEventListener("change", (e) => loadJsonFile(e.target.value));
    panel.querySelector("#saveJsonBtn").addEventListener("click", saveJsonFile);

    const collapseBtn = panel.querySelector("#editCollapseBtn");
    const body = panel.querySelector("#editorBody");
    collapseBtn.addEventListener("click", () => {
      const collapsed = body.style.display === "none";
      body.style.display = collapsed ? "flex" : "none";
      collapseBtn.textContent = collapsed ? "–" : "+";
    });

    if (new URLSearchParams(window.location.search).get("edit") === "1") {
      toggleEditing();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
