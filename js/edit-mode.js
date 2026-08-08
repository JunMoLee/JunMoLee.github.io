/* Local-only live text editor + publish button.
   Does nothing at all unless the page is served from localhost/127.0.0.1 AND
   tools/dev_server.py (not a plain static server) is the one serving it —
   see README "Live in-browser editing". Never active on the deployed site. */

(function () {
  "use strict";

  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (!isLocal) return;

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
      max-width:420px; box-shadow:0 4px 16px rgba(0,0,0,0.3);">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="opacity:0.6;">LOCAL EDITOR</span>
        <button id="editToggleBtn" type="button" style="
          font:inherit; cursor:pointer; background:#2C2F35; color:#ECE8DD;
          border:1px solid #3A3D43; padding:4px 8px;">Enable editing</button>
        <button id="editSaveBtn" type="button" disabled style="
          font:inherit; cursor:pointer; background:#A8551E; color:#fff;
          border:1px solid #A8551E; padding:4px 8px; opacity:0.4;">Save</button>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <input id="commitMsgInput" type="text" placeholder="Update site content" style="
          font:inherit; background:#0F1114; color:#ECE8DD; border:1px solid #3A3D43;
          padding:4px 6px; width:170px;">
        <button id="publishBtn" type="button" style="
          font:inherit; cursor:pointer; background:#2C6E49; color:#fff;
          border:1px solid #2C6E49; padding:4px 8px;">Publish to GitHub</button>
      </div>
      <div id="editStatus" style="opacity:0.85; min-height:1em;"></div>
      <pre id="publishLog" style="
        display:none; margin:0; max-height:160px; overflow:auto; white-space:pre-wrap;
        background:#0F1114; border:1px solid #3A3D43; padding:6px; font-size:11px;"></pre>
    </div>
  `);

  const style = document.createElement("style");
  style.textContent = `
    body.local-editing [data-edit] {
      outline: 1px dashed rgba(168,85,30,0.55);
      outline-offset: 3px;
      cursor: text;
    }
    body.local-editing [data-edit]:focus {
      outline: 2px solid #A8551E;
      background: rgba(168,85,30,0.06);
    }
    body.local-editing [data-edit].is-dirty {
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

  function preventStructuralKeys(e) {
    // These elements are single headings/paragraphs — block Enter so browsers
    // don't inject stray <div>/<br> and break the surrounding markup.
    if (e.key === "Enter") e.preventDefault();
  }

  function toggleEditing() {
    editing = !editing;
    document.body.classList.toggle("local-editing", editing);
    document.querySelectorAll("[data-edit]").forEach((node) => {
      node.contentEditable = editing ? "true" : "false";
      if (editing) {
        node.addEventListener("keydown", preventStructuralKeys);
        node.addEventListener("input", () => {
          node.classList.add("is-dirty");
          dirty = true;
          setSaveEnabled(true);
        });
      } else {
        node.removeEventListener("keydown", preventStructuralKeys);
      }
    });
    panel.querySelector("#editToggleBtn").textContent = editing ? "Disable editing" : "Enable editing";
    if (!editing) setSaveEnabled(false);
  }

  async function saveChanges() {
    const edits = Array.from(document.querySelectorAll("[data-edit]")).map((node) => ({
      marker: node.getAttribute("data-edit"),
      tag: node.tagName.toLowerCase(),
      html: node.innerHTML.trim()
    }));

    setStatus("Saving…", false);
    try {
      const res = await fetch("/__save__", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      dirty = false;
      setSaveEnabled(false);
      document.querySelectorAll("[data-edit].is-dirty").forEach((n) => n.classList.remove("is-dirty"));
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

  async function publishChanges() {
    if (publishing) return;

    if (dirty) {
      const saved = await saveChanges();
      if (!saved) return; // don't publish on top of a failed save
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
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
