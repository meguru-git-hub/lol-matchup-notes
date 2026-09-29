/* =========================================================
   LoL マッチアップ対策シート
   ---------------------------------------------------------
   使いかたの想定
     チャンプセレクトで相手が決まった瞬間にこのサイトを開き、
     相手の名前を入力 → レーン戦の方針をその場で確認する。
     （試合後の振り返りは「気づいたこと」に少しだけ足す）

   このファイルの中身
     1) Data Dragon からチャンピオン一覧を取ってくる
     2) 自分のチャンプを「設定」として覚えておく
     3) 相手を選んだら対策シートを表示する（読む画面）
     4) 相手のスキル一覧を Data Dragon から自動で表示する
     5) 編集ボタンを押したときだけ入力フォームを出す
     6) 対策は localStorage に保存する
   ========================================================= */


/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */

// 対策メモの保存場所の名前
const STORAGE_KEY = "lolMatchupNotes";

// 「自分のチャンプ」の保存場所の名前
const MY_CHAMP_KEY = "lolMyChampion";

// Data Dragon のバージョン一覧
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

// 相性の表示名（キー → 画面に出す文字）
const DIFFICULTY_LABELS = {
  easy:     "有利",
  even:     "互角",
  hard:     "不利",
  veryhard: "超不利"
};


/* ---------------------------------------------------------
   全体で使う変数
   --------------------------------------------------------- */

let champions = [];        // チャンピオン一覧
let latestVersion = "";    // Data Dragon の最新バージョン
let selectedMy = null;     // 自分のチャンプ
let selectedEnemy = null;  // 相手のチャンプ

// 相手のスキル情報は一度取ったら覚えておく（同じ相手で何度も取りに行かないため）
const spellCache = {};

// 編集フォームでいま選んでいる相性
let editingDifficulty = "";


/* ---------------------------------------------------------
   HTML の要素をまとめて取っておく
   --------------------------------------------------------- */
const el = {
  loadingMessage: document.getElementById("loadingMessage"),

  // 自分のチャンプ
  myIcon:         document.getElementById("myIcon"),
  myName:         document.getElementById("myName"),
  changeMyButton: document.getElementById("changeMyButton"),
  myPicker:       document.getElementById("myPicker"),
  mySearch:       document.getElementById("mySearch"),
  myGrid:         document.getElementById("myGrid"),

  // 相手のチャンプ
  enemySearch: document.getElementById("enemySearch"),
  enemyGrid:   document.getElementById("enemyGrid"),

  // 対策シート（読む画面）
  sheet:          document.getElementById("sheet"),
  sheetMyIcon:    document.getElementById("sheetMyIcon"),
  sheetEnemyIcon: document.getElementById("sheetEnemyIcon"),
  sheetTitle:     document.getElementById("sheetTitle"),
  sheetSubtitle:  document.getElementById("sheetSubtitle"),
  sheetDifficulty:document.getElementById("sheetDifficulty"),
  planBox:        document.getElementById("planBox"),
  planText:       document.getElementById("planText"),
  emptySheet:     document.getElementById("emptySheet"),
  createButton:   document.getElementById("createButton"),
  sheetBody:      document.getElementById("sheetBody"),
  viewAvoid:      document.getElementById("viewAvoid"),
  viewTrade:      document.getElementById("viewTrade"),
  viewSpike:      document.getElementById("viewSpike"),
  viewBuild:      document.getElementById("viewBuild"),
  phaseBox:       document.getElementById("phaseBox"),
  viewEarly:      document.getElementById("viewEarly"),
  viewMid:        document.getElementById("viewMid"),
  viewLate:       document.getElementById("viewLate"),
  spellList:      document.getElementById("spellList"),
  noteBox:        document.getElementById("noteBox"),
  viewNote:       document.getElementById("viewNote"),
  editButton:     document.getElementById("editButton"),
  sheetUpdated:   document.getElementById("sheetUpdated"),

  // 編集フォーム
  editor:            document.getElementById("editor"),
  editorTitle:       document.getElementById("editorTitle"),
  difficultyChoices: document.getElementById("difficultyChoices"),
  editPlan:          document.getElementById("editPlan"),
  editAvoid:         document.getElementById("editAvoid"),
  editTrade:         document.getElementById("editTrade"),
  editSpike:         document.getElementById("editSpike"),
  editBuild:         document.getElementById("editBuild"),
  editEarly:         document.getElementById("editEarly"),
  editMid:           document.getElementById("editMid"),
  editLate:          document.getElementById("editLate"),
  editNote:          document.getElementById("editNote"),
  saveButton:        document.getElementById("saveButton"),
  cancelButton:      document.getElementById("cancelButton"),
  saveMessage:       document.getElementById("saveMessage"),

  // 一覧
  filterMine: document.getElementById("filterMine"),
  savedList:  document.getElementById("savedList")
};


/* =========================================================
   1) Data Dragon からチャンピオン一覧を取ってくる
   ========================================================= */

async function loadChampions() {
  try {
    // ① 最新バージョンを調べる
    const versionsResponse = await fetch(VERSIONS_URL);
    const versions = await versionsResponse.json();
    latestVersion = versions[0];

    // ② そのバージョンの日本語チャンピオンデータを取ってくる
    const champResponse = await fetch(
      "https://ddragon.leagueoflegends.com/cdn/" +
      latestVersion + "/data/ja_JP/champion.json"
    );
    const champJson = await champResponse.json();

    // ③ 使いやすい形に整える
    champions = Object.values(champJson.data).map(function (champ) {
      return {
        id:    champ.id,
        name:  champ.name,
        title: champ.title,
        icon:  "https://ddragon.leagueoflegends.com/cdn/" +
               latestVersion + "/img/champion/" + champ.id + ".png"
      };
    });

    // ④ 日本語名の五十音順に並べる
    champions.sort(function (a, b) {
      return a.name.localeCompare(b.name, "ja");
    });

    // ⑤ 画面の準備
    el.loadingMessage.hidden = true;
    restoreMyChampion();
    renderGrid("my");
    renderGrid("enemy");
    renderSavedList();

    // 検索欄にカーソルを置いて、すぐ入力できるようにする
    el.enemySearch.focus();

  } catch (error) {
    el.loadingMessage.textContent =
      "チャンピオン一覧を取得できませんでした。インターネット接続を確認して、ページを再読み込みしてください。";
    console.error(error);
  }
}


/* =========================================================
   2) 自分のチャンプを覚えておく
   毎回選ぶのは面倒なので、一度選んだらブラウザに保存しておく。
   ========================================================= */

function restoreMyChampion() {
  try {
    const saved = localStorage.getItem(MY_CHAMP_KEY);
    if (!saved) {
      // まだ設定されていなければ、選ぶパネルを開いておく
      el.myPicker.hidden = false;
      return;
    }

    const savedId = JSON.parse(saved);
    const champ = champions.find(function (c) { return c.id === savedId; });
    if (champ) {
      setMyChampion(champ, false);   // false = 保存はしない（もう保存済み）
    } else {
      el.myPicker.hidden = false;
    }
  } catch (error) {
    console.error("自分のチャンプの読み込みに失敗しました", error);
    el.myPicker.hidden = false;
  }
}

function setMyChampion(champ, shouldSave) {
  selectedMy = champ;

  el.myIcon.src = champ.icon;
  el.myIcon.hidden = false;
  el.myName.textContent = champ.name;

  if (shouldSave) {
    localStorage.setItem(MY_CHAMP_KEY, JSON.stringify(champ.id));
  }

  renderGrid("my");
  renderSavedList();

  // 相手がもう選ばれているなら、シートを新しい自分チャンプで作り直す
  if (selectedEnemy) showSheet();
}

// 「変更」ボタンでパネルを開閉する
el.changeMyButton.addEventListener("click", function () {
  el.myPicker.hidden = !el.myPicker.hidden;
  if (!el.myPicker.hidden) el.mySearch.focus();
});


/* =========================================================
   3) チャンピオン一覧を画面に並べる
   ========================================================= */

function renderGrid(which) {
  const grid      = (which === "my") ? el.myGrid : el.enemyGrid;
  const searchBox = (which === "my") ? el.mySearch : el.enemySearch;
  const selected  = (which === "my") ? selectedMy : selectedEnemy;

  const keyword = searchBox.value.trim().toLowerCase();

  // 検索文字でしぼりこむ（日本語名でも英語名でも探せる）
  const list = champions.filter(function (champ) {
    if (keyword === "") return true;
    return champ.name.toLowerCase().includes(keyword) ||
           champ.id.toLowerCase().includes(keyword);
  });

  grid.innerHTML = "";

  list.forEach(function (champ) {
    const button = document.createElement("button");
    button.className = "champ";
    button.title = champ.name;

    if (selected && selected.id === champ.id) {
      button.classList.add("is-selected");
    }

    const img = document.createElement("img");
    img.src = champ.icon;
    img.alt = champ.name;
    img.loading = "lazy";
    button.appendChild(img);

    button.addEventListener("click", function () {
      if (which === "my") {
        setMyChampion(champ, true);
        el.myPicker.hidden = true;      // 選んだら閉じる
        el.enemySearch.focus();
      } else {
        selectEnemy(champ);
      }
    });

    grid.appendChild(button);
  });
}

// 検索欄に文字が入ったら並べ直す
el.mySearch.addEventListener("input", function () { renderGrid("my"); });
el.enemySearch.addEventListener("input", function () { renderGrid("enemy"); });

// Enter を押したら検索結果の1体目を選ぶ（チャンプセレクトで速い）
el.enemySearch.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;

  const firstButton = el.enemyGrid.querySelector(".champ");
  if (firstButton) firstButton.click();
});


/* =========================================================
   4) 相手を選んだとき → 対策シートを出す
   ========================================================= */

function selectEnemy(champ) {
  selectedEnemy = champ;
  renderGrid("enemy");

  // 自分のチャンプが未設定なら先に設定してもらう
  if (!selectedMy) {
    alert("先に自分のチャンプを設定してください。");
    el.myPicker.hidden = false;
    el.mySearch.focus();
    return;
  }

  el.editor.hidden = true;    // 編集中だったら閉じる
  showSheet();

  // シートまでスクロールする
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
}


/* =========================================================
   5) 対策シートの中身を作る（読む画面）
   ========================================================= */

function showSheet() {
  const note = loadAllNotes()[makeKey(selectedMy.id, selectedEnemy.id)];

  el.sheet.hidden = false;

  // --- 見出し ---
  el.sheetMyIcon.src = selectedMy.icon;
  el.sheetMyIcon.alt = selectedMy.name;
  el.sheetEnemyIcon.src = selectedEnemy.icon;
  el.sheetEnemyIcon.alt = selectedEnemy.name;
  el.sheetTitle.textContent = selectedMy.name + " vs " + selectedEnemy.name;
  el.sheetSubtitle.textContent = selectedEnemy.title || "";

  // --- 相性バッジ ---
  const difficulty = note ? (note.difficulty || "") : "";
  if (difficulty) {
    el.sheetDifficulty.hidden = false;
    el.sheetDifficulty.textContent = DIFFICULTY_LABELS[difficulty];
    // 色を切り替えるため、クラスを付け替える
    el.sheetDifficulty.className = "badge badge-" + difficulty;
  } else {
    el.sheetDifficulty.hidden = true;
  }

  // --- 相手のスキル一覧（対策が無くても見られるように、先に出す） ---
  showSpells(selectedEnemy);

  // --- 対策がまだ無いとき ---
  if (!note) {
    el.emptySheet.hidden = false;
    el.planBox.hidden = true;
    el.sheetBody.hidden = true;
    el.phaseBox.hidden = true;
    el.noteBox.hidden = true;
    el.editButton.hidden = true;
    el.sheetUpdated.textContent = "";
    return;
  }

  // --- 対策があるとき ---
  el.emptySheet.hidden = true;
  el.editButton.hidden = false;

  // 方針（ひとこと）
  showOrHide(el.planBox, el.planText, note.plan);

  // 4つのポイント。1つでも中身があれば枠ごと表示する。
  //
  // ここで配列を使っているのには理由がある。
  // もし  A() || B() || C()  と書くと、A() が true の時点で B() と C() は
  // 実行されない（短絡評価）。すると前に見ていた相手の文章が消えずに残ってしまう。
  // 配列に入れれば必ず全部が実行されるので、確実に書き換わる。
  const pointsFilled = [
    fillPoint(el.viewAvoid, note.avoidSkill),
    fillPoint(el.viewTrade, note.tradeTiming),
    fillPoint(el.viewSpike, note.powerSpike),
    fillPoint(el.viewBuild, note.counterBuild)
  ];
  el.sheetBody.hidden = !pointsFilled.includes(true);

  // レーン戦の流れ（同じ理由で配列にする）
  const phasesFilled = [
    fillPoint(el.viewEarly, note.early),
    fillPoint(el.viewMid,   note.mid),
    fillPoint(el.viewLate,  note.late)
  ];
  el.phaseBox.hidden = !phasesFilled.includes(true);

  // 気づいたこと
  showOrHide(el.noteBox, el.viewNote, note.reflection);

  el.sheetUpdated.textContent = "更新: " + formatDate(note.updatedAt);
}

// 値があれば表示、なければ枠ごと隠す
function showOrHide(box, textElement, value) {
  if (value) {
    box.hidden = false;
    textElement.textContent = value;
  } else {
    box.hidden = true;
  }
}

// 値を入れて「中身があったか」を返す。空なら「未記入」とうすく出す。
function fillPoint(element, value) {
  if (value) {
    element.textContent = value;
    element.classList.remove("is-blank");
    return true;
  }
  element.textContent = "未記入";
  element.classList.add("is-blank");
  return false;
}


/* =========================================================
   6) 相手のスキルを Data Dragon から取ってきて表示する
   相手のQWERの名前とクールダウンがわかると、
   「どれを避けるか」がその場で判断しやすい。
   ========================================================= */

async function showSpells(champ) {
  el.spellList.innerHTML = '<p class="loading">読み込み中…</p>';

  try {
    // すでに取ってあれば使いまわす
    let data = spellCache[champ.id];

    if (!data) {
      const response = await fetch(
        "https://ddragon.leagueoflegends.com/cdn/" +
        latestVersion + "/data/ja_JP/champion/" + champ.id + ".json"
      );
      const json = await response.json();
      data = json.data[champ.id];
      spellCache[champ.id] = data;   // 次回のために覚えておく
    }

    // 途中で別の相手に変えられていたら、古い結果は捨てる
    if (!selectedEnemy || selectedEnemy.id !== champ.id) return;

    el.spellList.innerHTML = "";

    // パッシブ
    el.spellList.appendChild(createSpellRow(
      "P",
      data.passive.name,
      "",
      "https://ddragon.leagueoflegends.com/cdn/" +
        latestVersion + "/img/passive/" + data.passive.image.full
    ));

    // Q W E R
    const keys = ["Q", "W", "E", "R"];
    data.spells.forEach(function (spell, index) {
      el.spellList.appendChild(createSpellRow(
        keys[index],
        spell.name,
        "CD " + spell.cooldownBurn + "秒",
        "https://ddragon.leagueoflegends.com/cdn/" +
          latestVersion + "/img/spell/" + spell.image.full
      ));
    });

  } catch (error) {
    el.spellList.innerHTML = '<p class="loading">スキル情報を取得できませんでした。</p>';
    console.error(error);
  }
}

// スキル1行分の見た目を作る
function createSpellRow(key, name, cooldown, iconUrl) {
  const row = document.createElement("div");
  row.className = "spell";

  const keyTag = document.createElement("span");
  keyTag.className = "spell-key";
  keyTag.textContent = key;

  const img = document.createElement("img");
  img.className = "spell-icon";
  img.src = iconUrl;
  img.alt = name;
  img.loading = "lazy";

  const nameEl = document.createElement("span");
  nameEl.className = "spell-name";
  nameEl.textContent = name;

  const cdEl = document.createElement("span");
  cdEl.className = "spell-cd";
  cdEl.textContent = cooldown;

  row.appendChild(keyTag);
  row.appendChild(img);
  row.appendChild(nameEl);
  row.appendChild(cdEl);
  return row;
}


/* =========================================================
   7) 編集フォーム
   ========================================================= */

// フォームを開いて、いまの対策を読み込む
function openEditor() {
  const note = loadAllNotes()[makeKey(selectedMy.id, selectedEnemy.id)] || {};

  el.editorTitle.textContent =
    selectedMy.name + " vs " + selectedEnemy.name + " の対策";

  el.editPlan.value  = note.plan         || "";
  el.editAvoid.value = note.avoidSkill   || "";
  el.editTrade.value = note.tradeTiming  || "";
  el.editSpike.value = note.powerSpike   || "";
  el.editBuild.value = note.counterBuild || "";
  el.editEarly.value = note.early        || "";
  el.editMid.value   = note.mid          || "";
  el.editLate.value  = note.late         || "";
  el.editNote.value  = note.reflection   || "";

  setDifficulty(note.difficulty || "");

  el.saveMessage.textContent = "";
  el.editor.hidden = false;
  el.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  el.editPlan.focus();
}

el.editButton.addEventListener("click", openEditor);
el.createButton.addEventListener("click", openEditor);

el.cancelButton.addEventListener("click", function () {
  el.editor.hidden = true;
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
});

// 相性ボタン（有利／互角／不利／超不利）を押したとき
el.difficultyChoices.addEventListener("click", function (event) {
  const button = event.target.closest(".choice");
  if (!button) return;

  // 同じものをもう一度押したら解除する
  const value = button.dataset.value;
  setDifficulty(editingDifficulty === value ? "" : value);
});

// 相性の選択状態を画面に反映する
function setDifficulty(value) {
  editingDifficulty = value;

  el.difficultyChoices.querySelectorAll(".choice").forEach(function (button) {
    const isOn = (button.dataset.value === value);
    button.classList.toggle("is-on", isOn);
  });
}


/* =========================================================
   8) 保存
   ========================================================= */

el.saveButton.addEventListener("click", function () {
  if (!selectedMy || !selectedEnemy) return;

  const allNotes = loadAllNotes();

  allNotes[makeKey(selectedMy.id, selectedEnemy.id)] = {
    myId:      selectedMy.id,
    myName:    selectedMy.name,
    myIcon:    selectedMy.icon,
    enemyId:   selectedEnemy.id,
    enemyName: selectedEnemy.name,
    enemyIcon: selectedEnemy.icon,

    difficulty:   editingDifficulty,
    plan:         el.editPlan.value.trim(),
    avoidSkill:   el.editAvoid.value.trim(),
    tradeTiming:  el.editTrade.value.trim(),
    powerSpike:   el.editSpike.value.trim(),
    counterBuild: el.editBuild.value.trim(),
    early:        el.editEarly.value.trim(),
    mid:          el.editMid.value.trim(),
    late:         el.editLate.value.trim(),
    reflection:   el.editNote.value.trim(),

    updatedAt: new Date().toISOString()
  };

  saveAllNotes(allNotes);

  el.saveMessage.textContent = "✅ 保存しました！";
  el.editor.hidden = true;
  showSheet();
  renderSavedList();
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
});


/* =========================================================
   9) localStorage への読み書き
   ========================================================= */

// マッチアップごとの合い言葉（キー）。例: "Yasuo_vs_Darius"
function makeKey(myId, enemyId) {
  return myId + "_vs_" + enemyId;
}

function loadAllNotes() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("保存データの読み込みに失敗しました", error);
    return {};
  }
}

function saveAllNotes(allNotes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
}


/* =========================================================
   10) 対策ずみマッチアップの一覧
   ========================================================= */

function renderSavedList() {
  const allNotes = loadAllNotes();
  let notes = Object.values(allNotes);

  // 「自分のチャンプだけ」がオンなら、自分のチャンプのものだけ残す
  if (el.filterMine.checked && selectedMy) {
    notes = notes.filter(function (note) {
      return note.myId === selectedMy.id;
    });
  }

  // 更新が新しい順に並べる
  notes.sort(function (a, b) {
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  el.savedList.innerHTML = "";

  if (notes.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "まだ対策を書いたマッチアップはありません。";
    el.savedList.appendChild(p);
    return;
  }

  notes.forEach(function (note) {
    el.savedList.appendChild(createSavedRow(note));
  });
}

// 一覧の1行分。クリックしたら対策シートを開く。
function createSavedRow(note) {
  const row = document.createElement("div");
  row.className = "saved-row";

  // 行をまるごとクリックできるボタンにする
  const open = document.createElement("button");
  open.className = "saved-open";

  const icons = document.createElement("span");
  icons.className = "saved-icons";

  const myImg = document.createElement("img");
  myImg.src = note.myIcon;
  myImg.alt = note.myName;
  myImg.loading = "lazy";

  const enemyImg = document.createElement("img");
  enemyImg.src = note.enemyIcon;
  enemyImg.alt = note.enemyName;
  enemyImg.loading = "lazy";
  enemyImg.className = "saved-icon-enemy";

  icons.appendChild(myImg);
  icons.appendChild(enemyImg);

  const text = document.createElement("span");
  text.className = "saved-text";
  text.textContent = note.myName + " vs " + note.enemyName;

  // 方針のひとことも出しておくと、開かなくても思い出せる
  if (note.plan) {
    const plan = document.createElement("small");
    plan.className = "saved-plan";
    plan.textContent = note.plan;
    text.appendChild(plan);
  }

  open.appendChild(icons);
  open.appendChild(text);

  if (note.difficulty) {
    const badge = document.createElement("span");
    badge.className = "badge badge-small badge-" + note.difficulty;
    badge.textContent = DIFFICULTY_LABELS[note.difficulty];
    open.appendChild(badge);
  }

  open.addEventListener("click", function () {
    openSavedNote(note);
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "btn btn-small btn-delete";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", function () {
    const ok = confirm(note.myName + " vs " + note.enemyName + " の対策を削除しますか？");
    if (!ok) return;

    const allNotes = loadAllNotes();
    delete allNotes[makeKey(note.myId, note.enemyId)];
    saveAllNotes(allNotes);
    renderSavedList();

    // いま開いているシートを消したなら、シートも閉じる
    if (selectedMy && selectedEnemy &&
        selectedMy.id === note.myId && selectedEnemy.id === note.enemyId) {
      showSheet();
    }
  });

  row.appendChild(open);
  row.appendChild(deleteButton);
  return row;
}

// 一覧から対策シートを開く
function openSavedNote(note) {
  // 一覧の中から同じチャンピオンを探す。
  // 見つからないとき（名前が変わった等）は保存データをそのまま使う。
  const my = champions.find(function (c) { return c.id === note.myId; }) ||
             { id: note.myId, name: note.myName, icon: note.myIcon };
  const enemy = champions.find(function (c) { return c.id === note.enemyId; }) ||
                { id: note.enemyId, name: note.enemyName, icon: note.enemyIcon };

  // 自分のチャンプが違うなら、そちらに切り替える
  if (!selectedMy || selectedMy.id !== my.id) {
    setMyChampion(my, true);
  }

  selectedEnemy = enemy;
  renderGrid("enemy");
  el.editor.hidden = true;
  showSheet();
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
}

el.filterMine.addEventListener("change", renderSavedList);


/* =========================================================
   11) 日付を読みやすい形にする
   ========================================================= */

function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return d.getFullYear() + "/" +
         (d.getMonth() + 1) + "/" +
         d.getDate() + " " +
         String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}


/* =========================================================
   12) ページを開いたら実行する
   ========================================================= */

loadChampions();
