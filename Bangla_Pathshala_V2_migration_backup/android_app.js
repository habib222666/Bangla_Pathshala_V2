let items=[];
let currentPoem=null;
let currentIndex=-1;
let showingFavorites=false;
let speaking=false;
let globalSearchMode=false;
let globalSearchResults=[];
let selectedClasses=[1];

const VIEWER_MODE =
  typeof Android !== "undefined" &&
  typeof Android.isViewer === "function" &&
  Android.isViewer();
const SUPABASE_URL = "https://ugdrciphpwceufjiywei.supabase.co";
const SUPABASE_KEY = "sb_publishable_B8Lnn_hdd_w2obG2_eWvfA_TwLLRUE9";



async function supabaseRequest(path="", options={}) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Supabase HTTP error:", response.status, errorText);
    throw new Error("Supabase error " + response.status + ": " + errorText);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}


async function loadPoemsFromSupabase() {
  try {
    const rows = await supabaseRequest("poems?select=*&order=class.asc,user_added.asc,lesson.asc,id.asc");

    if (!Array.isArray(rows) || rows.length === 0) {
      console.log("Supabase poems table is empty.");
      return false;
    }

    for (const key of Object.keys(classData)) {
      classData[key] = [];
    }

    for (const row of rows) {
      const poem = {
        id: row.id,
        class: row.class,
        lesson: row.lesson,
        title: row.title,
        poet: row.poet || "",
        source_page: row.source_page,
        is_excerpt: !!row.is_excerpt,
        text: row.text,
        userAdded: !!row.user_added,
        oldBook: !!row.old_book
      };

      if (!classData[String(poem.class)]) {
        classData[String(poem.class)] = [];
      }

      const target = classData[String(poem.class)];
      const duplicate = target.some(existing =>
        String(existing.title || "").trim().toLowerCase() === String(poem.title || "").trim().toLowerCase() &&
        String(existing.poet || "").trim().toLowerCase() === String(poem.poet || "").trim().toLowerCase() &&
        String(savedText(existing)).replace(/\s+/g," ").trim().toLowerCase() === String(poem.text || "").replace(/\s+/g," ").trim().toLowerCase()
      );
      if(!duplicate) target.push(poem);
    }

    Object.keys(classData).forEach(function(key){
      classData[key].sort(function(a, b){
        const aLesson = Number(a.lesson || 0);
        const bLesson = Number(b.lesson || 0);

        if(aLesson === 0 && bLesson !== 0) return 1;
        if(aLesson !== 0 && bLesson === 0) return -1;
        return aLesson - bLesson;
      });
    });

    console.log("Loaded poems from Supabase:", rows.length);
    return true;
  } catch (error) {
    console.error("Supabase load failed:", error);
    return false;
  }
}


const classData = {"1":[],"2":[],"3":[],"4":[],"5":[],"6":[],"7":[],"8":[],"9":[],"10":[],"11":[],"12":[]};

const home=document.querySelector("#home");
const library=document.querySelector("#library");
const reader=document.querySelector("#reader");
const list=document.querySelector("#list");
const search=document.querySelector("#search");
const darkModeBtn=document.querySelector("#darkModeBtn");

function updateDarkModeButton(){
  if(!darkModeBtn) return;
  darkModeBtn.textContent = document.body.classList.contains("dark")
    ? "☀️ লাইট মোড"
    : "🌙 ডার্ক মোড";
}

if(localStorage.getItem("darkMode") === "1"){
  document.body.classList.add("dark");
}

if(darkModeBtn){
  darkModeBtn.addEventListener("click", function(){
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark") ? "1" : "0"
    );
    updateDarkModeButton();
  });
}

updateDarkModeButton();
const favoriteFilter=document.querySelector("#favoriteFilter");
const editBtn=document.querySelector("#editBtn");
const speakBtn=document.querySelector("#speakBtn");
const editArea=document.querySelector("#editArea");
const editText=document.querySelector("#editText");
const saveBtn=document.querySelector("#saveBtn");

const cancelBtn=document.querySelector("#cancelBtn");

// ===== Rich Text Editor =====

function richEditorPlainText(){
  const el = document.querySelector("#editText");
  return el ? el.innerText.trim() : "";
}

function cleanRichHTML(html){
  const temp = document.createElement("div");
  temp.innerHTML = html || "";

  temp.querySelectorAll("script,style,iframe,object,embed").forEach(el => el.remove());

  temp.querySelectorAll("*").forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value || "";

      if(name.startsWith("on")){
        el.removeAttribute(attr.name);
      }

      if(name === "href" || name === "src"){
        if(/^\s*javascript:/i.test(value)){
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  return temp.innerHTML.trim();
}

function poemHTMLToPlainText(value){
  if(!value) return "";

  const temp = document.createElement("div");
  temp.innerHTML = value;

  return (temp.innerText || temp.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

// Toolbar buttons
document.querySelectorAll("#richToolbar [data-cmd]").forEach(button => {
  button.addEventListener("click", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();
    document.execCommand(this.dataset.cmd, false, null);
  });
});


// Font size
const fontSizeSelect = document.querySelector("#fontSize");

// Font Style
const fontFamilySelect = document.querySelector("#fontFamily");

if(fontFamilySelect){
  fontFamilySelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand(
      "fontName",
      false,
      this.value
    );
  });
}

// Exact Font Size in pt
if(fontSizeSelect){
  fontSizeSelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand("fontSize", false, "7");

    editor.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement("span");
      span.style.fontSize = this.value + "pt";
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  });
}

// Leading / Line Spacing
const leadingSelect = document.querySelector("#leading");

if(leadingSelect){
  leadingSelect.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    const selection = window.getSelection();

    if(!selection || !selection.rangeCount){
      editor.style.lineHeight = this.value;
      return;
    }

    let node = selection.anchorNode;

    if(node && node.nodeType === Node.TEXT_NODE){
      node = node.parentElement;
    }

    const block = node && node.closest
      ? node.closest("p, div, h1, h2, h3, h4, h5, h6, li")
      : null;

    if(block && editor.contains(block)){
      block.style.lineHeight = this.value;
    }else{
      editor.style.lineHeight = this.value;
    }
  });
}

// Font Color
const fontColor = document.querySelector("#fontColor");

if(fontColor){
  fontColor.addEventListener("input", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    document.execCommand(
      "foreColor",
      false,
      this.value
    );
  });
}

// Paragraph / Heading
const formatBlock = document.querySelector("#formatBlock");

if(formatBlock){
  formatBlock.addEventListener("change", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();

    const tag = this.value;

    document.execCommand(
      "formatBlock",
      false,
      tag
    );
  });
}

// Clear formatting
const clearFormat = document.querySelector("#clearFormat");

if(clearFormat){
  clearFormat.addEventListener("click", function(){
    const editor = document.querySelector("#editText");
    if(!editor) return;

    editor.focus();
    document.execCommand("removeFormat", false, null);
  });
}

// Save rich text
if(saveBtn){

  saveBtn.addEventListener("click", async function(){

    if(VIEWER_MODE){
      return;
    }

    if(!currentPoem) return;

    const editor = document.querySelector("#editText");

    if(!editor){
      return;
    }

    const plainText = richEditorPlainText();

    if(!plainText){
      alert("কবিতার লেখা খালি রাখা যাবে না।");
      return;
    }

    if(!currentPoem.id){
      alert("এই কবিতার Supabase ID পাওয়া যায়নি।");
      return;
    }

    const richHTML = cleanRichHTML(editor.innerHTML);

    saveBtn.disabled = true;

    try{

      await supabaseRequest(
        "poems?id=eq." + encodeURIComponent(currentPoem.id),
        {
          method: "PATCH",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            text: richHTML
          })
        }
      );

      currentPoem.text = richHTML;

      document.querySelector("#text").innerHTML = richHTML;
      document.querySelector("#text").classList.remove("hidden");

      editArea.classList.add("hidden");
      editBtn.classList.remove("hidden");

      alert("কবিতা সফলভাবে সংরক্ষণ হয়েছে।");

      render();

    } catch(error){

      console.error("Poem update failed:", error);
      alert("কবিতা সংরক্ষণ করা যায়নি।");

    } finally {

      saveBtn.disabled = false;

    }
  });
}

if(cancelBtn){

  cancelBtn.addEventListener("click", function(){

    editArea.classList.add("hidden");

    document.querySelector("#text").classList.remove("hidden");

    editBtn.classList.remove("hidden");

  });

}

if(editBtn){

  editBtn.addEventListener("click", function(){

    if(VIEWER_MODE){
      return;
    }

    if(!currentPoem) return;

    const editor = document.querySelector("#editText");

    if(!editor) return;

    editor.style.fontFamily =
      '"Nirmala UI","Noto Sans Bengali",sans-serif';

    const existing = savedText(currentPoem);

    /*
      পুরোনো কবিতা যদি plain text হয়,
      তাহলে সেটাকে paragraph/line break সহ editor-এ নেওয়া হবে।
      আর আগে থেকে HTML formatting থাকলে সেটাই রাখা হবে।
    */
    if(/<[^>]+>/.test(existing)){
      editor.innerHTML = existing;
    }else{
      editor.innerHTML = existing
        .split(/\n{2,}/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g,"<br>")}</p>`)
        .join("");
    }

    editArea.classList.remove("hidden");

    document.querySelector("#text").classList.add("hidden");

    editBtn.classList.add("hidden");

  });

}

// ===== Search + Favorite Filter =====

if(search){
  search.addEventListener("input", function(){
    runGlobalSearch(this.value);
  });
}

if(favoriteFilter){
  favoriteFilter.addEventListener("click", function(){
    showingFavorites = !showingFavorites;

    this.textContent = showingFavorites
      ? "♥ সব কবিতা"
      : "♡ প্রিয় কবিতা";

    render();
  });
}


/* ===== Dashboard top controls ===== */

const homeSearch=document.querySelector("#homeSearch");
const topSearchTitle=document.querySelector("#topSearchTitle");
const topSearchPoet=document.querySelector("#topSearchPoet");
const homeFavoriteBtn=document.querySelector("#homeFavoriteBtn");
const homeDarkModeBtn=document.querySelector("#homeDarkModeBtn");

/* ===== Top-right controls ===== */

const topFavorites=document.querySelector("#topFavorites");
const topSettings=document.querySelector("#topSettings");

if(topFavorites && homeFavoriteBtn){
  topFavorites.addEventListener("click", function(){
    homeFavoriteBtn.click();
  });
}

if(topSettings && homeDarkModeBtn){
  topSettings.addEventListener("click", function(){
    homeDarkModeBtn.click();
  });
}

function runTopSearch(type, value){
  const q=(value||"").trim().toLowerCase();

  if(!q){
    home.classList.remove("hidden");
    library.classList.add("hidden");
    reader.classList.add("hidden");
    return;
  }

  const results=[];

  for(let c=1;c<=12;c++){
    (classData[String(c)]||[]).forEach(function(poem){
      const field = type === "poet"
        ? String(poem.poet||"")
        : String(poem.title||"");

      if(field.toLowerCase().includes(q)){
        results.push(poem);
      }
    });
  }

  home.classList.add("hidden");
  reader.classList.add("hidden");
  library.classList.remove("hidden");

  globalSearchMode=true;
  globalSearchResults=results;
  selectedClasses=[1];

  document.querySelector("#classTitle").textContent =
    type === "poet" ? "কবির নামে সার্চ ফলাফল" : "কবিতার নামে সার্চ ফলাফল";

  document.querySelector("#classCount").textContent =
    `পাওয়া গেছে: ${toBanglaNumber(results.length)} টি`;

  renderPoems(list, results);
}

if(topSearchTitle){
  topSearchTitle.addEventListener("input", function(){
    if(topSearchPoet) topSearchPoet.value="";
    runTopSearch("title", this.value);
  });
}

if(topSearchPoet){
  topSearchPoet.addEventListener("input", function(){
    if(topSearchTitle) topSearchTitle.value="";
    runTopSearch("poet", this.value);
  });
}

if(homeFavoriteBtn){
  homeFavoriteBtn.addEventListener("click", function(){
    const favoritePoems=[];

    for(let c=1;c<=12;c++){
      (classData[String(c)]||[]).forEach(function(poem){
        if(isFavorite(poem)) favoritePoems.push(poem);
      });
    }

    if(favoritePoems.length===0){
      alert("এখনও কোনো প্রিয় কবিতা নির্বাচন করা হয়নি।");
      return;
    }

    home.classList.remove("hidden");
    library.classList.add("hidden");
    reader.classList.add("hidden");

    document.querySelector("#homeClassTitle").textContent="প্রিয় কবিতা";
    document.querySelector("#homeClassCount").textContent=`মোট প্রিয় কবিতা: ${favoritePoems.length} টি`;

    renderPoems(document.querySelector("#homeList"), favoritePoems);

    this.textContent="♥ প্রিয় কবিতা";
  });
}

function updateHomeDarkModeButton(){
  if(!homeDarkModeBtn) return;
  homeDarkModeBtn.textContent = document.body.classList.contains("dark")
    ? "☀️ লাইট মোড"
    : "🌙 ডার্ক মোড";
}

if(homeDarkModeBtn){
  homeDarkModeBtn.addEventListener("click", function(){
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark") ? "1" : "0"
    );
    updateHomeDarkModeButton();
    updateDarkModeButton();
  });
}

updateHomeDarkModeButton();

const classNames=["","প্রথম","দ্বিতীয়","তৃতীয়","চতুর্থ","পঞ্চম","ষষ্ঠ","সপ্তম","অষ্টম","নবম","দশম","একাদশ","দ্বাদশ"];
buildClassNav();

function favoriteKey(x){
  return "favorite_poem_"+x.class+"_"+x.lesson;
}

function isFavorite(x){
  return localStorage.getItem(favoriteKey(x)) === "1";
}

function toggleFavorite(x){
  const key=favoriteKey(x);
  if(isFavorite(x)) localStorage.removeItem(key);
  else localStorage.setItem(key,"1");
  if(!home.classList.contains("hidden")) renderPoems(document.querySelector('#homeList'),classData['1']||[]);
  else render();
}

function savedText(x){
  return x && x.text ? x.text : "";
}

function poemCountText(c){
  const n=(classData[String(c)]||[]).length;
  return `মোট কবিতা: ${toBanglaNumber(n)} টি`;
}

const backBtn=document.querySelector("#back");

if(backBtn){
  backBtn.addEventListener("click", function(){
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    if(window.Android && Android.stop) Android.stop();
    reader.classList.add("hidden");
    library.classList.remove("hidden");
  });
}

window.__openPoem = function(c, i){
  const arr = classData[String(c)] || [];
  const poem = arr[Number(i)];
  if (poem) show(poem);
};

function poemCardColor(x, i){
  const titleColors = ["#7a159b","#0574d0","#dc214f","#6c18be","#e86b00","#cf0a8b","#168b39","#006bb9","#8a3ffc","#b44b00","#087f5b","#9c2c77","#3454d1","#a23e48","#2b9348","#7b2cbf","#c44536","#15616d","#9a031e","#4f772d","#6a4c93","#9c6644","#386641","#7f5539","#3a506b","#5f0f40","#3d405b","#8338ec","#006d77","#9b5de5"];
  const color = titleColors[(Number(i) < 0 ? 0 : Number(i)) % titleColors.length];
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  const tint = c => Math.round(255 - (255-c)*0.15);
  return "#" + [r,g,b].map(tint).map(v=>v.toString(16).padStart(2,"0")).join("");
}

function poemCardExcerpt(x){
  const raw = savedText(x) || x.text || "";
  const temp = document.createElement("div");
  temp.innerHTML = raw;

  if(!temp.textContent.trim()) return "";

  const blocks = [...temp.children];

  if(!blocks.length){
    return temp.textContent
      .replace(/\\r/g, "")
      .trim()
      .split("\\n")
      .slice(0, 3)
      .join("<br>");
  }

  const previewBox = document.createElement("div");

  blocks.slice(0, 3).forEach(block => {
    const clone = block.cloneNode(true);
    previewBox.appendChild(clone);
  });

  const hasMore = blocks.length > 3;

  return previewBox.innerHTML + (hasMore ? " …" : "");
}
function poemCardHTML(x, i){
  const image = x.image ? `<img src="${x.image}" alt="" onerror="this.style.display='none'">` : "📚";
  const realIndex=(classData[String(x.class)]||[]).indexOf(x);
  const cardColor = poemCardColor(x, i);
  const titleColor = ["#7a159b","#0574d0","#dc214f","#6c18be","#e86b00","#cf0a8b","#168b39","#006bb9","#8a3ffc","#b44b00","#087f5b","#9c2c77","#3454d1","#a23e48","#2b9348","#7b2cbf","#c44536","#15616d","#9a031e","#4f772d","#6a4c93","#9c6644","#386641","#7f5539","#3a506b","#5f0f40","#3d405b","#8338ec","#006d77","#9b5de5"][(Number(i)) % 30];
  const poetColor = ["#00695c","#ad1457","#283593","#ef6c00","#2e7d32","#6d4c41","#00838f","#c62828","#4527a0","#558b2f","#5d4037","#0277bd","#6a1b9a","#9e9d24","#37474f","#d84315","#1b5e20","#1565c0","#880e4f","#4e342e","#00897b","#bf360c","#303f9f","#33691e","#795548","#00796b","#e65100","#512da8","#827717","#263238"][(Number(i)) % 30];
  return `<div class="card" data-i="${i}" data-class="${x.class}" style="background:${cardColor} !important;">
    <button class="favoriteBtn" data-fav="${i}" aria-label="প্রিয় কবিতা">${isFavorite(x) ? "♥" : "♡"}</button>
    ${VIEWER_MODE ? "" : `<button class="deleteUserPoem" data-index="${realIndex}" data-class="${x.class}" type="button" onclick="event.preventDefault();event.stopPropagation();deleteUserPoem(this.dataset.class,this.dataset.index);return false;">🗑</button>`}
    ${x.oldBook ? `<div class="old-book-label">📚 পুরোনো কবিতা</div>` : ""}
    <div class="card-illustration">${image}</div>
    <h3 style="color:${titleColor} !important;font-family:'SolaimanLipi',sans-serif;">${x.title}</h3>
    <div class="poet" style="color:${poetColor} !important;font-family:'SolaimanLipi',sans-serif;">${x.poet || "উল্লেখ নেই"}</div>

    <div class="excerpt">${poemCardExcerpt(x).replace(/\n/g, "<br>")}</div>

    ${globalSearchMode ? `<div class="global-class-label">শ্রেণি: ${classNames[Number(x.class)] || x.class}</div>` : ""}

  </div>`;
}

function bindPoemCards(container, arr){
  if(!container) return;
  container.querySelectorAll('.card').forEach(card=>{
    const i=Number(card.dataset.i);
    card.onclick=(ev)=>{
      if(ev.target.closest('.favoriteBtn') || ev.target.closest('.deleteUserPoem')) return;
      show(arr[i]);
    };
  });
  container.querySelectorAll('.favoriteBtn').forEach(btn=>btn.onclick=(ev)=>{ev.stopPropagation();toggleFavorite(arr[Number(btn.dataset.fav)]);});
;
}

function renderPoems(container, arr){
  if(!container) return;
  if(!arr.length){
    container.innerHTML='<div class="empty">এই শ্রেণিতে এখনো কোনো কবিতা যোগ করা হয়নি।</div>';
    return;
  }
  container.innerHTML=arr.map((x,i)=>poemCardHTML(x,i)).join('');
  bindPoemCards(container,arr);
}


function buildClassNav(){

  const nav = document.querySelector("#navClasses");

  if(!nav) return;

  nav.innerHTML = "";

  const classGroups = [
    { key: "1", classes: [1], label: "প্রথম" },
    { key: "2", classes: [2], label: "দ্বিতীয়" },
    { key: "3", classes: [3], label: "তৃতীয়" },
    { key: "4", classes: [4], label: "চতুর্থ" },
    { key: "5", classes: [5], label: "পঞ্চম" },
    { key: "6", classes: [6], label: "ষষ্ঠ" },
    { key: "7", classes: [7], label: "সপ্তম" },
    { key: "8", classes: [8], label: "অষ্টম" },
    { key: "9-10", classes: [9, 10], label: "নবম–দশম" },
    { key: "11-12", classes: [11, 12], label: "একাদশ–দ্বাদশ" }
  ];

  classGroups.forEach(group => {

    const btn = document.createElement("button");

    btn.className = "nav-class";

    btn.dataset.class = group.key;

    btn.type = "button";

    btn.innerHTML = `<span class="nav-icon">📚</span><span>${group.label} শ্রেণি</span>`;

    btn.addEventListener("click", function(){

      openClass(group.classes);

    });

    nav.appendChild(btn);

  });

}
function updateNav(c){

  const classes = c == null
    ? []
    : (Array.isArray(c) ? c.map(Number) : [Number(c)]);

  selectedClasses = classes;

  document.querySelectorAll('.nav-class').forEach(b => {

    const key = b.dataset.class;

    let active = false;

    if(key === "9-10"){

      active = classes.includes(9) || classes.includes(10);

    } else if(key === "11-12"){

      active = classes.includes(11) || classes.includes(12);

    } else {

      active = classes.includes(Number(key));

    }

    b.classList.toggle('active', active);

  });

}
function openClass(c){
  document.querySelector("#contents")?.classList.add("hidden");


  globalSearchMode=false;

  globalSearchResults=[];

  const classes = Array.isArray(c) ? c.map(Number) : [Number(c)];
  selectedClasses = classes;


  items = classes.flatMap(cls => classData[String(cls)] || []);

  home.classList.add('hidden');

  reader.classList.add('hidden');

  library.classList.remove('hidden');

  let title = "";

  if(classes.length === 2 && classes[0] === 9 && classes[1] === 10){

    title = "নবম–দশম শ্রেণি";

  } else if(classes.length === 2 && classes[0] === 11 && classes[1] === 12){

    title = "একাদশ–দ্বাদশ শ্রেণি";

  } else {

    title = `${classNames[classes[0]]} শ্রেণি`;

  }

  document.querySelector('#classTitle').textContent = title;

  document.querySelector('#classCount').textContent = `${toBanglaNumber(items.length)} টি কবিতা`;

  if(search) search.value='';

  showingFavorites=false;

  if(favoriteFilter) favoriteFilter.textContent='♡ প্রিয় কবিতা';

  updateNav(classes);

  render();

}
function showHome(){

  document.querySelector("#contents")?.classList.add("hidden");

  home.classList.remove('hidden');

  library.classList.add('hidden');

  reader.classList.add('hidden');

  document.querySelector('#homeClassTitle').textContent="বাংলা পাঠশালা";

  document.querySelector('#homeClassCount').textContent="শ্রেণি নির্বাচন করুন";

  const homeList = document.querySelector('#homeList');

  if(homeList){
    homeList.innerHTML='<div class="empty">উপরের All Class থেকে একটি শ্রেণি নির্বাচন করুন।</div>';
  }

  updateNav(null);

}


function toBanglaNumber(n){
  return String(n).replace(/[0-9]/g, function(d){ return "০১২৩৪৫৬৭৮৯"[Number(d)]; });
}

function renderContents(){
  const contents=document.querySelector("#contents");
  const className=document.querySelector("#contentsClassName");
  const wrap=document.querySelector("#contentsTableWrap");
  if(!contents || !className || !wrap) return;

  let title="";
  if(selectedClasses.length===2 && selectedClasses[0]===9 && selectedClasses[1]===10){
    title="নবম–দশম শ্রেণি";
  }else if(selectedClasses.length===2 && selectedClasses[0]===11 && selectedClasses[1]===12){
    title="একাদশ–দ্বাদশ শ্রেণি";
  }else{
    title=(classNames[selectedClasses[0]] || selectedClasses[0])+" শ্রেণি";
  }

  className.textContent=title;

  const poems=selectedClasses.flatMap(function(c){
    return classData[String(c)] || [];
  });

  if(poems.length===0){
    wrap.innerHTML="<div class=\"contents-empty\">এই শ্রেণিতে কোনো কবিতা পাওয়া যায়নি।</div>";
    return;
  }

  wrap.innerHTML=`<table class="contents-table">
    <thead><tr><th>নং</th><th>কবিতার নাম</th><th>কবি</th><th>কবিতার ধরন</th></tr></thead>
    <tbody>${poems.map(function(poem,i){
      return `<tr data-class="${poem.class}" data-index="${(classData[String(poem.class)]||[]).indexOf(poem)}">
        <td>${toBanglaNumber(i+1)}</td>
        <td>${poem.title || "নাম নেই"}</td>
        <td>${poem.poet || "—"}</td>
        <td>${poem.oldBook ? "পুরোনো কবিতা" : ""}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;

  wrap.querySelectorAll("tbody tr").forEach(function(row){
    row.addEventListener("click", function(){
      const arr=classData[String(this.dataset.class)] || [];
      const poem=arr[Number(this.dataset.index)];
      if(poem) show(poem);
    });
  });
}

const homeContentsBtn=document.querySelector("#homeContentsBtn");

if(homeContentsBtn){
  homeContentsBtn.addEventListener("click", function(){
    home.classList.add("hidden");
    library.classList.add("hidden");
    reader.classList.add("hidden");
    document.querySelector("#contents").classList.remove("hidden");
    renderContents();
  });
}

const navHome=document.querySelector("#navHome");
const homeBtn=document.querySelector("#homeBtn");

if(navHome){
  navHome.addEventListener("click", function(){
    showHome();
  });
}

if(homeBtn){
  homeBtn.addEventListener("click", function(){
    showHome();
  });
}

function runGlobalSearch(q){
  q=(q||"").trim().toLowerCase();
  if(!q){
    openClass(1);
    return;
  }
  globalSearchMode=true;
  globalSearchResults=[];
  for(let c=1;c<=12;c++){
    (classData[String(c)]||[]).forEach(x=>{
      const hay=(String(x.title||"")+" "+String(x.poet||"")).toLowerCase();
      if(hay.includes(q)) globalSearchResults.push(x);
    });
  }
  items=globalSearchResults;
  home.classList.add("hidden");
  reader.classList.add("hidden");
  library.classList.remove("hidden");
  document.querySelector('#classTitle').textContent='সব শ্রেণিতে সার্চ ফলাফল';
  document.querySelector('#classCount').textContent=`পাওয়া গেছে: ${toBanglaNumber(globalSearchResults.length)} টি`;
  showingFavorites=false;
  if(favoriteFilter) favoriteFilter.textContent='♡ প্রিয় কবিতা';
  render();
}

function render(){
  const q=(search ? search.value : '').trim().toLowerCase();
  let a=items.filter(x=>(x.title+" "+(x.poet||"")).toLowerCase().includes(q));
  if(showingFavorites) a=a.filter(isFavorite);
  renderPoems(list,a);
  const c=items[0] ? Number(items[0].class) : 1;
  const countEl=document.querySelector('#classCount');
  if(countEl) countEl.textContent=poemCountText(c);
}

function show(x){
  currentPoem=x;

  library.classList.add("hidden");
  reader.classList.remove("hidden");

  document.querySelector("#meta").textContent=
    `শ্রেণি: ${classNames[x.class]}`;

  document.querySelector("#title").textContent=x.title;

  document.querySelector("#poet").textContent=
    x.poet ? x.poet : "";

  const poemTextEl = document.querySelector("#text");
  const displayText = savedText(x);

  poemTextEl.style.fontFamily =
    '"Nirmala UI","Noto Sans Bengali",sans-serif';

  poemTextEl.innerHTML =
    /<[^>]+>/.test(displayText)
      ? displayText
      : displayText.replace(/\\n/g, "<br>");

  editArea.classList.add("hidden");
  document.querySelector("#text").classList.remove("hidden");
  editBtn.classList.remove("hidden");
  if(reciteControls){
    reciteControls.classList.remove("hidden");
  }
  if(speakBtn){

  speakBtn.onclick=()=>{

    if(!currentPoem) return;

    const title=currentPoem.title || "";

    const poet=currentPoem.poet ? `কবি: ${currentPoem.poet}` : "";

    const poem=savedText(currentPoem);

    const fullText=[title,poet,poem].filter(Boolean).join("\\n");

    // Android app: existing native speech
    if(window.Android && typeof Android.speak === "function"){

      Android.speak(fullText);

      speakBtn.textContent="🎙️ আবৃত্তি চলছে";

      if(reciteControls) reciteControls.classList.remove("hidden");

      return;

    }

    // Web browser: Speech Synthesis
    if("speechSynthesis" in window){

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(fullText);

      utterance.lang = "bn-BD";
      utterance.rate = 0.85;
      utterance.pitch = 1;

      const voices = window.speechSynthesis.getVoices();

      const bengaliVoice = voices.find(v =>
        v.lang && v.lang.toLowerCase().startsWith("bn")
      );

      if(bengaliVoice){
        utterance.voice = bengaliVoice;
      }

      utterance.onstart = () => {
        speakBtn.textContent="🎙️ আবৃত্তি চলছে";
        if(reciteControls) reciteControls.classList.remove("hidden");
      };

      utterance.onend = () => {
        speakBtn.textContent="🎙️ আবৃত্তি শুরু";
      };

      utterance.onerror = () => {
        speakBtn.textContent="🎙️ আবৃত্তি শুরু";
      };

      window.speechSynthesis.speak(utterance);

      return;

    }

    alert("এই Browser-এ আবৃত্তি সুবিধা পাওয়া যাচ্ছে না।");

  };

}
}

let isPaused=false;

if(pauseBtn){
  pauseBtn.onclick=()=>{
    if(!window.Android) return;

    if(isPaused){
      if(Android.resume){
        Android.resume();
      }
      isPaused=false;
      pauseBtn.textContent="⏸️ বিরতি";
    }else{
      if(Android.pause){
        Android.pause();
      }
      isPaused=true;
      pauseBtn.textContent="▶️ চালাও";
    }
  };
}

if(resumeBtn){
  resumeBtn.onclick=()=>{
    if(window.Android && Android.resume){
      Android.resume();
    }
  };
}

if(stopBtn){
  stopBtn.onclick=()=>{
    if(window.Android && Android.stop){
      Android.stop();
    }
    if(speakBtn) speakBtn.textContent="🎙️ আবৃত্তি শুরু";
  };
}

window.addEventListener("beforeunload",()=>{
  if(window.Android && Android.stop){
    Android.stop();
  }
});

window.addEventListener("beforeunload",()=>{
  if(window.Android && Android.stop){
    Android.stop();
  }
});


/* ===== নতুন কবিতা যোগ করার ব্যবস্থা ===== */
(function () {
  const classNames12 = [
    "", "প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম",
    "ষষ্ঠ", "সপ্তম", "অষ্টম", "নবম", "দশম", "একাদশ", "দ্বাদশ"
  ];

  let addPoemClass = null;

  // ১-১২ শ্রেণির জন্য data তৈরি
  for (let i = 1; i <= 12; i++) {
    if (!classData[i]) classData[i] = [];
  }
  function addButton() {
    if(VIEWER_MODE){
      return;
    }
    const library = document.getElementById("library");
    if (!library || document.getElementById("addPoemBtn")) return;

    const btn = document.createElement("button");
    btn.id = "addPoemBtn";
    btn.textContent = "➕ নতুন কবিতা যোগ করুন";
    btn.style.cssText =
      "display:block;margin:12px 0;padding:12px 18px;border:0;border-radius:12px;font-size:16px;cursor:pointer;background:#ffe0ec;";

    const bar = library.querySelector(".bar");
    if (bar) bar.after(btn);
    else library.prepend(btn);

    btn.onclick = function () {
      showPoemForm();
    };

    const oldBookBtn = document.createElement("button");
    oldBookBtn.id = "oldBookPoemBtn";
    oldBookBtn.textContent = "📚 পুরোনো বইয়ের কবিতা যোগ করুন";
    oldBookBtn.style.cssText =
      "display:block;margin:0 0 12px 0;padding:12px 18px;border:0;border-radius:12px;font-size:16px;cursor:pointer;background:#e8e0ff;";
    btn.after(oldBookBtn);

    oldBookBtn.onclick = function () {
      showOldBookPoemForm();
    };
  }

  function showOldBookPoemForm() {
    if(VIEWER_MODE){
      return;
    }

    if (Array.isArray(selectedClasses) && selectedClasses.length > 0) {
      if (selectedClasses.includes(9) && selectedClasses.includes(10)) {
        addPoemClass = 9;
      } else if (selectedClasses.includes(11) && selectedClasses.includes(12)) {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(selectedClasses[0]);
      }
    }

    if (!addPoemClass) {
      alert("আগে একটি শ্রেণি নির্বাচন করুন।");
      return;
    }

    let old = document.getElementById("newPoemBox");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "newPoemBox";
    box.style.cssText =
      "background:#fff;padding:16px;border-radius:16px;margin:12px 0;box-shadow:0 2px 10px #0002;";

    box.innerHTML = `
      <h3>📚 পুরোনো বইয়ের কবিতা যোগ করুন</h3>

      <input id="oldPoemLesson" type="number" min="1"
        placeholder="পুরোনো বইয়ের পাঠ/ক্রমিক নম্বর"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="oldPoemTitle"
        placeholder="কবিতার নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="oldPoemPoet"
        placeholder="কবির নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <textarea id="oldPoemText" rows="10"
        placeholder="কবিতার লেখা"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;"></textarea>

      <button id="saveOldPoem"
        style="padding:10px 16px;border:0;border-radius:10px;background:#e8e0ff;cursor:pointer;">
        💾 পুরোনো কবিতা সংরক্ষণ
      </button>

      <button id="cancelOldPoem"
        style="padding:10px 16px;border:0;border-radius:10px;background:#eee;cursor:pointer;margin-left:6px;">
        বাতিল
      </button>
    `;

    const list = document.getElementById("list");
    if (list) list.before(box);

    document.getElementById("cancelOldPoem").onclick = function () {
      box.remove();
    };

    document.getElementById("saveOldPoem").onclick = async function () {
      if(VIEWER_MODE){
        return;
      }

      const lesson = Number(document.getElementById("oldPoemLesson").value);
      const title = document.getElementById("oldPoemTitle").value.trim();
      const poet = document.getElementById("oldPoemPoet").value.trim();
      const text = document.getElementById("oldPoemText").value.trim();

      if (!lesson || lesson < 1) {
        alert("পুরোনো বইয়ের পাঠ/ক্রমিক নম্বর দিতে হবে।");
        return;
      }

      if (!title || !text) {
        alert("কবিতার নাম এবং কবিতার লেখা দিতে হবে।");
        return;
      }

      const saveButton = document.getElementById("saveOldPoem");
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.6";
      }

      const poemKey =
        "old-book-class-" + Number(addPoemClass) +
        "-lesson-" + lesson +
        "-title-" + title.toLowerCase() +
        "-text-" + text.toLowerCase();

      try {
        const existingRows = await supabaseRequest(
          "poems?select=*&poem_key=eq." +
          encodeURIComponent(poemKey) +
          "&limit=1"
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          alert("এই পুরোনো বইয়ের কবিতাটি ইতিমধ্যে Supabase-এ আছে।");
          box.remove();
          return;
        }

        const rows = await supabaseRequest("poems", {
          method: "POST",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            poem_key: poemKey,
            class: Number(addPoemClass),
            lesson: lesson,
            title: title,
            poet: poet,
            source_page: null,
            is_excerpt: false,
            text: text,
            user_added: true,
            old_book: true
          })
        });

        if (!Array.isArray(rows) || !rows[0] || !rows[0].id) {
          throw new Error("Supabase save failed");
        }

        const row = rows[0];

        const poem = {
          id: row.id,
          class: row.class,
          lesson: row.lesson,
          title: row.title,
          poet: row.poet || "",
          source_page: row.source_page,
          is_excerpt: !!row.is_excerpt,
          text: row.text,
          userAdded: !!row.user_added,
          oldBook: true
        };

        if (!classData[addPoemClass]) {
          classData[addPoemClass] = [];
        }

        classData[addPoemClass].push(poem);

        box.remove();
        items = classData[addPoemClass] || [];
        render();

        alert("পুরোনো বইয়ের কবিতা সফলভাবে যোগ হয়েছে।");

      } catch (err) {
        console.error("Old book poem save error:", err);
        alert("পুরোনো বইয়ের কবিতা সংরক্ষণ করা যায়নি.");

        if (saveButton) {
          saveButton.disabled = false;
          saveButton.style.opacity = "1";
        }
      }
    };
  }

  function showPoemForm() {
    if(VIEWER_MODE){
      return;
    }

    // Combined class হলে প্রথম class-এ নতুন কবিতা সংরক্ষণ
    if (Array.isArray(selectedClasses) && selectedClasses.length > 0) {
      if (selectedClasses.includes(9) && selectedClasses.includes(10)) {
        addPoemClass = 9;
      } else if (selectedClasses.includes(11) && selectedClasses.includes(12)) {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(selectedClasses[0]);
      }
    }

    let old = document.getElementById("newPoemBox");
    if (old) old.remove();

    let duplicateFound = false;
    const box = document.createElement("div");
    box.id = "newPoemBox";
    box.style.cssText =
      "background:#fff;padding:16px;border-radius:16px;margin:12px 0;box-shadow:0 2px 10px #0002;";

    box.innerHTML = `
      <h3>➕ নতুন কবিতা যোগ করুন</h3>

      <input id="newPoemTitle"
        placeholder="কবিতার নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <input id="newPoemPoet"
        placeholder="কবির নাম"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;">

      <textarea id="newPoemText"
        placeholder="এখানে কবিতাটি লিখুন বা paste করুন"
        rows="10"
        style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;border-radius:10px;border:1px solid #ccc;"></textarea>

      <button id="saveNewPoem"
        style="padding:11px 18px;border:0;border-radius:10px;background:#dff5e1;cursor:pointer;">
        💾 সংরক্ষণ
      </button>

      <button id="cancelNewPoem"
        style="padding:11px 18px;border:0;border-radius:10px;background:#eee;cursor:pointer;margin-left:6px;">
        বাতিল
      </button>
    `;

    const list = document.getElementById("list");
    if (list) list.before(box);

    document.getElementById("cancelNewPoem").onclick = function () {
      box.remove();
    };

    document.getElementById("saveNewPoem").onclick = async function () {
      if(VIEWER_MODE){
        return;
      }
      const title = document.getElementById("newPoemTitle").value.trim();
      const poet = document.getElementById("newPoemPoet").value.trim();
      const text = document.getElementById("newPoemText").value.trim();

      if (!title || !text) {
        alert("কবিতার নাম এবং কবিতার লেখা দিতে হবে।");
        return;
      }

      if (!addPoemClass) {
        alert("আগে একটি শ্রেণি নির্বাচন করুন।");
        return;
      }

      const saveButton = document.getElementById("saveNewPoem");

      if (saveButton) {
        saveButton.disabled = true;
        saveButton.style.opacity = "0.6";
      }

      const poemKey =
        "class-" + Number(addPoemClass) +
        "-title-" + title.toLowerCase() +
        "-text-" + text.toLowerCase();

      try {
        // আগে Supabase-এ duplicate আছে কি না দেখি
        const existingRows = await supabaseRequest(
          "poems?select=*&poem_key=eq." +
          encodeURIComponent(poemKey) +
          "&limit=1"
        );

        if (Array.isArray(existingRows) && existingRows.length > 0) {
          alert("এই কবিতাটি ইতিমধ্যে Supabase-এ আছে।");
          box.remove();
          return;
        }

        // একই Class-এর নতুন কবিতার পরবর্তী lesson number নির্ধারণ
        const userAddedRows = await supabaseRequest(
          "poems?select=lesson&class=eq." +
          Number(addPoemClass) +
          "&order=lesson.desc&limit=1"
        );

        let nextLesson = 1;

        if (Array.isArray(userAddedRows) && userAddedRows.length > 0) {
          const maxLesson = Number(userAddedRows[0].lesson || 0);
          nextLesson = maxLesson + 1;
        }

        // Supabase-এ নতুন কবিতা তৈরি
        const rows = await supabaseRequest("poems", {
          method: "POST",
          headers: {
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            poem_key: poemKey,
            class: Number(addPoemClass),
            lesson: nextLesson,
            title: title,
            poet: poet,
            source_page: null,
            is_excerpt: false,
            text: text,
            user_added: true
          })
        });

        if (!Array.isArray(rows) || !rows[0] || !rows[0].id) {
          throw new Error("Supabase নতুন কবিতার ID ফেরত দেয়নি।");
        }

        // Supabase-এর returned row-টাই app-এর data হিসেবে ব্যবহার
        const row = rows[0];

        const poem = {
          id: row.id,
          class: row.class,
          lesson: row.lesson,
          title: row.title,
          poet: row.poet || "",
          source_page: row.source_page,
          is_excerpt: !!row.is_excerpt,
          text: row.text,
          userAdded: !!row.user_added
        };

        if (!classData[addPoemClass]) {
          classData[addPoemClass] = [];
        }

        classData[addPoemClass].push(poem);

        console.log("New poem synced to Supabase:", poem.id);

        box.remove();

        items = classData[addPoemClass] || [];
        render();

        setTimeout(enablePoemDeleteButtons, 50);

        alert("কবিতাটি সফলভাবে যোগ হয়েছে।");

      } catch (error) {
        console.error("New poem sync failed:", error);

        if (saveButton) {
          saveButton.disabled = false;
          saveButton.style.opacity = "1";
        }

        alert("Supabase Add Error: " + error.message);
      }
    };

  }


  // ===== যোগ করা কবিতা Delete করার ব্যবস্থা =====
  function enablePoemDeleteButtons() {
    if(VIEWER_MODE){
      return;
    }
    document.querySelectorAll(".deleteUserPoem").forEach(function (btn) {
      if (btn.dataset.ready === "1") return;

      btn.dataset.ready = "1";

      btn.addEventListener("click", async function (e) {
        e.stopPropagation();

        const index = Number(btn.dataset.index);
        const cls = Number(btn.dataset.class);

        if (!confirm("এই কবিতাটি মুছে ফেলতে চান?")) return;

        const poemToDelete =
          classData[cls] && classData[cls][index]
            ? classData[cls][index]
            : null;

        if (!poemToDelete) {
          alert("এই কবিতাটি পাওয়া যায়নি।");
          return;
        }

        // Supabase ID ছাড়া কোনো poem delete করা হবে না
        if (!poemToDelete.id) {
          alert("এই কবিতার Supabase ID পাওয়া যায়নি।");
          return;
        }

        btn.disabled = true;

        try {
          await supabaseRequest(
            "poems?id=eq." + encodeURIComponent(poemToDelete.id),
            {
              method: "DELETE",
              headers: {
                "Prefer": "return=minimal"
              }
            }
          );

          console.log(
            "Poem deleted from Supabase:",
            poemToDelete.id
          );

          // Supabase delete সফল হওয়ার পরেই UI থেকে remove
          classData[cls].splice(index, 1);

          items = classData[cls] || [];

          render();

          setTimeout(enablePoemDeleteButtons, 50);

          alert("কবিতাটি সফলভাবে মুছে ফেলা হয়েছে।");

        } catch (error) {
          console.error("Poem delete sync failed:", error);

          btn.disabled = false;

          alert("Supabase Delete Error: " + error.message);
        }
      });
    });
  }

  // render হওয়ার পর Delete button চালু করা
  const originalRenderForDelete = render;
  render = function () {
    originalRenderForDelete();
    setTimeout(enablePoemDeleteButtons, 30);
  };

  // শ্রেণির button-এ click হলে কোন শ্রেণি খোলা হয়েছে সেটা মনে রাখা
  document.querySelectorAll(".nav-class").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.dataset.class;

      if (key === "9-10") {
        addPoemClass = 9;
      } else if (key === "11-12") {
        addPoemClass = 11;
      } else {
        addPoemClass = Number(key);
      }

      setTimeout(addButton, 50);
    });
  });

  if (!home.classList.contains("hidden")) showHome();
})();
    
// ===== Supabase Cloud Sync =====
async function initializeCloudSync() {
  console.log("Cloud sync starting...");

  const loaded = await loadPoemsFromSupabase();

  if (loaded) {
    items = classData[1] || [];

    if (!home.classList.contains("hidden")) {
      document.querySelector("#homeClassCount").textContent = poemCountText(1);
      renderPoems(document.querySelector("#homeList"), classData["1"] || []);
    } else {
      render();
    }

    console.log("Cloud sync completed.");
  } else {
    console.log("Cloud sync loaded no poems.");
  }
}
initializeCloudSync();



/* Ensure dynamically rendered read buttons stay compact on every render. */
(function(){
  function compactReadButtons(){
    document.querySelectorAll(".card .readBtn, .globalSearchCard .readBtn").forEach(function(btn){
      btn.style.setProperty("width","fit-content","important");
      btn.style.setProperty("min-width","0","important");
      btn.style.setProperty("max-width","max-content","important");
      btn.style.setProperty("height","30px","important");
      btn.style.setProperty("min-height","0","important");
      btn.style.setProperty("padding","4px 9px","important");
      btn.style.setProperty("font-size","12px","important");
      btn.style.setProperty("line-height","1","important");
      btn.style.setProperty("border-radius","8px","important");
    });
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", compactReadButtons);
  }else{
    compactReadButtons();
  }
  if(document.body){
    new MutationObserver(compactReadButtons).observe(document.body,{childList:true,subtree:true});
  }
})();

const classContentsBtn=document.querySelector("#classContentsBtn");

if(classContentsBtn){
  classContentsBtn.addEventListener("click", function(){
    home.classList.add("hidden");
    library.classList.add("hidden");
    reader.classList.add("hidden");
    document.querySelector("#contents").classList.remove("hidden");
    renderContents();
  });
}
