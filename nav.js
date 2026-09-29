/* =========================================================
   サイト共通のナビゲーション
   ---------------------------------------------------------
   ページが増えてもここ1か所を直せば、
   すべてのページのメニューが変わるようにしてある。

   使いかた: 各ページの HTML に
     <nav id="siteNav" class="nav"></nav>
   を置いて、このファイルを読みこむだけ。
   ========================================================= */

// メニューに並べるもの。ページを足したらここに1行足す。
const NAV_ITEMS = [
  { href: "index.html",           label: "ホーム",       match: "index" },
  { href: "matchup.html",         label: "マッチアップ", match: "matchup" },
  { href: "guide.html?cat=role",  label: "ロール",       match: "cat:role" },
  { href: "guide.html?cat=macro", label: "マクロ",       match: "cat:macro" },
  { href: "guide.html?cat=item",  label: "アイテム",     match: "cat:item" },
  { href: "guide.html?cat=pro",   label: "競技シーン",   match: "cat:pro" },
  { href: "guide.html?cat=otp",   label: "OTP",          match: "cat:otp" }
];

/* いま開いているページがメニューのどれにあたるかを調べる。
   例: matchup.html なら "matchup"
       guide.html?cat=macro なら "cat:macro" */
function currentNavKey() {
  // URL の最後の「/」より後ろがファイル名
  const file = location.pathname.split("/").pop() || "index.html";
  const name = file.replace(".html", "") || "index";

  if (name !== "guide") return name;

  // 記事ページは、どの分類を見ているかで判断する
  const params = new URLSearchParams(location.search);
  const cat = params.get("cat");
  if (cat) return "cat:" + cat;

  // 個別の記事を開いているときは、その記事の分類を使う
  const id = params.get("id");
  if (id && typeof ARTICLES !== "undefined") {
    const article = ARTICLES.find(function (a) { return a.id === id; });
    if (article) return "cat:" + article.cat;
  }
  return "guide";
}

function renderNav() {
  const box = document.getElementById("siteNav");
  if (!box) return;

  const current = currentNavKey();
  box.innerHTML = "";

  NAV_ITEMS.forEach(function (item) {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.href = item.href;
    link.textContent = item.label;

    // いま見ているページには印をつける
    if (item.match === current) {
      link.classList.add("is-here");
      link.setAttribute("aria-current", "page");
    }

    box.appendChild(link);
  });
}

renderNav();


/* =========================================================
   固定ヘッダーの高さを測って、CSS から使えるようにする
   ---------------------------------------------------------
   ヘッダーは画面の上に貼りついている（position: sticky）。
   scrollIntoView でスクロールすると、その下に中身が潜りこんでしまう。
   CSS の scroll-margin-top でよけられるが、ヘッダーの高さは
   画面の幅によって変わる（メニューが折り返すため）ので、
   決め打ちの数字ではなく、実際に測った高さを渡す。
   ========================================================= */

function updateHeaderHeight() {
  const header = document.querySelector(".header");
  if (!header) return;
  document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

updateHeaderHeight();
// 画面の幅が変わったときと、書体が読み込まれて高さが変わったときに測り直す
window.addEventListener("resize", updateHeaderHeight);
window.addEventListener("load", updateHeaderHeight);
