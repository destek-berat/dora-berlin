/* DORA BERLIN - Sol hamburger kategori menusu. Mevcut kategori filtrelerini kullanir. */
(function () {
"use strict";
if(window.__doraMenu) return;
window.__doraMenu=true;
const nav=document.querySelector("nav.nav")||document.querySelector("header nav")||document.querySelector("nav")||document.querySelector("header");
if(!nav) return;
const n=x=>String(x||"").toLocaleLowerCase("tr-TR").trim().replace(/^\s*(kadın|bayan)\s+/,"").replace(/\s+/g," ");
const isAll=x=>/^(hepsi|tüm ürünler|koleksiyon)$/.test(n(x));
const isCat=x=>isAll(x)||/^(deri kemer|deri çanta|çanta süsleri|kürk şapka|çantalar|deri ceketler|ayakkabılar|cüzdanlar|aksesuarlar|favoriler|♡ favoriler)$/.test(n(x));
const css=[
".dora-menu-header{display:flex!important;align-items:center!important;justify-content:flex-start!important}",
".dora-menu-header>.actions,.dora-menu-header>.header-actions{margin-left:auto}",
".dora-menu-header .dora-original-nav,.dora-menu-header .dora-original-link{display:none!important}",
"#dora-hamburger{display:inline-flex;flex:0 0 40px;width:40px;height:40px;align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:4px;margin-right:15px;border:0;background:transparent;cursor:pointer}",
"#dora-hamburger i{display:block;width:23px;height:2px;background:#35251e;border-radius:2px}",
"#dora-hamburger:focus-visible,.dora-side-panel button:focus-visible{outline:2px solid #ae8866;outline-offset:3px}",
".dora-overlay{position:fixed;inset:0;background:rgba(20,14,11,.55);z-index:9997;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s}",
".dora-overlay.open{opacity:1;visibility:visible;pointer-events:auto}",
".dora-side-panel{position:fixed;top:0;bottom:0;left:0;width:min(380px,90vw);background:#fbf8f3;color:#35251e;z-index:9998;box-shadow:10px 0 40px rgba(0,0,0,.2);transform:translateX(-105%);visibility:hidden;transition:transform .25s,visibility .25s;overflow-y:auto}",
".dora-side-panel.open{transform:translateX(0);visibility:visible}",
".dora-side-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e6d9cb;padding:23px 25px}",
".dora-side-logo{font:24px Georgia,serif;letter-spacing:4px}",
".dora-side-logo small{display:block;font:9px Arial,sans-serif;letter-spacing:4px}",
".dora-side-close{border:0;background:none;font-size:30px;cursor:pointer;color:inherit}",
".dora-side-content{padding:22px 25px 40px}",
".dora-side-label{color:#a1846e;letter-spacing:2px;font:10px Arial,sans-serif;margin:4px 0 17px}",
".dora-side-item{display:flex;align-items:center;justify-content:space-between;width:100%;padding:16px 2px;text-align:left;border:0;border-bottom:1px solid #eee4d9;background:transparent;color:inherit;font:17px Georgia,serif;cursor:pointer}",
".dora-side-item:hover{color:#94725b}",
".dora-side-submenu{border-left:1px solid #e1d4c7;margin-left:10px}",
".dora-side-submenu[hidden]{display:none}",
".dora-side-submenu .dora-side-item{padding-left:18px;font-size:15px}",
".dora-category-filters-hidden{display:none!important}",
"body.dora-side-open{overflow:hidden!important}",
"#catalog,#products{scroll-margin-top:110px}",
"@media(max-width:700px){#dora-hamburger{margin-right:8px;flex-basis:36px;width:36px}}",
"@media(prefers-reduced-motion:reduce){.dora-overlay,.dora-side-panel{transition:none!important}}"
].join("");
const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
nav.classList.add("dora-menu-header");
const toggle=document.createElement("button");toggle.id="dora-hamburger";toggle.type="button";toggle.setAttribute("aria-label","Ürün kategorileri menüsünü aç");toggle.setAttribute("aria-expanded","false");
for(let i=0;i<3;i++){let bar=document.createElement("i");bar.setAttribute("aria-hidden","true");toggle.appendChild(bar);}
nav.insertBefore(toggle,nav.firstChild);
const overlay=document.createElement("div");overlay.className="dora-overlay";
const panel=document.createElement("aside");panel.className="dora-side-panel";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Ürün kategorileri");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-hidden","true");panel.inert=true;
const head=document.createElement("div");head.className="dora-side-head";
const logo=document.createElement("div");logo.className="dora-side-logo";logo.innerHTML="DORA<small>BERLIN</small>";
const close=document.createElement("button");close.type="button";close.className="dora-side-close";close.textContent="×";close.setAttribute("aria-label","Menüyü kapat");head.append(logo,close);
const content=document.createElement("div");content.className="dora-side-content";panel.append(head,content);document.body.append(overlay,panel);
let previousOverflow="";
function shut(){panel.classList.remove("open");overlay.classList.remove("open");panel.inert=true;panel.setAttribute("aria-hidden","true");toggle.setAttribute("aria-expanded","false");document.body.classList.remove("dora-side-open");document.body.style.overflow=previousOverflow;toggle.focus();}
function open(){previousOverflow=document.body.style.overflow;panel.classList.add("open");overlay.classList.add("open");panel.inert=false;panel.setAttribute("aria-hidden","false");toggle.setAttribute("aria-expanded","true");document.body.classList.add("dora-side-open");close.focus();}
toggle.addEventListener("click",()=>panel.classList.contains("open")?shut():open());
close.addEventListener("click",shut);overlay.addEventListener("click",shut);
document.addEventListener("keydown",e=>{if(!panel.classList.contains("open"))return;if(e.key==="Escape"){shut();return;}if(e.key==="Tab"){const arr=[...panel.querySelectorAll("button")].filter(el=>el.getClientRects().length>0),first=arr[0],last=arr[arr.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function catRow(){const root=document.querySelector("#filters");if(root){const row=[...root.children].find(el=>{const b=[...el.querySelectorAll("button")];return b.length>1&&b.some(x=>isAll(x.textContent))&&!n(el.textContent).startsWith("renk:");});if(row)return row;}return document.querySelector("#categoryFilters,.category-filters,.category-buttons");}
function original(){const row=catRow();const filterButtons=row?[...row.querySelectorAll("button,a")]:[];const navButtons=[...nav.querySelectorAll("button,a")].filter(x=>x!==toggle);return [...filterButtons,...navButtons].filter(x=>isCat(x.textContent));}
function go(name){let buttons=original(),key=n(name);const button=buttons.find(x=>n(x.textContent)===key)||buttons.find(x=>isAll(name)&&isAll(x.textContent));shut();if(button)button.click();else if(/favori/.test(key)&&typeof window.showFavorites==="function")window.showFavorites();else if(typeof window.goProducts==="function")window.goProducts(isAll(name)?"Hepsi":name);const target=document.querySelector("#catalog,#products,[data-products],.products");if(target)setTimeout(()=>target.scrollIntoView({behavior:"smooth",block:"start"}),50);}
function item(label,target){const b=document.createElement("button");b.type="button";b.className="dora-side-item";b.textContent=label;b.addEventListener("click",()=>go(target||label));return b;}
function build(){
 const row=catRow();if(row)row.classList.add("dora-category-filters-hidden");
 const group=nav.querySelector(".navlinks,.nav-links,.header-links,.desktop-menu,.desktop-nav,.nav-menu");
 if(group&&[...group.querySelectorAll("a,button")].some(x=>isCat(x.textContent)))group.classList.add("dora-original-nav");
 [...nav.querySelectorAll("a,button")].filter(x=>x!==toggle&&isCat(x.textContent)).forEach(x=>x.classList.add("dora-original-link"));
 const seen=new Set();const labels=original().map(x=>x.textContent.trim().replace(/^[♡♥]\s*/,"")).filter(x=>{const key=n(x);if(seen.has(key))return false;seen.add(key);return true;});
 content.replaceChildren();
 const hint=document.createElement("p");hint.className="dora-side-label";hint.textContent="KOLEKSİYONU KEŞFEDİN";content.appendChild(hint);
 content.appendChild(item("Tüm Ürünler",labels.find(isAll)||"Hepsi"));
 const groups=labels.filter(x=>!isAll(x)&&!n(x).includes("favori"));
 const bags=groups.filter(x=>n(x).includes("çanta"));
 if(bags.length>1){const parent=document.createElement("button");parent.type="button";parent.className="dora-side-item";parent.setAttribute("aria-expanded","false");parent.innerHTML="<span>Çanta</span><span aria-hidden='true'>›</span>";
 const sub=document.createElement("div");sub.className="dora-side-submenu";sub.hidden=true;bags.forEach(x=>sub.appendChild(item(x)));parent.addEventListener("click",()=>{sub.hidden=!sub.hidden;parent.setAttribute("aria-expanded",String(!sub.hidden));});content.append(parent,sub);
 }else bags.forEach(x=>content.appendChild(item(x)));
 groups.filter(x=>!n(x).includes("çanta")).forEach(x=>content.appendChild(item(x)));
 if(labels.some(x=>n(x).includes("favori"))||typeof window.showFavorites==="function")content.appendChild(item("♡ Favoriler",labels.find(x=>n(x).includes("favori"))||"Favoriler"));
}
build();
const filters=document.querySelector("#filters");
if(filters){let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;build();});}).observe(filters,{childList:true});}
})();