/* =========================================================
   LoL マッチアップノート
   ---------------------------------------------------------
   このファイルがやっていること
   1) Riot の Data Dragon からチャンピオン一覧と画像URLを取ってくる
   2) チャンピオンを選べるようにする
   3) メモを localStorage に保存・読み込み・削除する
   ========================================================= */


/* ---------------------------------------------------------
   設定
   --------------------------------------------------------- */

// localStorage に保存するときの「名前（キー）」。
// ブラウザの中に、この名前で全部のメモをまとめて入れておく。
const STORAGE_KEY = "lolMatchupNotes";

// Data Dragon のバージョン一覧が置いてある場所
const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";


/* ---------------------------------------------------------
   プログラム全体で使う変数
   --------------------------------------------------------- */

// 取ってきたチャンピオンの一覧をここに入れる
// 中身のイメージ: [{ id: "Yasuo", name: "ヤスオ", icon: "https://..." }, ...]
let champions = [];

// いま選んでいるチャンピオン（選んでいなければ null）
let selectedMy = null;
let selectedEnemy = null;


/* ---------------------------------------------------------
   HTML の要素を取っておく（毎回探さなくていいように）
   --------------------------------------------------------- */
const loadingMessage = document.getElementById("loadingMessage");

const myGrid   = document.getElementById("myGrid");
const mySearch = document.getElementById("mySearch");
const myIcon   = document.getElementById("myIcon");
const myName   = document.getElementById("myName");

const enemyGrid   = document.getElementById("enemyGrid");
const enemySearch = document.getElementById("enemySearch");
const enemyIcon   = document.getElementById("enemyIcon");
const enemyName   = document.getElementById("enemyName");

const matchupTitle = document.getElementById("matchupTitle");
const avoidSkill   = document.getElementById("avoidSkill");
const tradeTiming  = document.getElementById("tradeTiming");
const powerSpike   = document.getElementById("powerSpike");
const reflection   = document.getElementById("reflection");

const saveButton  = document.getElementById("saveButton");
const clearButton = document.getElementById("clearButton");
const saveMessage = document.getElementById("saveMessage");

const savedList = document.getElementById("savedList");


/* =========================================================
   1) Data Dragon からチャンピオン一覧を取ってくる
   ========================================================= */

// async / await ... 「ネットからデータが届くのを待つ」ための書き方
async function loadChampions() {
  try {
    // ① まず最新バージョンを調べる（["15.19.1", "15.18.1", ...] が返ってくる）
    const versionsResponse = await fetch(VERSIONS_URL);
    const versions = await versionsResponse.json();
    const latestVersion = versions[0];   // 一番新しいバージョン

    // ② そのバージョンの日本語のチャンピオンデータを取ってくる
    const champUrl =
      "https://ddragon.leagueoflegends.com/cdn/" +
      latestVersion + "/data/ja_JP/champion.json";

    const champResponse = await fetch(champUrl);
    const champJson = await champResponse.json();

    // ③ 使いやすい形に作りなおす
    //    champJson.data は { Aatrox: {...}, Ahri: {...} } という形なので
    //    Object.values() で中身だけの配列にする
    champions = Object.values(champJson.data).map(function (champ) {
      return {
        id:   champ.id,      // 英語のID（例: "Yasuo"）＝ 画像のファイル名にも使う
        name: champ.name,    // 日本語名（例: "ヤスオ"）
        icon: "https://ddragon.leagueoflegends.com/cdn/" +
              latestVersion + "/img/champion/" + champ.id + ".png"
      };
    });

    // ④ 日本語名の五十音順に並べる
    champions.sort(function (a, b) {
      return a.name.localeCompare(b.name, "ja");
    });

    // ⑤ 画面に一覧を表示する
    loadingMessage.hidden = true;
    renderGrid("my");
    renderGrid("enemy");
    renderSavedList();

  } catch (error) {
    // ネットにつながっていないときなどはここに来る
    loadingMessage.textContent =
      "チャンピオン一覧を取得できませんでした。インターネット接続を確認して、ページを再読み込みしてください。";
    console.error(error);
  }
}


/* =========================================================
   2) チャンピオン一覧を画面に並べる
   ========================================================= */

// which は "my"（自分）か "enemy"（相手）
function renderGrid(which) {
  // どちらの側か決める
  const grid      = (which === "my") ? myGrid : enemyGrid;
  const searchBox = (which === "my") ? mySearch : enemySearch;
  const selected  = (which === "my") ? selectedMy : selectedEnemy;

  // 検索ボックスの文字（小文字に統一して比べる）
  const keyword = searchBox.value.trim().toLowerCase();

  // 検索文字にあてはまるチャンピオンだけに絞る
  const list = champions.filter(function (champ) {
    if (keyword === "") return true;                       // 空なら全部
    return champ.name.toLowerCase().includes(keyword) ||   // 日本語名で一致
           champ.id.toLowerCase().includes(keyword);       // 英語名で一致
  });

  // いったん中身を空にしてから作り直す
  grid.innerHTML = "";

  list.forEach(function (champ) {
    // ボタンを1つ作る
    const button = document.createElement("button");
    button.className = "champ";
    button.title = champ.name;          // マウスを乗せると名前が出る

    // 選ばれているチャンピオンには目印のクラスをつける
    if (selected && selected.id === champ.id) {
      button.classList.add("is-selected");
    }

    // 中に画像を入れる
    const img = document.createElement("img");
    img.src = champ.icon;
    img.alt = champ.name;
    img.loading = "lazy";               // 表示されるまで読み込みを後回しにする
    button.appendChild(img);

    // クリックされたときの動き
    button.addEventListener("click", function () {
      selectChampion(which, champ);
    });

    grid.appendChild(button);
  });
}


/* =========================================================
   3) チャンピオンを選んだときの処理
   ========================================================= */

function selectChampion(which, champ) {
  if (which === "my") {
    selectedMy = champ;
    myIcon.src = champ.icon;
    myIcon.hidden = false;
    myName.textContent = champ.name;
  } else {
    selectedEnemy = champ;
    enemyIcon.src = champ.icon;
    enemyIcon.hidden = false;
    enemyName.textContent = champ.name;
  }

  // 枠の色を更新するために一覧を作り直す
  renderGrid(which);

  // 両方選ばれたら、保存済みメモを読み込んで入力欄に入れる
  updateNoteArea();
}


/* =========================================================
   4) メモ入力エリアの表示を更新する
   ========================================================= */

function updateNoteArea() {
  saveMessage.textContent = "";

  // どちらかが未選択なら、まだメモは扱えない
  if (!selectedMy || !selectedEnemy) {
    matchupTitle.textContent = "両方のチャンプを選んでください";
    return;
  }

  matchupTitle.textContent =
    selectedMy.name + "（自分） vs " + selectedEnemy.name + "（相手）";

  // 保存済みのメモがあれば入力欄に入れる。なければ空にする。
  const allNotes = loadAllNotes();
  const note = allNotes[makeKey(selectedMy.id, selectedEnemy.id)];

  avoidSkill.value  = note ? note.avoidSkill  : "";
  tradeTiming.value = note ? note.tradeTiming : "";
  powerSpike.value  = note ? note.powerSpike  : "";
  reflection.value  = note ? note.reflection  : "";
}


/* =========================================================
   5) localStorage への保存・読み込み
   ========================================================= */

// マッチアップごとの「合い言葉（キー）」を作る。例: "Yasuo_vs_Darius"
function makeKey(myId, enemyId) {
  return myId + "_vs_" + enemyId;
}

// 保存してある全部のメモを読み込む
function loadAllNotes() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    // まだ何も保存していなければ null なので、空のオブジェクトを返す
    return text ? JSON.parse(text) : {};
  } catch (error) {
    // 壊れたデータが入っていても止まらないようにする
    console.error("保存データの読み込みに失敗しました", error);
    return {};
  }
}

// 全部のメモをまとめて保存する
function saveAllNotes(allNotes) {
  // localStorage は文字だけしか保存できないので JSON.stringify で文字にする
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
}


/* =========================================================
   6) 「メモを保存」ボタン
   ========================================================= */

saveButton.addEventListener("click", function () {
  if (!selectedMy || !selectedEnemy) {
    alert("自分のチャンプと相手のチャンプの両方を選んでください。");
    return;
  }

  const allNotes = loadAllNotes();

  // このマッチアップのメモを作る（すでにあれば上書きする）
  allNotes[makeKey(selectedMy.id, selectedEnemy.id)] = {
    myId:      selectedMy.id,
    myName:    selectedMy.name,
    myIcon:    selectedMy.icon,
    enemyId:   selectedEnemy.id,
    enemyName: selectedEnemy.name,
    enemyIcon: selectedEnemy.icon,

    avoidSkill:  avoidSkill.value.trim(),
    tradeTiming: tradeTiming.value.trim(),
    powerSpike:  powerSpike.value.trim(),
    reflection:  reflection.value.trim(),

    updatedAt: new Date().toISOString()   // 保存した日時
  };

  saveAllNotes(allNotes);

  saveMessage.textContent = "✅ 保存しました！";
  renderSavedList();
});


/* =========================================================
   7) 「入力をクリア」ボタン（保存済みデータは消さない）
   ========================================================= */

clearButton.addEventListener("click", function () {
  avoidSkill.value  = "";
  tradeTiming.value = "";
  powerSpike.value  = "";
  reflection.value  = "";
  saveMessage.textContent = "";
});


/* =========================================================
   8) 保存済みマッチアップの一覧を表示する
   ========================================================= */

function renderSavedList() {
  const allNotes = loadAllNotes();

  // オブジェクトを配列にして、更新が新しい順に並べる
  const notes = Object.values(allNotes).sort(function (a, b) {
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  savedList.innerHTML = "";

  // 1件もないとき
  if (notes.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "まだ保存されたマッチアップはありません。";
    savedList.appendChild(p);
    return;
  }

  notes.forEach(function (note) {
    savedList.appendChild(createSavedItem(note));
  });
}

// 保存済み1件分の見た目を作る
function createSavedItem(note) {
  const item = document.createElement("div");
  item.className = "saved-item";

  /* --- 上の行：アイコン・名前・ボタン --- */
  const head = document.createElement("div");
  head.className = "saved-head";

  const icons = document.createElement("div");
  icons.className = "saved-icons";

  const myImg = document.createElement("img");
  myImg.src = note.myIcon;
  myImg.alt = note.myName;

  const vs = document.createElement("span");
  vs.className = "saved-vs";
  vs.textContent = "VS";

  const enemyImg = document.createElement("img");
  enemyImg.src = note.enemyIcon;
  enemyImg.alt = note.enemyName;

  icons.appendChild(myImg);
  icons.appendChild(vs);
  icons.appendChild(enemyImg);

  const names = document.createElement("div");
  names.className = "saved-names";
  names.textContent = note.myName + " vs " + note.enemyName;

  const date = document.createElement("span");
  date.className = "saved-date";
  date.textContent = "更新: " + formatDate(note.updatedAt);
  names.appendChild(date);

  const actions = document.createElement("div");
  actions.className = "saved-actions";

  // 「編集」ボタン：上の入力欄にこのメモを読み込む
  const editButton = document.createElement("button");
  editButton.className = "btn btn-small";
  editButton.textContent = "編集";
  editButton.addEventListener("click", function () {
    openNote(note);
  });

  // 「削除」ボタン
  const deleteButton = document.createElement("button");
  deleteButton.className = "btn btn-small btn-delete";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", function () {
    const ok = confirm(note.myName + " vs " + note.enemyName + " のメモを削除しますか？");
    if (!ok) return;

    const allNotes = loadAllNotes();
    delete allNotes[makeKey(note.myId, note.enemyId)];
    saveAllNotes(allNotes);
    renderSavedList();
  });

  actions.appendChild(editButton);
  actions.appendChild(deleteButton);

  head.appendChild(icons);
  head.appendChild(names);
  head.appendChild(actions);
  item.appendChild(head);

  /* --- 下の部分：メモの中身 --- */
  const body = document.createElement("dl");
  body.className = "saved-body";

  addRow(body, "⚠️ 避けるべきスキル",           note.avoidSkill);
  addRow(body, "⚔️ トレードしていいタイミング", note.tradeTiming);
  addRow(body, "📈 相手のパワースパイク",        note.powerSpike);
  addRow(body, "💭 ひとこと反省",                note.reflection);

  // 中身が何もなければ表示しない
  if (body.children.length > 0) {
    item.appendChild(body);
  }

  return item;
}

// メモ1項目を追加する（空なら何もしない）
function addRow(dl, label, value) {
  if (!value) return;

  const dt = document.createElement("dt");
  dt.textContent = label;

  const dd = document.createElement("dd");
  dd.textContent = value;

  dl.appendChild(dt);
  dl.appendChild(dd);
}


/* =========================================================
   9) 保存済みメモを入力欄に呼び出す（編集ボタン）
   ========================================================= */

function openNote(note) {
  // 一覧の中から同じチャンピオンを探して選択状態にする
  const my    = champions.find(function (c) { return c.id === note.myId; });
  const enemy = champions.find(function (c) { return c.id === note.enemyId; });

  // 見つからない場合（チャンピオン名が変わった等）は保存データをそのまま使う
  selectChampion("my",    my    || { id: note.myId,    name: note.myName,    icon: note.myIcon });
  selectChampion("enemy", enemy || { id: note.enemyId, name: note.enemyName, icon: note.enemyIcon });

  // ページの上までスクロールする
  window.scrollTo({ top: 0, behavior: "smooth" });
}


/* =========================================================
   10) 日付を読みやすい形にする
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
   11) 検索ボックスに文字が入ったら一覧を絞りこむ
   ========================================================= */

mySearch.addEventListener("input", function () {
  renderGrid("my");
});

enemySearch.addEventListener("input", function () {
  renderGrid("enemy");
});


/* =========================================================
   12) ページを開いたら最初に実行する
   ========================================================= */

loadChampions();
