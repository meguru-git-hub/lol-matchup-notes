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
     5) スキルを「説明つき・動画つき」で表示（相手／自分を切り替えられる）
     6) ルーンとビルドを選んで保存する（チャンピオンごとの「基本形」も持てる）
     7) 全部 localStorage に保存する
   ========================================================= */


/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */

const STORAGE_KEY  = "lolMatchupNotes";    // 対策の保存場所
const MY_CHAMP_KEY = "lolMyChampion";      // 自分のチャンプの保存場所
const BASICS_KEY   = "lolChampionBasics";  // チャンピオンごとの基本ルーン/ビルド

const DDRAGON = "https://ddragon.leagueoflegends.com/cdn/";
const DDRAGON_IMG = "https://ddragon.leagueoflegends.com/cdn/img/";
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

// スキル動画の置き場所（Riot の CDN）
const VIDEO_BASE = "https://d28xe8vt774jo5.cloudfront.net/champion-abilities/";

const DIFFICULTY_LABELS = {
  easy: "有利", even: "互角", hard: "不利", veryhard: "超不利"
};

// チャンピオンの分類を日本語にする
const TAG_LABELS = {
  Fighter: "ファイター", Tank: "タンク", Mage: "メイジ",
  Assassin: "アサシン", Marksman: "マークスマン", Support: "サポート"
};

/* スキルの説明文に入っているタグを、どの色で出すか。
   Riot のデータには <magicDamage>魔法ダメージ</magicDamage> のような
   目印が埋めこまれている。ゲーム本編ではこれが色分けされているので、
   同じように色をつけて読みやすくする。 */
const KEYWORD_CLASS = {
  magicdamage:    "kw-magic",
  physicaldamage: "kw-physical",
  truedamage:     "kw-true",
  healing:        "kw-heal",
  shield:         "kw-shield",
  speed:          "kw-speed",
  status:         "kw-status",
  onhit:          "kw-onhit",
  keywordmajor:   "kw-major",
  keywordname:    "kw-major",
  spellname:      "kw-spell",
  passive:        "kw-label",
  active:         "kw-label",
  maintext:       ""          // ただの囲みなので色はつけない
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

let myRow = "";      // 五十音フィルターでいま選んでいる行（"" なら全部）
let enemyRow = "";

let skillTab = "enemy";   // スキル欄で「相手」と「自分」のどちらを見ているか

// 一度取ったデータは覚えておいて、二度目からは使いまわす
const spellCache = {};
let runeTrees = null;
let itemList = null;

// 編集中の状態
let editingDifficulty = "";
let editingRunes = { treeId: null, keystoneId: null, secondaryId: null };
let editingItems = [];
let editingTreeTab = null;


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
  sheetHead:       document.getElementById("sheetHead"),
  sheetMyFace:     document.getElementById("sheetMyFace"),
  sheetEnemyFace:  document.getElementById("sheetEnemyFace"),
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
  runeBasicTag:    document.getElementById("runeBasicTag"),
  itemBasicTag:    document.getElementById("itemBasicTag"),
  phaseBox:        document.getElementById("phaseBox"),
  viewEarly:       document.getElementById("viewEarly"),
  viewMid:         document.getElementById("viewMid"),
  viewLate:        document.getElementById("viewLate"),
  tabEnemy:        document.getElementById("tabEnemy"),
  tabMy:           document.getElementById("tabMy"),
  champInfo:       document.getElementById("champInfo"),
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
  loadBasicButton:   document.getElementById("loadBasicButton"),
  saveBasicButton:   document.getElementById("saveBasicButton"),
  basicStatus:       document.getElementById("basicStatus"),
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
        row:   kanaRowOf(champ.name),
        search: normalize(champ.name) + " " + normalize(champ.id),
        icon:  DDRAGON + latestVersion + "/img/champion/" + champ.id + ".png",
        splash: DDRAGON_IMG + "champion/splash/" + champ.id + "_0.jpg"
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

  const tabs = [{ key: "", label: "全" }].concat(
    KANA_ROWS.map(function (row) { return { key: row.key, label: row.key }; })
  );

  tabs.forEach(function (tab) {
    const button = document.createElement("button");
    button.className = "kana-tab";
    button.textContent = tab.label;
    button.dataset.row = tab.key;

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
    if (!saved) { el.myPicker.hidden = false; return; }

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
    if (row !== "" && champ.row !== row) return false;
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
  skillTab = "enemy";        // 相手を選び直したら、スキル欄は相手に戻す
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

  el.sheetMyFace.title = selectedMy.name + " のスキルを見る";
  el.sheetEnemyFace.title = selectedEnemy.name + " のスキルを見る";

  // 見出しの背景に、相手のスプラッシュアートをうっすら敷く
  el.sheetHead.style.backgroundImage =
    "linear-gradient(90deg, rgba(10,22,38,0.97) 28%, rgba(10,22,38,0.55) 100%), " +
    "url('" + selectedEnemy.splash + "')";

  // 相性バッジ
  const difficulty = note ? (note.difficulty || "") : "";
  if (difficulty) {
    el.sheetDifficulty.hidden = false;
    el.sheetDifficulty.textContent = DIFFICULTY_LABELS[difficulty];
    el.sheetDifficulty.className = "badge badge-" + difficulty;
  } else {
    el.sheetDifficulty.hidden = true;
  }

  // 外部サイトへのリンク
  const slug = selectedEnemy.id.toLowerCase();
  el.linkOpgg.href = "https://op.gg/lol/champions/" + slug + "/build";
  el.linkUgg.href  = "https://u.gg/lol/champions/" + slug + "/build";

  // スキル欄（対策が無くても見られるように先に出す）
  renderSkillTabs();
  showSpells(skillChampion());

  // 対策がまだ無いとき
  if (!note) {
    el.emptySheet.hidden = false;
    el.planBox.hidden = true;
    el.sheetBody.hidden = true;
    el.phaseBox.hidden = true;
    el.noteBox.hidden = true;
    el.editButton.hidden = true;
    el.sheetUpdated.textContent = "";
    showSetup(null);          // 対策が無くても「基本形」があれば出す
    return;
  }

  el.emptySheet.hidden = true;
  el.editButton.hidden = false;

  showOrHide(el.planBox, el.planText, note.plan);

  /* 4つのポイント。
     ここで配列を使うのには理由がある。A() || B() と書くと A() が true の時点で
     B() が実行されず、前に見ていた相手の文章が消えずに残ってしまう（短絡評価）。
     配列なら必ず全部が実行されるので、確実に書き換わる。 */
  const pointsFilled = [
    fillPoint(el.viewAvoid, note.avoidSkill),
    fillPoint(el.viewTrade, note.tradeTiming),
    fillPoint(el.viewSpike, note.powerSpike),
    fillPoint(el.viewBuild, note.counterBuild)
  ];
  el.sheetBody.hidden = !pointsFilled.includes(true);

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
   このマッチアップ専用のものが無ければ、
   チャンピオンの「基本形」を（基本形だと分かる印つきで）出す。
   ========================================================= */

function showSetup(note) {
  const basic = getBasic(selectedMy.id);

  // ルーン：マッチアップ専用 → 無ければ基本形
  let runes = note && note.runes ? note.runes : null;
  let runesAreBasic = false;
  if (!runes && basic && basic.runes) { runes = basic.runes; runesAreBasic = true; }

  // ビルド：同じ考えかた
  let items = note && note.items && note.items.length > 0 ? note.items : null;
  let itemsAreBasic = false;
  if (!items && basic && basic.items && basic.items.length > 0) {
    items = basic.items; itemsAreBasic = true;
  }

  el.viewRunes.innerHTML = "";
  el.viewItems.innerHTML = "";
  el.runeBasicTag.hidden = !runesAreBasic;
  el.itemBasicTag.hidden = !itemsAreBasic;

  // --- ルーン ---
  if (runes && runes.keystoneIcon) {
    const box = document.createElement("div");
    box.className = "rune-main";

    const kImg = document.createElement("img");
    kImg.className = "rune-keystone";
    kImg.src = DDRAGON_IMG + runes.keystoneIcon;
    kImg.alt = runes.keystoneName;
    kImg.title = runes.keystoneName;

    const text = document.createElement("div");
    text.className = "rune-text";

    const name = document.createElement("div");
    name.className = "rune-name";
    name.textContent = runes.keystoneName;

    const tree = document.createElement("div");
    tree.className = "rune-tree";
    tree.textContent = runes.treeName + (runes.secondaryName ? " + " + runes.secondaryName : "");

    text.appendChild(name);
    text.appendChild(tree);
    box.appendChild(kImg);
    box.appendChild(text);

    if (runes.secondaryIcon) {
      const sImg = document.createElement("img");
      sImg.className = "rune-secondary";
      sImg.src = DDRAGON_IMG + runes.secondaryIcon;
      sImg.alt = runes.secondaryName;
      sImg.title = "サブ: " + runes.secondaryName;
      box.appendChild(sImg);
    }

    el.viewRunes.appendChild(box);
  } else {
    el.viewRunes.appendChild(blankText("未設定"));
  }

  // --- ビルド ---
  if (items) {
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

  const hasRunes = !!(runes && runes.keystoneIcon);
  el.setupBox.hidden = !(hasRunes || items);
}

function blankText(text) {
  const span = document.createElement("span");
  span.className = "is-blank";
  span.textContent = text;
  return span;
}


/* =========================================================
   8) チャンピオンごとの「基本形」
   毎回ゼロから選ばなくていいように、
   よく使うルーンとビルドをチャンピオン単位で覚えておく。
   ========================================================= */

function loadBasics() {
  try {
    const text = localStorage.getItem(BASICS_KEY);
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("基本形の読み込みに失敗しました", error);
    return {};
  }
}

function getBasic(champId) {
  return loadBasics()[champId] || null;
}

function saveBasic(champId, data) {
  const all = loadBasics();
  all[champId] = data;
  localStorage.setItem(BASICS_KEY, JSON.stringify(all));
}


/* =========================================================
   9) スキル欄のタブ（相手／自分）
   ========================================================= */

// いまスキル欄に出すべきチャンピオン
function skillChampion() {
  return (skillTab === "my") ? selectedMy : selectedEnemy;
}

function renderSkillTabs() {
  el.tabEnemy.textContent = "相手（" + selectedEnemy.name + "）";
  el.tabMy.textContent    = "自分（" + selectedMy.name + "）";
  el.tabEnemy.classList.toggle("is-on", skillTab === "enemy");
  el.tabMy.classList.toggle("is-on", skillTab === "my");
}

function switchSkillTab(which) {
  if (!selectedMy || !selectedEnemy) return;
  skillTab = which;
  renderSkillTabs();
  showSpells(skillChampion());
}

el.tabEnemy.addEventListener("click", function () { switchSkillTab("enemy"); });
el.tabMy.addEventListener("click",    function () { switchSkillTab("my"); });

// 見出しのアイコンを押しても切り替わる
el.sheetEnemyFace.addEventListener("click", function () { switchSkillTab("enemy"); });
el.sheetMyFace.addEventListener("click",    function () { switchSkillTab("my"); });


/* =========================================================
   10) スキルを表示する（説明つき・動画つき）
   ========================================================= */

async function showSpells(champ) {
  if (!champ) return;

  el.spellList.innerHTML = '<p class="loading">読み込み中…</p>';
  el.champInfo.innerHTML = "";

  try {
    let data = spellCache[champ.id];

    if (!data) {
      const json = await (await fetch(
        DDRAGON + latestVersion + "/data/ja_JP/champion/" + champ.id + ".json"
      )).json();
      data = json.data[champ.id];
      spellCache[champ.id] = data;
    }

    // 待っている間にタブや相手を変えられていたら、この結果は捨てる
    const wanted = skillChampion();
    if (!wanted || wanted.id !== champ.id) return;

    renderChampInfo(data);
    el.spellList.innerHTML = "";

    // 動画URLに使う4桁の番号（例: 122 → "0122"）
    const key4 = String(champ.key).padStart(4, "0");

    el.spellList.appendChild(createSpellRow({
      keyLabel: "P",
      name: data.passive.name,
      cooldown: "",
      description: data.passive.description,
      iconUrl: DDRAGON + latestVersion + "/img/passive/" + data.passive.image.full,
      videoUrl: VIDEO_BASE + key4 + "/ability_" + key4 + "_P1.webm"
    }));

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

// チャンピオンの特徴（分類と能力の目安）を出す
function renderChampInfo(data) {
  el.champInfo.innerHTML = "";

  const tags = document.createElement("div");
  tags.className = "champ-tags";
  (data.tags || []).forEach(function (tag) {
    const span = document.createElement("span");
    span.className = "champ-tag";
    span.textContent = TAG_LABELS[tag] || tag;
    tags.appendChild(span);
  });

  const bars = document.createElement("div");
  bars.className = "champ-bars";
  const info = data.info || {};
  [["攻撃", info.attack], ["防御", info.defense], ["魔法", info.magic], ["難度", info.difficulty]]
    .forEach(function (pair) {
      bars.appendChild(createBar(pair[0], pair[1] || 0));
    });

  el.champInfo.appendChild(tags);
  el.champInfo.appendChild(bars);
}

// 「攻撃 ▮▮▮▮▮▮▮▮▯▯」のような目盛りを作る（0〜10）
function createBar(label, value) {
  const box = document.createElement("div");
  box.className = "champ-bar";

  const name = document.createElement("span");
  name.className = "champ-bar-label";
  name.textContent = label;

  const track = document.createElement("span");
  track.className = "champ-bar-track";

  const fill = document.createElement("span");
  fill.className = "champ-bar-fill";
  fill.style.width = Math.max(0, Math.min(10, value)) * 10 + "%";

  track.appendChild(fill);
  box.appendChild(name);
  box.appendChild(track);
  return box;
}

// スキル1つ分の表示を作る
function createSpellRow(spell) {
  const row = document.createElement("div");
  row.className = "spell";

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

  // 効果の説明（Riot のタグを色分けして表示する）
  const desc = document.createElement("p");
  desc.className = "spell-desc";
  renderDescription(desc, spell.description);

  const videoBox = document.createElement("div");
  videoBox.className = "spell-video";

  videoButton.addEventListener("click", function () {
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
   11) スキル説明文の組み立て
   ---------------------------------------------------------
   Riot の説明文には、こういうタグが埋めこまれている。

     追加<magicDamage>魔法ダメージ</magicDamage>を与える。<br>次に…
     <font color='#9b0f5f'>「呪い」</font>をかける。

   そのまま文字として出すと「</font>」のような記号が見えてしまうので、
   ・<br> は改行にする
   ・そのほかのタグは消して、中の文字に色をつける
   という処理をする。173体のうち85体でこのタグが使われている。
   ========================================================= */

function renderDescription(target, raw) {
  target.textContent = "";
  if (!raw) return;

  // <br> と <br /> を改行に置きかえる（CSS の white-space: pre-wrap で改行として出る）
  const text = String(raw).replace(/<br\s*\/?>/gi, "\n");

  // 「タグ」と「ふつうの文字」に切り分ける。
  // split の正規表現を括弧でくくると、区切りに使ったタグも配列に残る。
  const parts = text.split(/(<\/?[a-zA-Z][^>]*>)/);

  // いま何のタグの中にいるかを覚えておく入れもの
  const openTags = [];

  parts.forEach(function (part) {
    if (!part) return;

    // 閉じタグ（</font> など）なら、ひとつ戻る
    if (/^<\/\s*[a-zA-Z]/.test(part)) {
      openTags.pop();
      return;
    }

    // 開きタグ（<font color='...'> など）なら、名前を覚える
    const opening = part.match(/^<\s*([a-zA-Z][^>\s\/]*)/);
    if (opening) {
      openTags.push(opening[1].toLowerCase());
      return;
    }

    // ここはふつうの文字。いちばん内側のタグに応じて色をつける
    const tag = openTags[openTags.length - 1];
    const className = classForTag(tag);

    if (className) {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = part;
      target.appendChild(span);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}

// タグの名前から、使うCSSクラスを決める
function classForTag(tag) {
  if (!tag) return "";                                  // タグの外側 → ふつうの文字
  if (KEYWORD_CLASS[tag] !== undefined) return KEYWORD_CLASS[tag];
  return "kw-em";   // 知らないタグ（font や factionIonia など）は共通の強調にする
}


/* =========================================================
   12) ルーンのデータを取ってくる（編集画面を開いたときだけ）
   ========================================================= */

async function loadRunes() {
  if (runeTrees) return runeTrees;

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
    img.src = DDRAGON_IMG + rune.icon;
    img.alt = rune.name;
    img.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = rune.name;

    button.appendChild(img);
    button.appendChild(label);

    button.addEventListener("click", function () {
      if (editingRunes.keystoneId === rune.id) {
        editingRunes.keystoneId = null;
        editingRunes.treeId = null;
      } else {
        editingRunes.keystoneId = rune.id;
        editingRunes.treeId = tree.id;
        if (editingRunes.secondaryId === tree.id) editingRunes.secondaryId = null;
      }
      renderKeystones();
      renderSecondary();
    });

    el.keystoneOptions.appendChild(button);
  });
}

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

function createTreeButton(tree, isOn, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tree";
  if (isOn) button.classList.add("is-on");

  const img = document.createElement("img");
  img.src = DDRAGON_IMG + tree.icon;
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
   13) アイテムのデータを取ってくる（編集画面を開いたときだけ）
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
        return item.gold && item.gold.purchasable &&
               item.gold.total >= 400 &&
               item.inStore !== false &&
               !item.consumed &&
               !item.requiredAlly &&
               item.maps && item.maps["11"];
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

function renderItemGrid() {
  el.itemGrid.innerHTML = "";
  if (!itemList) return;

  const keyword = normalize(el.itemSearch.value);

  // 検索していないときは全部出すと多すぎるので、値段の高い順に60個だけ出す
  let list;
  if (keyword === "") {
    list = itemList.slice().sort(function (a, b) { return b.gold - a.gold; }).slice(0, 60);
  } else {
    list = itemList.filter(function (item) { return item.search.includes(keyword); });
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

    button.addEventListener("click", function () { addItem(item); });

    el.itemGrid.appendChild(button);
  });
}

function addItem(item) {
  if (editingItems.length >= 6) {
    el.saveMessage.textContent = "ビルドは6つまでです。";
    return;
  }
  editingItems.push({ id: item.id, name: item.name });
  renderPickedItems();
}

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
   14) 編集フォーム
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

  // ルーンとビルド。
  // このマッチアップにまだ何も入っていなければ、基本形を下書きとして入れておく。
  const basic = getBasic(selectedMy.id);
  const hasOwnSetup = !!note.runes || (note.items && note.items.length > 0);
  const source = hasOwnSetup ? note : (basic || {});

  editingRunes = {
    treeId:      source.runes ? (source.runes.treeId      || null) : null,
    keystoneId:  source.runes ? (source.runes.keystoneId  || null) : null,
    secondaryId: source.runes ? (source.runes.secondaryId || null) : null
  };
  editingItems = (source.items || []).map(function (item) {
    return { id: item.id, name: item.name };
  });
  editingTreeTab = editingRunes.treeId;

  renderPickedItems();
  updateBasicStatus(!hasOwnSetup && !!basic);

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

// 基本形まわりの案内文を出す
function updateBasicStatus(loadedFromBasic) {
  const basic = getBasic(selectedMy.id);
  if (loadedFromBasic) {
    el.basicStatus.textContent = selectedMy.name + " の基本形を読みこみました";
  } else if (basic) {
    el.basicStatus.textContent = selectedMy.name + " の基本形が保存されています";
  } else {
    el.basicStatus.textContent = selectedMy.name + " の基本形はまだありません";
  }
}

el.loadBasicButton.addEventListener("click", function () {
  const basic = getBasic(selectedMy.id);
  if (!basic) {
    el.basicStatus.textContent = selectedMy.name + " の基本形はまだありません";
    return;
  }

  editingRunes = {
    treeId:      basic.runes ? (basic.runes.treeId      || null) : null,
    keystoneId:  basic.runes ? (basic.runes.keystoneId  || null) : null,
    secondaryId: basic.runes ? (basic.runes.secondaryId || null) : null
  };
  editingItems = (basic.items || []).map(function (item) {
    return { id: item.id, name: item.name };
  });
  editingTreeTab = editingRunes.treeId !== null
    ? editingRunes.treeId
    : (runeTrees ? runeTrees[0].id : null);

  renderTreeTabs();
  renderKeystones();
  renderSecondary();
  renderPickedItems();
  el.basicStatus.textContent = selectedMy.name + " の基本形を読みこみました";
});

el.saveBasicButton.addEventListener("click", function () {
  saveBasic(selectedMy.id, {
    runes: buildRuneData(),
    items: editingItems.slice()
  });
  el.basicStatus.textContent = selectedMy.name + " の基本形として保存しました";
  if (selectedEnemy) showSheet();
});

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
   15) 保存
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
   16) localStorage への読み書き
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
   17) 対策ずみマッチアップの一覧
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
             { id: note.myId, name: note.myName, icon: note.myIcon, splash: "" };
  const enemy = champions.find(function (c) { return c.id === note.enemyId; }) ||
                { id: note.enemyId, name: note.enemyName, icon: note.enemyIcon, splash: "" };

  if (!selectedMy || selectedMy.id !== my.id) {
    setMyChampion(my, true);
  }

  selectedEnemy = enemy;
  skillTab = "enemy";
  renderGrid("enemy");
  el.editor.hidden = true;
  showSheet();
  el.sheet.scrollIntoView({ behavior: "smooth", block: "start" });
}

el.filterMine.addEventListener("change", renderSavedList);


/* =========================================================
   18) 日付を読みやすい形にする
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
   19) ページを開いたら実行する
   ========================================================= */

loadChampions();
