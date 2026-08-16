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
    "presentationList",
    "teachingList",
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
    presentationList: "<!-- injected by main.js -->",
    teachingList: "<!-- injected -->",
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
    "presentations.json",
    "teaching.json",
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
          <div id="formatToolbar" style="display:flex; align-items:center; gap:4px; margin-top:6px; flex-wrap:wrap;">
            <button type="button" data-cmd="bold" title="Bold" style="
              font:inherit; font-weight:700; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">B</button>
            <button type="button" data-cmd="italic" title="Italic" style="
              font:inherit; font-style:italic; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">I</button>
            <button type="button" data-cmd="underline" title="Underline" style="
              font:inherit; text-decoration:underline; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">U</button>
            <button type="button" data-cmd="strikeThrough" title="Strikethrough" style="
              font:inherit; text-decoration:line-through; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">S</button>
            <button type="button" data-cmd="subscript" title="Subscript (e.g. In₂O₃)" style="
              font:inherit; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">X₂</button>
            <button type="button" data-cmd="superscript" title="Superscript (e.g. cm²)" style="
              font:inherit; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">X²</button>
            <select id="formatFontSize" title="Font size" style="
              font:inherit; font-size:11px; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; height:26px;">
              <option value="">Size…</option>
              <option value="2">Small</option>
              <option value="3">Normal</option>
              <option value="5">Large</option>
              <option value="6">X-Large</option>
            </select>
            <input id="formatColor" type="color" title="Text color" value="#A8551E" style="
              width:26px; height:26px; padding:0; background:#2C2F35; border:1px solid #3A3D43; cursor:pointer;">
            <input id="formatHighlight" type="color" title="Highlight color" value="#F2D9A8" style="
              width:26px; height:26px; padding:0; background:#2C2F35; border:1px solid #3A3D43; cursor:pointer;">
            <button type="button" id="formatLinkBtn" title="Insert / edit link" style="
              font:inherit; font-size:12px; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; width:26px; height:26px;">🔗</button>
            <button type="button" data-cmd="removeFormat" title="Clear formatting" style="
              font:inherit; font-size:10px; cursor:pointer; background:#2C2F35; color:#ECE8DD;
              border:1px solid #3A3D43; padding:0 6px; height:26px;">Clear</button>
          </div>
          <div style="opacity:0.45; font-size:10.5px; margin-top:4px;">
            Every heading/paragraph on the page becomes editable. Select text
            and use the toolbar above to format it — X₂/X² apply sub/superscript
            (e.g. chemical formulas), the second color swatch highlights text,
            and 🔗 turns the selection into a link to any URL (click into an
            existing link and hit 🔗 again to edit or remove it). Click or
            drag-and-drop an image onto any figure box to set/replace it —
            the file is written to assets/images/ and committed like anything
            else. Once a figure has an image, a zoom slider appears at the
            bottom of the box to shrink it within the frame (the frame's own
            size is unaffected — drag its bottom-right or top-left corner to
            resize that). Every text block has its own resize handles too,
            so a heading or paragraph can be sized independently from the
            rest. Resizing sets a fixed size that won't shrink for small
            screens, so check mobile after resizing anything. A third
            handle — the small circle at the top-right corner — moves a
            box instead of resizing it; drag it to reposition without
            changing its size.
          </div>
        </div>

        <div>
          <div style="opacity:0.55; margin-bottom:4px;">LISTS (publications, experience, skills, etc.)</div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select id="dataFileSelect" style="
              font:inherit; background:#0F1114; color:#ECE8DD; border:1px solid #3A3D43;
              padding:4px 6px;">
              <option value="">Choose a file…</option>
            </select>
            <button id="saveJsonBtn" type="button" disabled style="
              font:inherit; cursor:pointer; background:#A8551E; color:#fff;
              border:1px solid #A8551E; padding:4px 8px; opacity:0.4;">Save</button>
            <a id="rawToggleLink" href="#" style="display:none; color:#8A8D8F; text-decoration:underline; font-size:11px;">raw JSON</a>
          </div>
          <div id="dataFormContainer" style="
            display:none; flex-direction:column; gap:8px;
            margin-top:6px; max-height:280px; overflow:auto;"></div>
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
        // Figures are never text-editable content — they're handled entirely
        // by setupFigureUploads()/setupFigureZoom() via click/drag-drop, not
        // contentEditable. Excluding the whole frame (not just its children)
        // matters: with nothing editable inside, the generic fallback below
        // would otherwise make the *entire* frame one big contentEditable
        // region, which is exactly what lets a dropped image file get
        // silently inserted as a base64 blob by the browser's native
        // drag-drop-into-contenteditable behavior instead of being uploaded.
        if (child.classList.contains("figure-frame")) return;
        if (child.textContent.trim() === "") return; // decorative/empty, nothing to edit
        // Explicitly-authored prose blocks (data-edit="...") are always a
        // single leaf, however much rich-text markup (links, colored spans,
        // sub/superscript) ends up nested inside them — otherwise adding a
        // link or highlight to part of a paragraph would fragment it and
        // strand the surrounding plain text outside any editable leaf.
        if (child.hasAttribute("data-edit")) {
          leaves.push(child);
          foundInside = true;
          return;
        }
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

  // --- Figure image upload (drag & drop or click-to-pick) ------------------
  // Figures reference a fixed path (the <img src>) that already exists in
  // the HTML — dropping a file here writes real bytes to that exact path on
  // disk via dev_server.py, instead of relying on the browser's native
  // "insert as embedded base64 image" behavior, which silently drops the
  // image into whatever contentEditable happens to be under the cursor.
  async function uploadFigureImage(frame, img, file) {
    if (!file.type || !file.type.startsWith("image/")) {
      setStatus("Please drop an image file.", true);
      return;
    }
    const targetPath = img.getAttribute("src").split("?")[0];
    setStatus(`Uploading ${file.name}…`);
    try {
      const res = await fetch(`/__upload-image__?path=${encodeURIComponent(targetPath)}`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      img.classList.remove("is-broken");
      frame.classList.add("has-image");
      img.src = `${targetPath}?t=${Date.now()}`;
      setStatus(`Saved ${targetPath.split("/").pop()} ✓`);
    } catch (err) {
      setStatus(`Upload failed: ${err.message}`, true);
    }
  }

  function setupFigureUploads() {
    document.querySelectorAll(".figure-frame").forEach((frame) => {
      if (frame.dataset.uploadWired) return;
      frame.dataset.uploadWired = "1";
      const img = frame.querySelector("img");
      if (!img) return;

      frame.addEventListener("dragover", (e) => {
        if (!editing) return;
        e.preventDefault();
        frame.classList.add("upload-hover");
      });
      frame.addEventListener("dragleave", () => frame.classList.remove("upload-hover"));
      frame.addEventListener("drop", (e) => {
        if (!editing) return;
        e.preventDefault();
        frame.classList.remove("upload-hover");
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) uploadFigureImage(frame, img, file);
      });
      frame.addEventListener("click", (e) => {
        if (!editing) return;
        if (e.target.closest(".figure-zoom-control")) return; // dragging the zoom slider, not picking a file
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", () => {
          if (input.files && input.files[0]) uploadFigureImage(frame, img, input.files[0]);
        });
        input.click();
      });
    });
  }

  // --- Figure zoom (shrink the image within its fixed-size frame) ----------
  // object-fit: cover always fills the frame exactly, so the only way to
  // leave breathing room around a figure without resizing the box itself is
  // to scale the image down within it.
  function setupFigureZoom() {
    document.querySelectorAll(".figure-frame").forEach((frame) => {
      if (frame.dataset.zoomWired) return;
      frame.dataset.zoomWired = "1";
      const img = frame.querySelector("img");
      if (!img) return;

      const current = parseFloat(img.style.getPropertyValue("--img-scale")) || 1;
      const control = el(`
        <div class="figure-zoom-control">
          <input type="range" min="0.3" max="1" step="0.01" value="${current}">
          <span class="figure-zoom-value">${Math.round(current * 100)}%</span>
        </div>
      `);
      const range = control.querySelector("input");
      const label = control.querySelector(".figure-zoom-value");
      range.addEventListener("input", () => {
        img.style.setProperty("--img-scale", range.value);
        label.textContent = `${Math.round(range.value * 100)}%`;
        dirty = true;
        setSaveEnabled(true);
      });
      // Dragging the slider shouldn't also drag-select page text or start
      // a native browser image drag on the figure underneath it.
      ["mousedown", "click", "dragstart"].forEach((evt) =>
        control.addEventListener(evt, (e) => e.stopPropagation())
      );
      frame.appendChild(control);
    });
  }

  // --- Custom resize handles -------------------------------------------
  // Replaces the native CSS `resize: both` corner grip, which is a tiny
  // OS-rendered hit target (easy to miss) and can silently fail to apply a
  // dragged width to a CSS grid item in some browsers. A plain draggable
  // div, driving the same "write an explicit inline width/height" result
  // via ordinary pointer events, works the same way everywhere.
  // .hero-figure (not its inner .figure-frame) is the grip target for the
  // hero image specifically: it's a flex-shrink:1 sibling of .hero-content
  // in .hero-grid, so resizing IT (instead of the frame inside it) lets
  // the row's own flexbox shrink math keep the figure and the intro copy
  // from ever overlapping — see the .hero-figure > .figure-frame rule in
  // style.css. Every other .figure-frame (story figures, the avatar) has
  // no such sibling to make room for, so it stays resizable directly
  // (filtered out below rather than folded into this selector with a
  // compound :not(), which is harder to read for a one-off exclusion).
  const RESIZE_SELECTOR = ".figure-frame, .hero-content, .hero-figure, .about-body, .story-content, [data-edit], figcaption";

  // corner: "br" grows down/right in place; "tl" grows up/left by growing
  // width/height while pulling the box's own position back with a negative
  // margin, since these targets are normal-flow elements (not absolutely
  // positioned) and only width/height alone would just grow toward br
  // regardless of which corner was dragged.
  //
  // .hero-figure is the one exception: it's a flex item sharing a row
  // with .hero-content (see .hero-grid), and it's the *trailing* item in
  // that row, so growing its plain width already extends its left edge
  // into its sibling's space via ordinary flex-shrink — no margin needed.
  // A negative margin-left on top of that would double-count the growth
  // and, worse, sit outside flexbox's shrink accounting entirely: it
  // shifts the box left by a fixed amount no matter how much the row has
  // already shrunk, so the two can end up overlapping regardless of
  // window width. Skipping the horizontal half of the margin trick for
  // this one target keeps it inside the row's own shrink math.
  // A [data-edit] leaf's own max-width:100% (see style.css) is relative to
  // its immediate parent, which keeps it from spilling past that parent —
  // correct, since it's what stops e.g. a story paragraph from overlapping
  // the figure in the grid column next to it. But when that parent is
  // itself one of the boxes with its own resize grip, dragging the leaf
  // wider than the parent's *current* size should grow the parent to
  // match rather than just clipping silently: the parent already has its
  // own max-width:100% up the chain (relative to ITS parent), so bumping
  // it here can never push the growth past whatever actually has a
  // sibling to protect — it just stops the cap from biting before that.
  // .hero-intro and .hero-status aren't resizable boxes in their own right
  // (no grip, not in RESIZE_SELECTOR) — .hero-intro wraps the tagline/lead
  // pair and .hero-status wraps the status dot + text — but both are
  // exactly the kind of "parent that happens to be narrower than what got
  // dragged" case this same fix is for, so they're included here too even
  // though nothing points a grip at them directly.
  const TEXT_CAPPING_PARENTS = ".hero-content, .hero-intro, .hero-status, .about-body, .story-content";
  function growCappingParent(target, newW) {
    const parent = target.parentElement;
    if (!parent || !parent.matches(TEXT_CAPPING_PARENTS)) return;
    if (newW > parent.getBoundingClientRect().width) {
      parent.style.width = `${newW}px`;
      liftProseMaxWidth(parent);
    }
  }

  // Several text elements (.about-body, .story-title, .story-text, ...)
  // carry their own deliberate max-width in rem for prose readability —
  // a separate, later rule that wins over the generic max-width:100%
  // resize-safety cap regardless of what width gets dragged in, which is
  // why resizing them visibly does nothing. Pin max-width to 100% inline
  // once a box is actually resized: inline beats the rem rule outright
  // (so the drag takes effect), but 100% is the same *value* the safety
  // cap already used, so it still shrinks correctly on a narrower parent
  // instead of becoming a fixed ceiling that stops responding to the
  // window like the figure-frame bug earlier in this session.
  function liftProseMaxWidth(el) {
    el.style.maxWidth = "100%";
  }

  // A figure-frame (or .hero-figure, whose child figure-frame fills it) with
  // a real image loaded has one "correct" shape: its own. Dragging width and
  // height independently, as this grip otherwise does, easily drifts away
  // from that — object-fit:contain then just letterboxes the mismatch as
  // dead space rather than cropping, so the box quietly ends up mostly
  // empty padding around a smaller image. Locking the drag to the image's
  // natural aspect ratio for these targets makes that impossible instead of
  // relying on whoever's dragging to eyeball the right shape. Placeholder
  // frames with no image yet (nothing to match) keep the old free resize.
  function getLockedAspectRatio(target) {
    const frame = target.classList.contains("figure-frame") ? target : target.querySelector(".figure-frame");
    if (!frame || !frame.classList.contains("has-image")) return null;
    const img = frame.querySelector("img");
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    return img.naturalWidth / img.naturalHeight;
  }

  function wireResizeGrip(target, corner) {
    const skipHorizontalMargin = target.classList.contains("hero-figure");
    const grip = document.createElement("div");
    grip.className = `resize-grip resize-grip-${corner}`;
    // Several targets (any [data-edit] leaf) become contentEditable —
    // mark the grip as a non-editable island so it can't be typed into,
    // selected as text, or deleted by the user editing around it.
    grip.contentEditable = "false";
    target.appendChild(grip);

    const growSign = corner === "tl" ? -1 : 1;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let startML = 0;
    let startMT = 0;
    let lockedRatio = null;

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newW = Math.max(40, Math.round(startW + growSign * dx));
      const newH = lockedRatio
        ? Math.max(24, Math.round(newW / lockedRatio))
        : Math.max(24, Math.round(startH + growSign * dy));
      target.style.width = `${newW}px`;
      target.style.height = `${newH}px`;
      liftProseMaxWidth(target);
      if (corner === "tl") {
        if (!skipHorizontalMargin) target.style.marginLeft = `${startML - (newW - startW)}px`;
        target.style.marginTop = `${startMT - (newH - startH)}px`;
      }
      growCappingParent(target, newW);
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      grip.classList.remove("is-dragging");
      dirty = true;
      setSaveEnabled(true);
    }
    grip.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      const computed = getComputedStyle(target);
      startX = e.clientX;
      startY = e.clientY;
      startW = rect.width;
      startH = rect.height;
      startML = parseFloat(target.style.marginLeft || computed.marginLeft) || 0;
      startMT = parseFloat(target.style.marginTop || computed.marginTop) || 0;
      lockedRatio = getLockedAspectRatio(target);
      grip.classList.add("is-dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    // Don't let a click/drag on the grip itself select page text or
    // trigger whatever the target element normally does on click (e.g.
    // a figure-frame's upload picker).
    ["click", "dragstart"].forEach((evt) => grip.addEventListener(evt, (e) => e.stopPropagation()));
  }

  // A pure reposition, separate from resizing: drags the box via
  // margin-left/margin-top only, width/height untouched, so it stays in
  // normal flow (still reserves its own space, still pushes/wraps
  // neighbors the same as an unmoved box would) instead of turning into
  // a free-floating position:absolute element.
  //
  // .hero-figure gets the same horizontal exception as its resize grip:
  // it's the trailing item in the .hero-grid flex row, so a free
  // margin-left here would shift it left by a fixed amount that sits
  // outside the row's flex-shrink accounting — exactly the bug a
  // negative resize margin caused before. Vertical movement doesn't
  // compete with .hero-content for space, so it stays free.
  function wireMoveHandle(target) {
    const skipHorizontalMove = target.classList.contains("hero-figure");
    const handle = document.createElement("div");
    handle.className = "move-grip";
    handle.title = "Drag to move";
    handle.contentEditable = "false";
    target.appendChild(handle);

    let startX = 0;
    let startY = 0;
    let startML = 0;
    let startMT = 0;

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!skipHorizontalMove) target.style.marginLeft = `${Math.round(startML + dx)}px`;
      target.style.marginTop = `${Math.round(startMT + dy)}px`;
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      handle.classList.remove("is-dragging");
      dirty = true;
      setSaveEnabled(true);
    }
    handle.addEventListener("pointerdown", (e) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();
      const computed = getComputedStyle(target);
      startX = e.clientX;
      startY = e.clientY;
      startML = parseFloat(target.style.marginLeft || computed.marginLeft) || 0;
      startMT = parseFloat(target.style.marginTop || computed.marginTop) || 0;
      handle.classList.add("is-dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
    ["click", "dragstart"].forEach((evt) => handle.addEventListener(evt, (e) => e.stopPropagation()));
  }

  function setupResizeHandles() {
    document.querySelectorAll(RESIZE_SELECTOR).forEach((target) => {
      // The hero image is resized via its .hero-figure wrapper, not this
      // inner frame — see the RESIZE_SELECTOR comment above.
      if (target.classList.contains("figure-frame") && target.parentElement.classList.contains("hero-figure")) return;
      if (target.dataset.resizeWired) return;
      target.dataset.resizeWired = "1";
      wireResizeGrip(target, "br");
      wireResizeGrip(target, "tl");
      wireMoveHandle(target);
    });
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

  // --- Formatting toolbar (bold/italic/underline/color) --------------------
  // Tracks the last text selection made *inside an editable leaf* so toolbar
  // clicks (which momentarily steal focus from the page) still apply to the
  // right place — the standard save/restore-Range trick for contentEditable.
  let savedRange = null;

  function trackSelection() {
    // Tracks both real selections (for bold/italic/etc) and a plain cursor
    // position (needed so clicking into an existing link, with nothing
    // selected, still lets the Link button find and edit it).
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (el && el.closest(".editor-leaf")) {
      savedRange = range.cloneRange();
    }
  }

  function markLeafDirtyFromSelection() {
    const sel = window.getSelection();
    savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const node = savedRange && savedRange.commonAncestorContainer;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    const target = el && el.closest(".editor-leaf");
    if (target) {
      target.classList.add("is-dirty");
      dirty = true;
      setSaveEnabled(true);
    }
  }

  const STYLE_WITH_CSS_CMDS = new Set(["foreColor", "hiliteColor", "fontSize"]);

  function applyFormat(cmd, value) {
    if (!savedRange || savedRange.collapsed) {
      setStatus("Select some text first, then click a format button.", true);
      return;
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    const useStyleWithCSS = STYLE_WITH_CSS_CMDS.has(cmd);
    if (useStyleWithCSS) {
      document.execCommand("styleWithCSS", false, true);
    }
    document.execCommand(cmd, false, value);
    if (useStyleWithCSS) {
      document.execCommand("styleWithCSS", false, false);
    }
    markLeafDirtyFromSelection();
  }

  function findEnclosingLink(range) {
    if (!range) return null;
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    return el ? el.closest(".editor-leaf a") : null;
  }

  function insertOrEditLink() {
    const sel = window.getSelection();
    let range = savedRange;
    let existingLink = findEnclosingLink(range);

    if (!range || (!existingLink && range.collapsed)) {
      setStatus("Select some text first, then click 🔗.", true);
      return;
    }

    const currentHref = existingLink ? existingLink.getAttribute("href") : "";
    const input = window.prompt(
      existingLink ? "Edit link URL (leave blank to remove the link):" : "Link URL:",
      currentHref || "https://"
    );
    if (input === null) return; // cancelled

    const url = input.trim();

    // If editing an existing link via just a cursor (no real selection),
    // select its full text first so unlink/createLink applies to the whole thing.
    if (existingLink && range.collapsed) {
      const full = document.createRange();
      full.selectNodeContents(existingLink);
      range = full;
    }
    sel.removeAllRanges();
    sel.addRange(range);

    if (url === "") {
      document.execCommand("unlink");
    } else {
      document.execCommand("createLink", false, url);
      const node = sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      const newLink = el && el.closest(".editor-leaf a");
      const isExternal = /^https?:\/\//i.test(url);
      if (newLink && isExternal) {
        newLink.target = "_blank";
        newLink.rel = "noopener";
      } else if (newLink) {
        newLink.removeAttribute("target");
        newLink.removeAttribute("rel");
      }
    }
    markLeafDirtyFromSelection();
  }

  function stripClass(scope, selector, className) {
    scope.querySelectorAll(selector).forEach((el) => {
      el.classList.remove(className);
      if (!el.getAttribute("class")) el.removeAttribute("class");
    });
  }

  // Anything main.js or edit-mode.js itself toggles at runtime based on
  // scroll position / hover / load state — never something to freeze into
  // the saved source, or the page would load "pre-scrolled" (reveal
  // animations skipped, nav showing the wrong active link, a stale
  // is-broken/has-image on figures that no longer matches reality, etc).
  function stripRuntimeState(clone) {
    stripClass(clone, ".editor-leaf", "editor-leaf");
    clone.querySelectorAll(".editor-leaf, [contenteditable]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.classList.remove("is-dirty");
      if (!el.getAttribute("class")) el.removeAttribute("class");
    });
    stripClass(clone, ".reveal.is-visible", "is-visible");
    stripClass(clone, ".site-nav.is-scrolled", "is-scrolled");
    stripClass(clone, ".nav-links a.is-active", "is-active");
    stripClass(clone, ".mobile-menu.is-open", "is-open");
    const toggle = clone.querySelector("#navToggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    // is-broken/has-image reflect whether a figure image currently loads —
    // re-evaluated fresh on every page load, so freezing today's result
    // would wrongly hide a real image added later, or show a stale
    // placeholder for one that was removed.
    stripClass(clone, ".figure-frame img.is-broken", "is-broken");
    stripClass(clone, ".figure-frame.has-image", "has-image");
    stripClass(clone, ".figure-frame.upload-hover", "upload-hover");
    clone.querySelectorAll("[data-upload-wired], [data-zoom-wired], [data-resize-wired]").forEach((el) => {
      el.removeAttribute("data-upload-wired");
      el.removeAttribute("data-zoom-wired");
      el.removeAttribute("data-resize-wired");
    });
  }

  function buildSaveableHtml() {
    const clone = document.getElementById("editableRoot").cloneNode(true);
    DYNAMIC_IDS.forEach((id) => {
      const node = clone.querySelector("#" + id);
      if (node) node.innerHTML = DYNAMIC_PLACEHOLDERS[id];
    });
    // Resize-drag inline width/height on .figure-frame/.hero-content/etc.
    // are real user edits and are intentionally kept as-is. The --img-scale
    // custom property set by the zoom slider is likewise kept; only the
    // slider UI itself is editor-only and gets removed.
    clone.querySelectorAll(".figure-zoom-control").forEach((el) => el.remove());
    clone.querySelectorAll(".resize-grip, .move-grip").forEach((el) => el.remove());
    stripRuntimeState(clone);
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

  // --- Generic form builder for data/*.json -------------------------------
  // Works for any file without hardcoded per-file schemas: it discovers the
  // shape (array of objects, or a flat object) and each field's type from
  // the data itself, so new fields (like the "url" added to publications)
  // just show up automatically — no editor code changes needed.

  let currentDataFile = null;
  let currentData = null;
  let rawMode = false;

  function fieldEl(labelText, inputEl) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; gap:2px;";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.cssText = "font-size:10px; opacity:0.55; text-transform:uppercase; letter-spacing:0.04em;";
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function textInput(value, onChange, multiline) {
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    else input.rows = value.length > 160 ? 4 : 2;
    input.value = value;
    input.spellcheck = false;
    input.style.cssText = `
      font:inherit; font-size:11px; background:#0F1114; color:#ECE8DD;
      border:1px solid #3A3D43; padding:4px 6px; width:100%; box-sizing:border-box;
      ${multiline ? "resize:vertical;" : ""}
    `;
    input.addEventListener("input", () => onChange(input.value));
    return input;
  }

  // Union of keys across every entry, in first-seen order — so every
  // entry's card shows every field this file type can have, even ones
  // this particular entry doesn't currently use.
  function schemaKeys(array) {
    const keys = [];
    array.forEach((entry) => Object.keys(entry).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
    return keys;
  }

  function inferKind(array, key) {
    for (const entry of array) {
      if (key in entry) {
        const v = entry[key];
        if (Array.isArray(v)) return v.length && typeof v[0] === "object" ? "array-of-objects" : "array-of-strings";
        return "string";
      }
    }
    return "string";
  }

  function blankValueFor(kind) {
    if (kind === "array-of-strings" || kind === "array-of-objects") return [];
    return "";
  }

  function renderField(key, kind, value, onChange) {
    if (kind === "array-of-strings") {
      return fieldEl(key + " (one per line)", textInput((value || []).join("\n"), (v) => {
        onChange(v.split("\n").map((s) => s.trim()).filter(Boolean));
      }, true));
    }
    if (kind === "array-of-objects") {
      return fieldEl(key + " (advanced — raw JSON list)", textInput(JSON.stringify(value || []), (v) => {
        try { onChange(JSON.parse(v || "[]")); } catch (e) { /* leave in place until valid */ }
      }, true));
    }
    const str = value == null ? "" : String(value);
    return fieldEl(key, textInput(str, onChange, str.length > 50));
  }

  function renderEntryCard(entry, keys, kinds, onRemove) {
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid #3A3D43; padding:8px; display:flex; flex-direction:column; gap:6px;";
    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:flex-end;";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove entry ×";
    removeBtn.style.cssText = "font:inherit; font-size:10.5px; cursor:pointer; background:none; color:#E0684A; border:1px solid #5A2E2E; padding:2px 6px;";
    removeBtn.addEventListener("click", onRemove);
    header.appendChild(removeBtn);
    card.appendChild(header);

    keys.forEach((key) => {
      const kind = kinds[key];
      const value = key in entry ? entry[key] : blankValueFor(kind);
      card.appendChild(renderField(key, kind, value, (newVal) => { entry[key] = newVal; }));
    });
    return card;
  }

  function renderDataForm() {
    const container = panel.querySelector("#dataFormContainer");
    container.innerHTML = "";

    if (Array.isArray(currentData)) {
      const keys = schemaKeys(currentData);
      const kinds = {};
      keys.forEach((k) => (kinds[k] = inferKind(currentData, k)));

      currentData.forEach((entry, idx) => {
        const card = renderEntryCard(entry, keys, kinds, () => {
          currentData.splice(idx, 1);
          renderDataForm();
        });
        container.appendChild(card);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "+ Add entry";
      addBtn.style.cssText = "font:inherit; cursor:pointer; background:#2C2F35; color:#ECE8DD; border:1px solid #3A3D43; padding:6px;";
      addBtn.addEventListener("click", () => {
        const blank = {};
        keys.forEach((k) => (blank[k] = blankValueFor(kinds[k])));
        currentData.push(blank);
        renderDataForm();
      });
      container.appendChild(addBtn);
    } else if (currentData && typeof currentData === "object") {
      const card = document.createElement("div");
      card.style.cssText = "display:flex; flex-direction:column; gap:6px;";
      Object.keys(currentData).forEach((key) => {
        const value = currentData[key];
        const kind = Array.isArray(value) ? (value.length && typeof value[0] === "object" ? "array-of-objects" : "array-of-strings") : "string";
        card.appendChild(renderField(key, kind, value, (newVal) => { currentData[key] = newVal; }));
      });
      container.appendChild(card);
    }
  }

  function stripEmpty(value) {
    if (Array.isArray(value)) return value.map(stripEmpty);
    if (value && typeof value === "object") {
      const out = {};
      Object.entries(value).forEach(([k, v]) => {
        if (v === "") return; // omit unset optional string fields, matches original file style
        out[k] = stripEmpty(v);
      });
      return out;
    }
    return value;
  }

  function setRawMode(on) {
    rawMode = on;
    const textarea = panel.querySelector("#jsonEditor");
    const formContainer = panel.querySelector("#dataFormContainer");
    const link = panel.querySelector("#rawToggleLink");
    if (on) {
      textarea.value = JSON.stringify(currentData, null, 2);
      textarea.style.display = "block";
      formContainer.style.display = "none";
      link.textContent = "form view";
    } else {
      try {
        currentData = JSON.parse(textarea.value);
      } catch (err) {
        setStatus("Invalid JSON, staying in raw view — " + err.message, true);
        rawMode = true;
        return;
      }
      textarea.style.display = "none";
      formContainer.style.display = "flex";
      link.textContent = "raw JSON";
      renderDataForm();
    }
  }

  async function loadJsonFile(filename) {
    const saveBtn = panel.querySelector("#saveJsonBtn");
    const formContainer = panel.querySelector("#dataFormContainer");
    const textarea = panel.querySelector("#jsonEditor");
    const link = panel.querySelector("#rawToggleLink");
    currentDataFile = filename;
    rawMode = false;

    if (!filename) {
      formContainer.style.display = "none";
      textarea.style.display = "none";
      link.style.display = "none";
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.4";
      return;
    }
    try {
      const res = await fetch("data/" + filename, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      currentData = JSON.parse(await res.text());
      formContainer.style.display = "flex";
      textarea.style.display = "none";
      link.style.display = "inline";
      link.textContent = "raw JSON";
      renderDataForm();
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      setStatus(`Loaded ${filename}`, false);
    } catch (err) {
      setStatus("Couldn't load " + filename + ": " + err.message, true);
    }
  }

  async function saveJsonFile() {
    const filename = currentDataFile;
    if (!filename) return;

    if (rawMode) {
      try {
        currentData = JSON.parse(panel.querySelector("#jsonEditor").value);
      } catch (err) {
        setStatus("Invalid JSON — " + err.message, true);
        return;
      }
    }

    const payload = stripEmpty(currentData);
    setStatus(`Saving ${filename}…`, false);
    try {
      const res = await fetch("/__save-json__", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: filename, data: payload })
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
    setupFigureUploads();
    setupFigureZoom();
    setupResizeHandles();

    // Belt-and-suspenders: even with figure-frame excluded from
    // collectLeaves, block the browser's native "insert dropped file as a
    // base64 image" behavior anywhere else in the editable page too, so a
    // slightly mis-aimed drop can never again corrupt page text instead of
    // uploading nothing.
    document.addEventListener("dragover", (e) => {
      if (!editing) return;
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
        e.preventDefault();
      }
    });
    document.addEventListener("drop", (e) => {
      if (!editing) return;
      if (e.target.closest && e.target.closest(".figure-frame")) return; // handled there
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        setStatus("Drop images onto a figure box, not page text.", true);
      }
    });

    panel.querySelector("#editToggleBtn").addEventListener("click", toggleEditing);
    panel.querySelector("#editSaveBtn").addEventListener("click", saveChanges);
    panel.querySelector("#publishBtn").addEventListener("click", publishChanges);
    panel.querySelector("#dataFileSelect").addEventListener("change", (e) => loadJsonFile(e.target.value));
    panel.querySelector("#saveJsonBtn").addEventListener("click", saveJsonFile);
    panel.querySelector("#rawToggleLink").addEventListener("click", (e) => {
      e.preventDefault();
      setRawMode(!rawMode);
    });

    document.addEventListener("selectionchange", trackSelection);
    panel.querySelectorAll("#formatToolbar button[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", () => applyFormat(btn.getAttribute("data-cmd")));
    });
    panel.querySelector("#formatColor").addEventListener("input", (e) => {
      applyFormat("foreColor", e.target.value);
    });
    panel.querySelector("#formatHighlight").addEventListener("input", (e) => {
      applyFormat("hiliteColor", e.target.value);
    });
    panel.querySelector("#formatFontSize").addEventListener("change", (e) => {
      if (!e.target.value) return;
      applyFormat("fontSize", e.target.value);
      e.target.value = "";
    });
    panel.querySelector("#formatLinkBtn").addEventListener("click", insertOrEditLink);

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
