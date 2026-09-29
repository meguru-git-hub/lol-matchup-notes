/* =========================================================
   トップページの中身を作る
   ---------------------------------------------------------
   articles.js に書いてあるデータを読んで、
   ・分類のカード（記事が何本あるか）
   ・新しい記事の一覧
   を並べる。記事を足せば自動でここにも出る。
   ========================================================= */

// その分類に記事が何本あるか数える
function countArticles(categoryId) {
  return ARTICLES.filter(function (a) { return a.cat === categoryId; }).length;
}

/* ---------------------------------------------------------
   分類のカードを並べる
   --------------------------------------------------------- */
function renderCategories() {
  const grid = document.getElementById("categoryGrid");
  // このファイルは記事ページ（guide.html）でも読みこまれる。
  // 向こうには置き場所が無いので、無ければ何もしない。
  if (!grid) return;
  grid.innerHTML = "";

  CATEGORIES.forEach(function (category) {
    const count = countArticles(category.id);

    const card = document.createElement("a");
    card.className = "cat-card";
    card.href = "guide.html?cat=" + category.id;

    const icon = document.createElement("span");
    icon.className = "cat-icon";
    icon.textContent = category.icon;

    const text = document.createElement("span");
    text.className = "cat-text";

    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = category.name;

    const lead = document.createElement("span");
    lead.className = "cat-lead";
    lead.textContent = category.lead;

    text.appendChild(name);
    text.appendChild(lead);

    const badge = document.createElement("span");
    badge.className = "cat-count";
    // 記事がまだ無い分類は、その旨を出しておく
    badge.textContent = count > 0 ? count + " 本" : "準備中";
    if (count === 0) badge.classList.add("is-empty");

    card.appendChild(icon);
    card.appendChild(text);
    card.appendChild(badge);
    grid.appendChild(card);
  });
}

/* ---------------------------------------------------------
   新しい記事を並べる
   --------------------------------------------------------- */
function renderRecent() {
  const list = document.getElementById("recentList");
  if (!list) return;
  list.innerHTML = "";

  // 更新日の新しい順に、最大6本
  const recent = ARTICLES.slice()
    .sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); })
    .slice(0, 6);

  if (recent.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "まだ記事がありません。";
    list.appendChild(p);
    return;
  }

  recent.forEach(function (article) {
    list.appendChild(createArticleRow(article));
  });
}

/* 記事1本ぶんの行を作る。
   記事ページ（guide.js）でも同じ見た目を使うので、ここで作って共有している。 */
function createArticleRow(article) {
  const row = document.createElement("a");
  row.className = "article-row";
  row.href = "guide.html?id=" + article.id;

  const category = CATEGORIES.find(function (c) { return c.id === article.cat; });

  const tag = document.createElement("span");
  tag.className = "article-tag";
  tag.textContent = category ? category.name : article.cat;

  const text = document.createElement("span");
  text.className = "article-text";

  const title = document.createElement("span");
  title.className = "article-title";
  title.textContent = article.title;

  const summary = document.createElement("span");
  summary.className = "article-summary";
  summary.textContent = article.summary;

  text.appendChild(title);
  text.appendChild(summary);

  const date = document.createElement("span");
  date.className = "article-date";
  date.textContent = article.updated;

  row.appendChild(tag);
  row.appendChild(text);
  row.appendChild(date);
  return row;
}

renderCategories();
renderRecent();
