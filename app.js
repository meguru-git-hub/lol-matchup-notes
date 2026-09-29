/* =========================================================
   マッチアップ対策シート
   ---------------------------------------------------------
   使いかたの想定
     チャンプセレクトで相手が決まった瞬間にこのサイトを開き、
     相手の名前を入力 → レーン戦の方針をその場で確認する。

   このファイルの中身
     1) Data Dragon からチャンピオン一覧を取ってくる
     2) 五十音（あ行〜わ行）でチャンピオンを絞りこむ
     3) 自分のチャンプを「設定」として覚えておく
     4) 相手を選んだら対策シートを表示する
     5) 相手のスキルを「説明つき・動画つき」で自動表示する
     6) ルーンとビルドを選んで保存する
     7) 全部 localStorage に保存する
   ========================================================= */


/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */

const STORAGE_KEY   = "lolMatchupNotes";   // 対策の保存場所
const MY_CHAMP_KEY  = "lolMyChampion";     // 自分のチャンプの保存場所

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/";
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

// スキル動画の置き場所（Riot の CDN）
const VIDEO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities/";

const DIFFICULTY_LABELS = {
  easy: "有利", even: "互角", hard: "不利", veryhard: "超不利"
};

/* 五十音の行わけ。
   日本語のチャンピオン名はすべてカタカナで始まるので、
   先頭の1文字がどの行に入るかを調べれば絞りこめる。
   濁点（ガ→か行）や半濁点（パ→は行）、ヴ（→あ行）もここに入れておく。 */
const KANA_ROWS = [
  { key: "あ", chars: "アイウエオァィゥェォヴ" },
  { key: "か", chars: "カキクケコガギグゲゴヵヶ" },
  { key: "さ", chars: "サシスセソザジズゼゾ" },
  { key: "た", chars: "タチツテトダヂヅデドッ" },
  { key: "な", chars: "ナニヌネノ" },
  { key: "は", chars: "ハヒフヘホバビブベボパピプペポ" },
  { key: "ま", chars: "マミムメモ" },
  { key: "や", chars: "ヤユヨャュョ" },
  { key: "ら", chars: "ラリルレロ" },
  { key: "わ", chars: "ワヰヱヲンヮ" }
];


/* ---------------------------------------------------------
   全体で使う変数
   --------------------------------------------------------- */

let champions = [];
let latestVersion = "";
let selectedMy = null;
let selectedEnemy = null;

// 五十音フィルターでいま選んでいる行（"" なら全部）
let myRow = "";
let enemyRow = "";

// 一度取ったデータは覚えておいて、二度目からは使いまわす
const spellCache = {};
let runeTrees = null;   // ルーン系統（あとから取ってくる）
let itemList = null;    // アイテム一覧（あとから取ってくる）

// 編集中の状態
let editingDifficulty = "";
let editingRunes = { treeId: null, keystoneId: null, secondaryId: null };
let editingItems = [];      // [{ id, name }]
let editingTreeTab = null;  // 編集画面でいま開いている系統タブ


/* ---------------------------------------------------------
   HTML の要素をまとめて取っておく
   --------------------------------------------------------- */
const el = {
  loadingMessage: document.getElementById("loadingMessage"),

  myIcon:         document.getElementById("myIcon"),
  myName:         document.getElementById("myName"),
  changeMyButton: document.getElementById("changeMyButton"),
  myPicker:       document.getElementById("myPicker"),
  myKana:         document.getElementById("myKana"),
  mySearch:       document.getElementById("mySearch"),
  myGrid:         document.getElementById("myGrid"),

  enemySearch: document.getElementById("enemySearch"),
  enemyKana:   document.getElementById("enemyKana"),
  enemyGrid:   document.getElementById("enemyGrid"),

  sheet:           document.getElementById("sheet"),
  sheetMyIcon:     document.getElementById("sheetMyIcon"),
  sheetEnemyIcon:  document.getElementById("sheetEnemyIcon"),
  sheetTitle:      document.getElementById("sheetTitle"),
  sheetSubtitle:   document.getElementById("sheetSubtitle"),
  sheetDifficulty: document.getElementById("sheetDifficulty"),
  planBox:         document.getElementById("planBox"),
  planText:        document.getElementById("planText"),
  emptySheet:      document.getElementById("emptySheet"),
  createButton:    document.getElementById("createButton"),
  sheetBody:       document.getElementById("sheetBody"),
  viewAvoid:       document.getElementById("viewAvoid"),
  viewTrade:       document.getElementById("viewTrade"),
  viewSpike:       document.getElementById("viewSpike"),
  viewBuild:       document.getElementById("viewBuild"),
  setupBox:        document.getElementById("setupBox"),
  viewRunes:       document.getElementById("viewRunes"),
  viewItems:       document.getElementById("viewItems"),
  phaseBox:        document.getElementById("phaseBox"),
  viewEarly:       document.getElementById("viewEarly"),
  viewMid:         document.getElementById("viewMid"),
  viewLate:        document.getElementById("viewLate"),
  spellList:       document.getElementById("spellList"),
  noteBox:         document.getElementById("noteBox"),
  viewNote:        document.getElementById("viewNote"),
  linkOpgg:        document.getElementById("linkOpgg"),
  linkUgg:         document.getElementById("linkUgg"),
  editButton:      document.getElementById("editButton"),
  sheetUpdated:    document.getElementById("sheetUpdated"),

  editor:            document.getElementById("editor"),
  editorTitle:       document.getElementById("editorTitle"),
  difficultyChoices: document.getElementById("difficultyChoices"),
  editPlan:          document.getElementById("editPlan"),
  editAvoid:         document.getElementById("editAvoid"),
  editTrade:         document.getElementById("editTrade"),
  editSpike:         document.getElementById("editSpike"),
  editBuild:         document.getElementById("editBuild"),
  treeTabs:          document.getElementById("treeTabs"),
  keystoneOptions:   document.getElementById("keystoneOptions"),
  secondaryOptions:  document.getElementById("secondaryOptions"),
  runeLoading:       document.getElementById("runeLoading"),
  pickedItems:       document.getElementById("pickedItems"),
  itemSearch:        document.getElementById("itemSearch"),
  itemLoading:       document.getElementById("itemLoading"),
  itemGrid:          document.getElementById("itemGrid"),
  editEarly:         document.getElementById("editEarly"),
  editMid:           document.getElementById("editMid"),
  editLate:          document.getElementById("editLate"),
  editNote:          document.getElementById("editNote"),
  saveButton:        document.getElementById("saveButton"),
  cancelButton:      document.getElementById("cancelButton"),
  saveMessage:       document.getElementById("saveMessage"),

  filterMine: document.getElementById("filterMine"),
  savedList:  document.getElementById("savedList")
};


/* =========================================================
   1) チャンピオン一覧を取ってくる
   ========================================================= */

async function loadChampions() {
  try {
    const versions = await (await fetch(VERSIONS_URL)).json();
    latestVersion = versions[0];

    const champJson = await (await fetch(
      DDRAGON + latestVersion + "/data/ja_JP/champion.json"
    )).json();

    champions = Object.values(champJson.data).map(function (champ) {
      return {
        id:    champ.id,
        key:   champ.key,      // 数字のID。スキル動画のURLに使う
        name:  champ.name,
        title: champ.title,
        row:   kanaRowOf(champ.name),   // あ行〜わ行のどれか
        // 検索用の文字列。日本語名と英語名を区切り文字なしでつなげておく
        search: normalize(champ.name) + " " + normalize(champ.id),
        icon:  DDRAGON + latestVersion + "/img/champion/" + champ.id + ".png"
      };
    });

    champions.sort(function (a, b) {
      return a.name.localeCompare(b.name, "ja");
    });

    el.loadingMessage.hidden = true;
    renderKanaTabs("my");
    renderKanaTabs("enemy");
    restoreMyChampion();
    renderGrid("my");
    renderGrid("enemy");
    renderSavedList();
    el.enemySearch.focus();

  } catch (error) {
    el.loadingMessage.textContent =
      "チャンピオン一覧を取得できませんでした。インターネット接続を確認して、ページを再読み込みしてください。";
    console.error(error);
  }
}

/* 検索用に文字をそろえる。
   Riot のデータは「ミス・フォーチュン」「ドラン シールド」のように
   区切り文字（・ ＝ 空白）が入っている。でも人は「ミスフォーチュン」
   「ドランシールド」と続けて打つので、そのままでは見つからない。
   そこで比べる前に、区切り文字をぜんぶ取りのぞいておく。 */
function normalize(text) {
  return String(text).toLowerCase().replace(/[\s　・＝=.'’]/g, "");
}

// 名前の先頭文字から「あ行〜わ行」のどれかを返す
function kanaRowOf(name) {
  const first = name.charAt(0);
  const found = KANA_ROWS.find(function (row) {
    return row.chars.includes(first);
  });
  return found ? found.key : "";
}


/* =========================================================
   2) 五十音タブ（あ行〜わ行）
   ========================================================= */

function renderKanaTabs(which) {
  const box = (which === "my") ? el.myKana : el.enemyKana;
  box.innerHTML = "";

  // 「全部」＋ あ行〜わ行
  const tabs = [{ key: "", label: "全" }].concat(
    KANA_ROWS.map(function (row) {
      return { key: row.key, label: row.key };
    })
  );

  tabs.forEach(function (tab) {
    const button = document.createElement("button");
    button.className = "kana-tab";
    button.textContent = tab.label;
    button.dataset.row = tab.key;

    // その行にチャンピオンがいなければ押せなくする
    if (tab.key !== "" && !champions.some(function (c) { return c.row === tab.key; })) {
      button.disabled = true;
    }

    button.addEventListener("click", function () {
      // 行を選んだら検索文字は消す（どちらか一方で探すほうが分かりやすい）
      if (which === "my") {
        myRow = tab.key;
        el.mySearch.value = "";
      } else {
        enemyRow = tab.key;
        el.enemySearch.value = "";
      }
      renderKanaTabs(which);
      renderGrid(which);
    });

    box.appendChild(button);
  });

  // いま選んでいる行に印をつける
  const current = (which === "my") ? myRow : enemyRow;
  const active = box.querySelector('.kana-tab[data-row="' + current + '"]');
  if (active) active.classList.add("is-on");
}


/* =========================================================
   3) 自分のチャンプを覚えておく
   ========================================================= */

function restoreMyChampion() {
  try {
    const saved = localStorage.getItem(MY_CHAMP_KEY);
    if (!saved) {
      el.myPicker.hidden = false;
      return;
    }
    const champ = champions.find(function (c) { return c.id === JSON.parse(saved); });
    if (champ) {
      setMyChampion(champ, false);
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
  if (selectedEnemy) showSheet();
}

el.changeMyButton.addEventListener("click", function () {
  el.myPicker.hidden = !el.myPicker.hidden;
  if (!el.myPicker.hidden) el.mySearch.focus();
});


/* =========================================================
   4) チャンピオン一覧を並べる
   ========================================================= */

function renderGrid(which) {
  const grid      = (which === "my") ? el.myGrid : el.enemyGrid;
  const searchBox = (which === "my") ? el.mySearch : el.enemySearch;
  const selected  = (which === "my") ? selectedMy : selectedEnemy;
  const row       = (which === "my") ? myRow : enemyRow;

  const keyword = normalize(searchBox.value);

  const list = champions.filter(function (champ) {
    // 五十音の行でしぼる
    if (row !== "" && champ.row !== row) return false;
    // 検索文字でしぼる（日本語名でも英語名でも探せる）
    if (keyword === "") return true;
    return champ.search.includes(keyword);
  });

  grid.innerHTML = "";

  if (list.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "見つかりませんでした。";
    grid.appendChild(p);
    return;
  }

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
        el.myPicker.hidden = true;
        el.enemySearch.focus();
      } else {
        selectEnemy(champ);
      }
    });

    grid.appendChild(button);
  });
}

// 検索欄に文字が入ったら、五十音の行は「全」に戻す
el.mySearch.addEventListener("input", function () {
  if (el.mySearch.value !== "") { myRow = ""; renderKanaTabs("my"); }
  renderGrid("my");
});

el.enemySearch.addEventListener("input", function () {
  if (el.enemySearch.value !== "") { enemyRow = ""; renderKanaTabs("enemy"); }
  renderGrid("enemy");
});

// Enter で検索結果の1体目を選ぶ（チャンプセレクトで速い）
el.enemySearch.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  const first = el.enemyGrid.querySelector(".champ");
  if (first) first.click();
});


/* =========================================================
   5) 相手を選んだとき
   ========================================================= */

function selectEnemy(champ) {
  selectedEnemy = champ;
  renderGrid("enemy");

  if (!selectedMy) {
    alert("先に自分のチャンプを設定してください。");
    el.myPicker.hidden = false;
    el.mySearch.focus();
    return;
  }

  el.editor.hidden = true;
  showSheet();
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
}


/* =========================================================
   6) 対策シートを表示する
   ========================================================= */

function showSheet() {
  const note = loadAllNotes()[makeKey(selectedMy.id, selectedEnemy.id)];

  el.sheet.hidden = false;

  // 見出し
  el.sheetMyIcon.src = selectedMy.icon;
  el.sheetMyIcon.alt = selectedMy.name;
  el.sheetEnemyIcon.src = selectedEnemy.icon;
  el.sheetEnemyIcon.alt = selectedEnemy.name;
  el.sheetTitle.textContent = selectedMy.name + " vs " + selectedEnemy.name;
  el.sheetSubtitle.textContent = selectedEnemy.title || "";

  // 相性バッジ
  const difficulty = note ? (note.difficulty || "") : "";
  if (difficulty) {
    el.sheetDifficulty.hidden = false;
    el.sheetDifficulty.textContent = DIFFICULTY_LABELS[difficulty];
    el.sheetDifficulty.className = "badge badge-" + difficulty;
  } else {
    el.sheetDifficulty.hidden = true;
  }

  // 外部サイトへのリンク（相手のチャンピオンのページ）
  const slug = selectedEnemy.id.toLowerCase();
  el.linkOpgg.href = "https://op.gg/lol/champions/" + slug + "/build";
  el.linkUgg.href  = "https://u.gg/lol/champions/" + slug + "/build";

  // 相手のスキル（対策が無くても見られるように先に出す）
  showSpells(selectedEnemy);

  // 対策がまだ無いとき
  if (!note) {
    el.emptySheet.hidden = false;
    el.planBox.hidden = true;
    el.sheetBody.hidden = true;
    el.setupBox.hidden = true;
    el.phaseBox.hidden = true;
    el.noteBox.hidden = true;
    el.editButton.hidden = true;
    el.sheetUpdated.textContent = "";
    return;
  }

  el.emptySheet.hidden = true;
  el.editButton.hidden = false;

  showOrHide(el.planBox, el.planText, note.plan);

  // 4つのポイント。
  // ここで配列を使うのには理由がある。A() || B() と書くと A() が true の時点で
  // B() が実行されず、前に見ていた相手の文章が消えずに残ってしまう（短絡評価）。
  // 配列なら必ず全部が実行されるので、確実に書き換わる。
  const pointsFilled = [
    fillPoint(el.viewAvoid, note.avoidSkill),
    fillPoint(el.viewTrade, note.tradeTiming),
    fillPoint(el.viewSpike, note.powerSpike),
    fillPoint(el.viewBuild, note.counterBuild)
  ];
  el.sheetBody.hidden = !pointsFilled.includes(true);

  // ルーンとビルド
  showSetup(note);

  const phasesFilled = [
    fillPoint(el.viewEarly, note.early),
    fillPoint(el.viewMid,   note.mid),
    fillPoint(el.viewLate,  note.late)
  ];
  el.phaseBox.hidden = !phasesFilled.includes(true);

  showOrHide(el.noteBox, el.viewNote, note.reflection);

  el.sheetUpdated.textContent = "更新: " + formatDate(note.updatedAt);
}

function showOrHide(box, textElement, value) {
  if (value) {
    box.hidden = false;
    textElement.textContent = value;
  } else {
    box.hidden = true;
  }
}

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
   7) ルーンとビルドの表示
   保存するときに名前とアイコンも一緒に入れてあるので、
   表示するだけならルーン/アイテムのデータを取りに行かなくて済む。
   ========================================================= */

function showSetup(note) {
  const runes = note.runes;
  const items = note.items || [];

  el.viewRunes.innerHTML = "";
  el.viewItems.innerHTML = "";

  // --- ルーン ---
  if (runes && runes.keystoneIcon) {
    const keystone = document.createElement("div");
    keystone.className = "rune-main";

    const kImg = document.createElement("img");
    kImg.className = "rune-keystone";
    kImg.src = "https://ddragon.leagueoflegends.com/cdn/img/" + runes.keystoneIcon;
    kImg.alt = runes.keystoneName;
    kImg.title = runes.keystoneName;

    const kText = document.createElement("div");
    kText.className = "rune-text";
    const kName = document.createElement("div");
    kName.className = "rune-name";
    kName.textContent = runes.keystoneName;
    const kTree = document.createElement("div");
    kTree.className = "rune-tree";
    kTree.textContent = runes.treeName + (runes.secondaryName ? " + " + runes.secondaryName : "");
    kText.appendChild(kName);
    kText.appendChild(kTree);

    keystone.appendChild(kImg);
    keystone.appendChild(kText);

    // サブ系統のアイコン
    if (runes.secondaryIcon) {
      const sImg = document.createElement("img");
      sImg.className = "rune-secondary";
      sImg.src = "https://ddragon.leagueoflegends.com/cdn/img/" + runes.secondaryIcon;
      sImg.alt = runes.secondaryName;
      sImg.title = "サブ: " + runes.secondaryName;
      keystone.appendChild(sImg);
    }

    el.viewRunes.appendChild(keystone);
  } else {
    el.viewRunes.appendChild(blankText("未設定"));
  }

  // --- ビルド ---
  if (items.length > 0) {
    items.forEach(function (item) {
      const img = document.createElement("img");
      img.className = "item-icon";
      img.src = DDRAGON + latestVersion + "/img/item/" + item.id + ".png";
      img.alt = item.name;
      img.title = item.name;
      img.loading = "lazy";
      el.viewItems.appendChild(img);
    });
  } else {
    el.viewItems.appendChild(blankText("未設定"));
  }

  // ルーンもビルドも空なら枠ごと隠す
  const hasRunes = !!(runes && runes.keystoneIcon);
  el.setupBox.hidden = !(hasRunes || items.length > 0);
}

function blankText(text) {
  const span = document.createElement("span");
  span.className = "is-blank";
  span.textContent = text;
  return span;
}


/* =========================================================
   8) 相手のスキルを表示する（説明つき・動画つき）
   ========================================================= */

async function showSpells(champ) {
  el.spellList.innerHTML = '<p class="loading">読み込み中…</p>';

  try {
    let data = spellCache[champ.id];

    if (!data) {
      const json = await (await fetch(
        DDRAGON + latestVersion + "/data/ja_JP/champion/" + champ.id + ".json"
      )).json();
      data = json.data[champ.id];
      spellCache[champ.id] = data;
    }

    // 待っている間に別の相手へ変えられていたら、この結果は捨てる
    if (!selectedEnemy || selectedEnemy.id !== champ.id) return;

    el.spellList.innerHTML = "";

    // 動画URLに使う4桁の番号（例: 122 → "0122"）
    const key4 = String(champ.key).padStart(4, "0");

    // パッシブ
    el.spellList.appendChild(createSpellRow({
      keyLabel: "P",
      name: data.passive.name,
      cooldown: "",
      description: data.passive.description,
      iconUrl: DDRAGON + latestVersion + "/img/passive/" + data.passive.image.full,
      videoUrl: VIDEO_BASE + key4 + "/ability_" + key4 + "_P1.webm"
    }));

    // Q W E R
    const keys = ["Q", "W", "E", "R"];
    data.spells.forEach(function (spell, index) {
      el.spellList.appendChild(createSpellRow({
        keyLabel: keys[index],
        name: spell.name,
        cooldown: "CD " + spell.cooldownBurn + "秒",
        description: spell.description,
        iconUrl: DDRAGON + latestVersion + "/img/spell/" + spell.image.full,
        videoUrl: VIDEO_BASE + key4 + "/ability_" + key4 + "_" + keys[index] + "1.webm"
      }));
    });

  } catch (error) {
    el.spellList.innerHTML = '<p class="loading">スキル情報を取得できませんでした。</p>';
    console.error(error);
  }
}

// スキル1つ分の表示を作る
function createSpellRow(spell) {
  const row = document.createElement("div");
  row.className = "spell";

  // 上の行：キー・アイコン・名前・CD・動画ボタン
  const head = document.createElement("div");
  head.className = "spell-head";

  const keyTag = document.createElement("span");
  keyTag.className = "spell-key";
  keyTag.textContent = spell.keyLabel;

  const img = document.createElement("img");
  img.className = "spell-icon";
  img.src = spell.iconUrl;
  img.alt = spell.name;
  img.loading = "lazy";

  const nameEl = document.createElement("span");
  nameEl.className = "spell-name";
  nameEl.textContent = spell.name;

  const cdEl = document.createElement("span");
  cdEl.className = "spell-cd";
  cdEl.textContent = spell.cooldown;

  // 動画は重いので、押されたときだけ読み込む
  const videoButton = document.createElement("button");
  videoButton.className = "btn btn-small spell-video-button";
  videoButton.textContent = "▶ 動画";

  head.appendChild(keyTag);
  head.appendChild(img);
  head.appendChild(nameEl);
  head.appendChild(cdEl);
  head.appendChild(videoButton);

  // 下の行：効果の説明
  const desc = document.createElement("p");
  desc.className = "spell-desc";
  desc.textContent = spell.description;

  // 動画を入れる場所（最初は空）
  const videoBox = document.createElement("div");
  videoBox.className = "spell-video";

  videoButton.addEventListener("click", function () {
    // すでに開いていたら閉じる
    if (videoBox.firstChild) {
      videoBox.innerHTML = "";
      videoButton.textContent = "▶ 動画";
      return;
    }

    const video = document.createElement("video");
    video.src = spell.videoUrl;
    video.controls = true;
    video.autoplay = true;
    video.muted = true;       // 自動再生させるには音を消す必要がある
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    // 動画が無いチャンピオン/スキルもありうるので、その時は文字で知らせる
    video.addEventListener("error", function () {
      videoBox.innerHTML = '<p class="loading">この動画は見つかりませんでした。</p>';
    });

    videoBox.appendChild(video);
    videoButton.textContent = "■ 閉じる";
  });

  row.appendChild(head);
  row.appendChild(desc);
  row.appendChild(videoBox);
  return row;
}


/* =========================================================
   9) ルーンのデータを取ってくる（編集画面を開いたときだけ）
   ========================================================= */

async function loadRunes() {
  if (runeTrees) return runeTrees;   // すでに持っていれば使いまわす

  el.runeLoading.hidden = false;
  try {
    runeTrees = await (await fetch(
      DDRAGON + latestVersion + "/data/ja_JP/runesReforged.json"
    )).json();
  } catch (error) {
    console.error("ルーン情報の取得に失敗しました", error);
    el.runeLoading.textContent = "ルーン情報を取得できませんでした。";
    return null;
  }
  el.runeLoading.hidden = true;
  return runeTrees;
}

// メイン系統のタブを並べる
function renderTreeTabs() {
  el.treeTabs.innerHTML = "";
  if (!runeTrees) return;

  runeTrees.forEach(function (tree) {
    el.treeTabs.appendChild(createTreeButton(tree, editingTreeTab === tree.id, function () {
      editingTreeTab = tree.id;
      renderTreeTabs();
      renderKeystones();
    }));
  });
}

// いま開いている系統のキーストーンを並べる
function renderKeystones() {
  el.keystoneOptions.innerHTML = "";
  if (!runeTrees) return;

  const tree = runeTrees.find(function (t) { return t.id === editingTreeTab; });
  if (!tree) return;

  tree.slots[0].runes.forEach(function (rune) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "keystone";
    if (editingRunes.keystoneId === rune.id) button.classList.add("is-on");

    const img = document.createElement("img");
    img.src = "https://ddragon.leagueoflegends.com/cdn/img/" + rune.icon;
    img.alt = rune.name;
    img.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = rune.name;

    button.appendChild(img);
    button.appendChild(label);

    button.addEventListener("click", function () {
      // 同じものを押したら解除
      if (editingRunes.keystoneId === rune.id) {
        editingRunes.keystoneId = null;
        editingRunes.treeId = null;
      } else {
        editingRunes.keystoneId = rune.id;
        editingRunes.treeId = tree.id;
        // メインに選んだ系統がサブにも入っていたらサブを外す
        if (editingRunes.secondaryId === tree.id) editingRunes.secondaryId = null;
      }
      renderKeystones();
      renderSecondary();
    });

    el.keystoneOptions.appendChild(button);
  });
}

// サブ系統を並べる（メインに選んだ系統は選べない）
function renderSecondary() {
  el.secondaryOptions.innerHTML = "";
  if (!runeTrees) return;

  runeTrees.forEach(function (tree) {
    const isMain = (editingRunes.treeId === tree.id);
    const button = createTreeButton(tree, editingRunes.secondaryId === tree.id, function () {
      editingRunes.secondaryId =
        (editingRunes.secondaryId === tree.id) ? null : tree.id;
      renderSecondary();
    });
    if (isMain) button.disabled = true;
    el.secondaryOptions.appendChild(button);
  });
}

// 系統1つ分のボタンを作る（メインのタブとサブの選択で共用）
function createTreeButton(tree, isOn, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree";
  if (isOn) button.classList.add("is-on");

  const img = document.createElement("img");
  img.src = "https://ddragon.leagueoflegends.com/cdn/img/" + tree.icon;
  img.alt = tree.name;
  img.loading = "lazy";

  const label = document.createElement("span");
  label.textContent = tree.name;

  button.appendChild(img);
  button.appendChild(label);
  button.addEventListener("click", onClick);
  return button;
}


/* =========================================================
   10) アイテムのデータを取ってくる（編集画面を開いたときだけ）
   ========================================================= */

async function loadItems() {
  if (itemList) return itemList;

  el.itemLoading.hidden = false;
  try {
    const json = await (await fetch(
      DDRAGON + latestVersion + "/data/ja_JP/item.json"
    )).json();

    // 全870種のうち、サモナーズリフトで買える本体アイテムだけに絞る
    itemList = Object.entries(json.data)
      .filter(function (entry) {
        const item = entry[1];
        return item.gold && item.gold.purchasable &&   // 買えるもの
               item.gold.total >= 400 &&               // 安すぎる部品は除く
               item.inStore !== false &&               // ショップに並ぶもの
               !item.consumed &&                       // ポーションなど消耗品は除く
               !item.requiredAlly &&                   // オーンの強化版は除く
               item.maps && item.maps["11"];           // サモナーズリフト用
      })
      .map(function (entry) {
        return {
          id:     entry[0],
          name:   entry[1].name,
          gold:   entry[1].gold.total,
          search: normalize(entry[1].name)
        };
      })
      .sort(function (a, b) { return a.gold - b.gold; });

  } catch (error) {
    console.error("アイテム情報の取得に失敗しました", error);
    el.itemLoading.textContent = "アイテム情報を取得できませんでした。";
    return null;
  }
  el.itemLoading.hidden = true;
  return itemList;
}

// 検索にあてはまるアイテムを並べる
function renderItemGrid() {
  el.itemGrid.innerHTML = "";
  if (!itemList) return;

  const keyword = normalize(el.itemSearch.value);

  // 検索していないときは全部出すと多すぎるので、値段の高い順に60個だけ出す
  let list;
  if (keyword === "") {
    list = itemList.slice().sort(function (a, b) { return b.gold - a.gold; }).slice(0, 60);
  } else {
    list = itemList.filter(function (item) {
      return item.search.includes(keyword);
    });
  }

  if (list.length === 0) {
    el.itemGrid.appendChild(blankText("見つかりませんでした。"));
    return;
  }

  list.forEach(function (item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "champ";
    button.title = item.name + "（" + item.gold + "G）";

    const img = document.createElement("img");
    img.src = DDRAGON + latestVersion + "/img/item/" + item.id + ".png";
    img.alt = item.name;
    img.loading = "lazy";
    button.appendChild(img);

    button.addEventListener("click", function () {
      addItem(item);
    });

    el.itemGrid.appendChild(button);
  });
}

// ビルドにアイテムを足す（最大6つ）
function addItem(item) {
  if (editingItems.length >= 6) {
    el.saveMessage.textContent = "ビルドは6つまでです。";
    return;
  }
  editingItems.push({ id: item.id, name: item.name });
  renderPickedItems();
}

// 選んだアイテムを並べる（押すと外せる）
function renderPickedItems() {
  el.pickedItems.innerHTML = "";

  if (editingItems.length === 0) {
    el.pickedItems.appendChild(blankText("まだ選んでいません（下から選ぶ）"));
    return;
  }

  editingItems.forEach(function (item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "picked-item";
    button.title = item.name + "（押すと外す）";

    const img = document.createElement("img");
    img.src = DDRAGON + latestVersion + "/img/item/" + item.id + ".png";
    img.alt = item.name;
    button.appendChild(img);

    const order = document.createElement("span");
    order.className = "picked-order";
    order.textContent = index + 1;
    button.appendChild(order);

    button.addEventListener("click", function () {
      editingItems.splice(index, 1);
      renderPickedItems();
    });

    el.pickedItems.appendChild(button);
  });
}

el.itemSearch.addEventListener("input", renderItemGrid);


/* =========================================================
   11) 編集フォーム
   ========================================================= */

async function openEditor() {
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

  // ルーンとビルドの編集状態を用意する
  editingRunes = {
    treeId:      note.runes ? (note.runes.treeId      || null) : null,
    keystoneId:  note.runes ? (note.runes.keystoneId  || null) : null,
    secondaryId: note.runes ? (note.runes.secondaryId || null) : null
  };
  // 保存されている系統のタブを開いておく（無ければ最初の系統）
  editingTreeTab = editingRunes.treeId;

  editingItems = (note.items || []).map(function (item) {
    return { id: item.id, name: item.name };
  });
  renderPickedItems();

  el.saveMessage.textContent = "";
  el.editor.hidden = false;
  el.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  el.editPlan.focus();

  // ルーンとアイテムのデータは重いので、ここで初めて取ってくる
  await loadRunes();
  if (runeTrees) {
    if (editingTreeTab === null) editingTreeTab = runeTrees[0].id;
    renderTreeTabs();
    renderKeystones();
    renderSecondary();
  }

  await loadItems();
  renderItemGrid();
}

el.editButton.addEventListener("click", openEditor);
el.createButton.addEventListener("click", openEditor);

el.cancelButton.addEventListener("click", function () {
  el.editor.hidden = true;
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
});

el.difficultyChoices.addEventListener("click", function (event) {
  const button = event.target.closest(".choice");
  if (!button) return;
  const value = button.dataset.value;
  setDifficulty(editingDifficulty === value ? "" : value);
});

function setDifficulty(value) {
  editingDifficulty = value;
  el.difficultyChoices.querySelectorAll(".choice").forEach(function (button) {
    button.classList.toggle("is-on", button.dataset.value === value);
  });
}


/* =========================================================
   12) 保存
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

    runes: buildRuneData(),
    items: editingItems.slice(),

    updatedAt: new Date().toISOString()
  };

  saveAllNotes(allNotes);

  el.saveMessage.textContent = "保存しました。";
  el.editor.hidden = true;
  showSheet();
  renderSavedList();
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* 保存用のルーン情報を作る。
   名前とアイコンも一緒に入れておくと、シートを表示するときに
   ルーンのデータを取りに行かなくて済む（表示が速くなる）。 */
function buildRuneData() {
  if (!editingRunes.keystoneId || !runeTrees) return null;

  const tree = runeTrees.find(function (t) { return t.id === editingRunes.treeId; });
  if (!tree) return null;

  const keystone = tree.slots[0].runes.find(function (r) {
    return r.id === editingRunes.keystoneId;
  });
  if (!keystone) return null;

  const secondary = runeTrees.find(function (t) {
    return t.id === editingRunes.secondaryId;
  });

  return {
    treeId:        tree.id,
    treeName:      tree.name,
    keystoneId:    keystone.id,
    keystoneName:  keystone.name,
    keystoneIcon:  keystone.icon,
    secondaryId:   secondary ? secondary.id   : null,
    secondaryName: secondary ? secondary.name : "",
    secondaryIcon: secondary ? secondary.icon : ""
  };
}


/* =========================================================
   13) localStorage への読み書き
   ========================================================= */

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
   14) 対策ずみマッチアップの一覧
   ========================================================= */

function renderSavedList() {
  const allNotes = loadAllNotes();
  let notes = Object.values(allNotes);

  if (el.filterMine.checked && selectedMy) {
    notes = notes.filter(function (note) { return note.myId === selectedMy.id; });
  }

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

function createSavedRow(note) {
  const row = document.createElement("div");
  row.className = "saved-row";

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

  open.addEventListener("click", function () { openSavedNote(note); });

  const deleteButton = document.createElement("button");
  deleteButton.className = "btn btn-small btn-delete";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", function () {
    if (!confirm(note.myName + " vs " + note.enemyName + " の対策を削除しますか？")) return;

    const allNotes = loadAllNotes();
    delete allNotes[makeKey(note.myId, note.enemyId)];
    saveAllNotes(allNotes);
    renderSavedList();

    if (selectedMy && selectedEnemy &&
        selectedMy.id === note.myId && selectedEnemy.id === note.enemyId) {
      showSheet();
    }
  });

  row.appendChild(open);
  row.appendChild(deleteButton);
  return row;
}

function openSavedNote(note) {
  const my = champions.find(function (c) { return c.id === note.myId; }) ||
             { id: note.myId, name: note.myName, icon: note.myIcon };
  const enemy = champions.find(function (c) { return c.id === note.enemyId; }) ||
                { id: note.enemyId, name: note.enemyName, icon: note.enemyIcon };

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
   15) 日付を読みやすい形にする
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
   16) ページを開いたら実行する
   ========================================================= */

loadChampions();
