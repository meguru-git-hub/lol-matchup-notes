/* =========================================================
   解説ページ
   ---------------------------------------------------------
   URL の後ろについている文字で、出すものを切り替える。

     guide.html?cat=macro      … マクロ解説の記事一覧
     guide.html?id=wave-basics … その記事そのもの
     guide.html                … 全部の記事の一覧

   本文の組み立てかたは articles.js の説明を見ること。
   ========================================================= */

const root = document.getElementById("guideRoot");
const params = new URLSearchParams(location.search);

function start() {
  const id = params.get("id");
  const cat = params.get("cat");

  if (id) {
    const article = ARTICLES.find(function (a) { return a.id === id; });
    if (article) {
      showArticle(article);
    } else {
      showMissing("その記事は見つかりませんでした。");
    }
    return;
  }

  showList(cat);
}


/* =========================================================
   記事の一覧を出す
   ========================================================= */

function showList(categoryId) {
  root.innerHTML = "";

  const category = CATEGORIES.find(function (c) { return c.id === categoryId; });

  // 見出し
  const head = document.createElement("section");
  head.className = "hero";

  const title = document.createElement("h1");
  title.className = "hero-title";
  title.textContent = category ? category.name : "すべての解説";

  const lead = document.createElement("p");
  lead.className = "hero-lead";
  lead.textContent = category ? category.lead : "書きためた解説の一覧です。";

  head.appendChild(title);
  head.appendChild(lead);
  root.appendChild(head);

  // 記事を絞りこむ
  const list = ARTICLES
    .filter(function (a) { return !categoryId || a.cat === categoryId; })
    .sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });

  const box = document.createElement("div");
  box.className = "article-list";

  if (list.length === 0) {
    box.appendChild(emptyNotice(category));
  } else {
    list.forEach(function (article) {
      // トップページと同じ見た目の行を使う（home.js にある）
      box.appendChild(createArticleRow(article));
    });
  }

  root.appendChild(box);

  // ほかの分類へのリンク
  root.appendChild(otherCategories(categoryId));
}

// 記事がまだ無いときの案内
function emptyNotice(category) {
  const box = document.createElement("div");
  box.className = "panel empty-guide";

  const p1 = document.createElement("p");
  p1.textContent = category
    ? "「" + category.name + "」の記事はまだありません。"
    : "まだ記事がありません。";

  const p2 = document.createElement("p");
  p2.className = "empty-guide-hint";
  p2.textContent = "記事は articles.js に書き足すと、ここに自動で並びます。";

  box.appendChild(p1);
  box.appendChild(p2);
  return box;
}

// 下に置く「ほかの分類」
function otherCategories(currentId) {
  const box = document.createElement("div");
  box.className = "other-cats";

  const label = document.createElement("span");
  label.className = "other-label";
  label.textContent = "ほかの解説";
  box.appendChild(label);

  CATEGORIES.forEach(function (category) {
    if (category.id === currentId) return;
    const link = document.createElement("a");
    link.className = "other-link";
    link.href = "guide.html?cat=" + category.id;
    link.textContent = category.icon + " " + category.name;
    box.appendChild(link);
  });

  return box;
}


/* =========================================================
   記事そのものを出す
   ========================================================= */

function showArticle(article) {
  root.innerHTML = "";

  const category = CATEGORIES.find(function (c) { return c.id === article.cat; });

  // 「解説 › マクロ解説」のような道しるべ
  const crumb = document.createElement("div");
  crumb.className = "crumb";

  const home = document.createElement("a");
  home.href = "index.html";
  home.textContent = "ホーム";
  crumb.appendChild(home);

  if (category) {
    const sep = document.createElement("span");
    sep.textContent = "›";
    crumb.appendChild(sep);

    const catLink = document.createElement("a");
    catLink.href = "guide.html?cat=" + category.id;
    catLink.textContent = category.name;
    crumb.appendChild(catLink);
  }
  root.appendChild(crumb);

  // 記事本体
  const paper = document.createElement("article");
  paper.className = "panel paper";

  const title = document.createElement("h1");
  title.className = "paper-title";
  title.textContent = article.title;

  const meta = document.createElement("div");
  meta.className = "paper-meta";
  meta.textContent = (category ? category.name + " ／ " : "") + "更新 " + article.updated;

  const summary = document.createElement("p");
  summary.className = "paper-summary";
  renderText(summary, article.summary);

  paper.appendChild(title);
  paper.appendChild(meta);
  paper.appendChild(summary);

  // 本文のかたまりを1つずつ組み立てる
  (article.body || []).forEach(function (block) {
    const node = createBlock(block);
    if (node) paper.appendChild(node);
  });

  root.appendChild(paper);

  // 同じ分類の他の記事
  const siblings = ARTICLES.filter(function (a) {
    return a.cat === article.cat && a.id !== article.id;
  });

  if (siblings.length > 0) {
    const nextTitle = document.createElement("h2");
    nextTitle.className = "section-title";
    nextTitle.textContent = "同じ分類の記事";
    root.appendChild(nextTitle);

    const box = document.createElement("div");
    box.className = "article-list";
    siblings.forEach(function (a) { box.appendChild(createArticleRow(a)); });
    root.appendChild(box);
  }

  root.appendChild(otherCategories(null));
}


/* =========================================================
   本文の1かたまりを作る
   articles.js で使える5つの書きかたに対応している
   ========================================================= */

function createBlock(block) {
  // 見出し
  if (block.h) {
    const h = document.createElement("h2");
    h.className = "paper-h";
    h.textContent = block.h;
    return h;
  }

  // 段落（文字列ひとつでも、配列で複数でもよい）
  if (block.p) {
    const box = document.createElement("div");
    const paragraphs = Array.isArray(block.p) ? block.p : [block.p];
    paragraphs.forEach(function (text) {
      const p = document.createElement("p");
      p.className = "paper-p";
      renderText(p, text);
      box.appendChild(p);
    });
    return box;
  }

  // 箇条書き
  if (block.list) {
    const ul = document.createElement("ul");
    ul.className = "paper-list";
    block.list.forEach(function (text) {
      const li = document.createElement("li");
      renderText(li, text);
      ul.appendChild(li);
    });
    return ul;
  }

  // 目立つ補足
  if (block.note) {
    const box = document.createElement("div");
    box.className = "paper-note";
    renderText(box, block.note);
    return box;
  }

  // 表
  if (block.table) {
    return createTable(block.table);
  }

  return null;
}

function createTable(data) {
  // 横に長い表はスマホで はみ出すので、囲いを付けて横スクロールさせる
  const wrap = document.createElement("div");
  wrap.className = "paper-table-wrap";

  const table = document.createElement("table");
  table.className = "paper-table";

  if (data.head) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    data.head.forEach(function (text) {
      const th = document.createElement("th");
      renderText(th, text);
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
  }

  const tbody = document.createElement("tbody");
  (data.rows || []).forEach(function (row) {
    const tr = document.createElement("tr");
    row.forEach(function (text) {
      const td = document.createElement("td");
      renderText(td, text);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}


/* =========================================================
   **ここ** のように * 2つで囲んだ部分を金色で強調する
   ---------------------------------------------------------
   innerHTML を使わずに組み立てているので、
   記事に書いた文字がそのまま HTML として動くことはない。
   ========================================================= */

function renderText(target, text) {
  target.textContent = "";
  if (!text) return;

  // **強調** で切り分ける。囲みの中身だけが配列に残る
  const parts = String(text).split(/\*\*(.+?)\*\*/g);

  parts.forEach(function (part, index) {
    if (!part) return;
    if (index % 2 === 1) {
      // 奇数番目が ** で囲まれていた部分
      const strong = document.createElement("strong");
      strong.className = "paper-strong";
      strong.textContent = part;
      target.appendChild(strong);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}


/* =========================================================
   見つからなかったとき
   ========================================================= */

function showMissing(message) {
  root.innerHTML = "";

  const box = document.createElement("div");
  box.className = "panel empty-guide";

  const p = document.createElement("p");
  p.textContent = message;

  const link = document.createElement("a");
  link.className = "btn";
  link.href = "index.html";
  link.textContent = "ホームへ戻る";

  box.appendChild(p);
  box.appendChild(link);
  root.appendChild(box);
}


start();

// 記事の題名をブラウザのタブにも出す
(function () {
  const id = params.get("id");
  const cat = params.get("cat");
  if (id) {
    const article = ARTICLES.find(function (a) { return a.id === id; });
    if (article) { document.title = article.title + " - LoL ガイド"; return; }
  }
  if (cat) {
    const category = CATEGORIES.find(function (c) { return c.id === cat; });
    if (category) { document.title = category.name + " - LoL ガイド"; }
  }
})();
