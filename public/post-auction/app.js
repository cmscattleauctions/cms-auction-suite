/* ==========================================================
   CMS Post-Auction Portal + Pre-Auction Listings — app.js
   ========================================================== */

console.log("CMS Auction app.js loaded ✅");

const CONFIG = {
  PIN: "0623",

  // POST-AUCTION COLS
  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",

    breed: "Breed",
    type: "Type",
    year: "Year",

    lotNumber: "Lot Number",
    lotNumber2: "Lot Number #2",
    lotSeq: "Lot Sequence",
    head: "Head Count",
    loads: "Load Count",
    description: "Description",
    secondDescription: "Second Description",
    sex: "Sex",
    baseWeight: "Base Weight",
    delivery: "Delivery",
    location: "Location",
    shrink: "Shrink",
    slide: "Slide",
    price: "Calculated High Bid",
    downMoney: "Down Money Due",

    cmsInternalNotes: "CMS Internal Notes",
    cmsExternalNotes: "CMS External Notes",
  },

  // PRE-AUCTION COLS
  PRE_COLS: {
    rep: "Rep",
    consignor: "Consignor",
    lotNumber: "Lot Number",
    option: "Option",
    loads: "# of loads",
    head: "Head",
    breed: "Breed",
    sex: "Sex",
    baseWeight: "Weight",
    delivery: "Delivery",
    location: "Location",
    shrink: "Shrink",
    slide: "Slide",
    description: "Description",
    secondDescription: "Description 2",
    type: "Type",
  },

  CONTRACT_COL_CANDIDATES: [
    "Contract #",
    "Contract",
    "Contract Number",
    "Contract No",
    "Contract No."
  ],

  // Header right block
  HEADER_RIGHT_TITLE: "CMS Livestock Auction",
  HEADER_ADDRESS_LINES: [
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ],

  CONTRACT_TERMS: {
    buyer: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  Buyer hereby grants a purchase money security interest in the above-described cattle to CMS Orita Calf Auctions, LLC to secure full payment and collection of the purchase price. 
Buyer does hereby agree to a down payment of $30.00 Per head ({{Down Money Due}} of Down Money Due) if delivery date is more than 30 days past the auction date as good faith money to be applied at the time of delivery.
Buyer does hereby agree to payment by wire transfer the day following delivery of the cattle or by overnight carrier at Buyer's expense. Payments if sent overnight shall be sent to: 
CMS Livestock Auction 
6900 I-40 West, Suite 135 
Amarillo, TX 79106. 
The CMS Livestock Auction Video Auction Terms of Service Agreement as stated in auction registration and participation are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Video Auction Terms of Service Agreement arises, the CMS Livestock Auction Video Auction Terms of Service Agreement  shall take priority.`,

    seller: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once the cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller's knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  
The CMS Livestock Auction Seller's Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Seller's Terms of Service Agreement arises, the CMS Livestock Auction Seller's Terms of Service Agreement shall take priority.`
  },

  PDF: {
    pageSize: { width: 792, height: 612 },
    margin: 26,
    bottomLimit: 9,
    topBarH: 8,

    headerHFirst: 98,
    headerHOther: 62,

    buyerNameSize: 14.4,
    otherNameSize: 12.6,
    title: 12.0,

    lotTitle: 10.4,
    lotBreed: 9.4,
    gridLabel: 7.7,
    gridValue: 8.6,
    notes: 7.8,

    gridLineH: 10.2,
    notesLineH: 10.0,

    lotGap: 11,

    padX: 8,
    cellPadX: 5,
    cellPadY: 4,

    footerLineH: 10.6,
    footerMinH: 92,

    borderW: 1.0,
    innerW: 0.8,
  },

  COLORS: {
    cmsBlue: "#336699",
    consignorColor: "#818589",
    repBar: "#6F8FAF",
    textWhite: [1,1,1],
    highlightBg: [0.95, 0.95, 0.95], // Light gray for highlighting
  },

  REP_CONSIGNOR_PALETTE: [
    "#202E4A",
    "#336699",
    "#3FA796",
    "#6F8FAF",
    "#C9A66B",
  ],
};

/* ---------------- DOM ---------------- */
function mustGet(id){
  const el = document.getElementById(id);
  if(!el) throw new Error(`Missing element in HTML: #${id}`);
  return el;
}

let pageAuth, pageBuilder, pageResults;
let pinInput, pinSubmit, authError;
let auctionName, auctionDate, auctionDatePicker, auctionLabel;
let dropZone, fileInput, fileMeta;
let chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts, chkBuyerContractsGrouped, chkConsignorContractsGrouped;
let chkPreConsignor, chkPreRep, chkPreConsignorCondensed, chkPreRepCondensed;
let chkBuyerCondensed, chkConsignorCondensed, chkRepCondensed;
let chkShowCmsNotes, chkShowConsignorCmsNotes, chkShowRepCondensedCmsNotes, chkShowConsignorCondensedCmsNotes;
let chkShowPreConsignorCmsNotes, chkShowPreConsignorCondensedCmsNotes, chkShowPreRepCmsNotes, chkShowPreRepCondensedCmsNotes;
let chkSalesByConsignor, chkSalesByBuyer, chkSalesByRep, chkCompleteBuyer, chkCompleteConsignor, chkCompleteRep, chkAuctionRecap;
let buildBtn, builderError;

let csvPreview, csvPreviewContent;

let listBuyerReports, listLotByLot, listConsignorReports, listRepReports;
let listBuyerContracts, listSellerContracts, listBuyerContractsGrouped, listConsignorContractsGrouped;
let listPreConsignorReports, listPreRepReports;
let listSalesByConsignor, listSalesByBuyer, listSalesByRep;
let listCompleteBuyer, listCompleteConsignor, listCompleteRep, listAuctionRecap;

let zipBuyerReports, zipLotByLot, zipConsignorReports, zipRepReports, zipAll;
let zipBuyerContracts, zipSellerContracts, zipBuyerContractsGrouped, zipConsignorContractsGrouped;
let zipPreConsignorReports, zipPreRepReports;
let zipSalesByConsignor, zipSalesByBuyer, zipSalesByRep, zipSpecialReports;

let togBuyerReports, togLotByLot, togBuyerContracts, togSellerContracts, togBuyerContractsGrouped, togConsignorContractsGrouped, togConsignorReports, togRepReports;
let togPreConsignorReports, togPreRepReports;
let togSalesByConsignor, togSalesByBuyer, togSalesByRep;
let togCompleteBuyer, togCompleteConsignor, togCompleteRep, togAuctionRecap;

let backBtn, exitBtn, resultsMeta;

function bindDom(){
  pageAuth = mustGet("pageAuth");
  pageBuilder = mustGet("pageBuilder");
  pageResults = mustGet("pageResults");

  pinInput = mustGet("pinInput");
  pinSubmit = mustGet("pinSubmit");
  authError = mustGet("authError");

  auctionName = mustGet("auctionName");
  auctionDate = mustGet("auctionDate");
  auctionDatePicker = mustGet("auctionDatePicker");
  auctionLabel = mustGet("auctionLabel");

  dropZone = mustGet("dropZone");
  fileInput = mustGet("fileInput");
  fileMeta = mustGet("fileMeta");

  chkBuyer = mustGet("chkBuyer");
  chkConsignor = mustGet("chkConsignor");
  chkRep = mustGet("chkRep");
  chkLotByLot = mustGet("chkLotByLot");
  chkBuyerContracts = mustGet("chkBuyerContracts");
  chkSellerContracts = mustGet("chkSellerContracts");
  chkBuyerContractsGrouped = mustGet("chkBuyerContractsGrouped");
  chkConsignorContractsGrouped = mustGet("chkConsignorContractsGrouped");

  chkPreConsignor = mustGet("chkPreConsignor");
  chkPreRep = mustGet("chkPreRep");
  chkPreConsignorCondensed = mustGet("chkPreConsignorCondensed");
  chkPreRepCondensed = mustGet("chkPreRepCondensed");

  chkShowCmsNotes = mustGet("chkShowCmsNotes");
  chkShowConsignorCmsNotes = mustGet("chkShowConsignorCmsNotes");
  chkShowRepCondensedCmsNotes = mustGet("chkShowRepCondensedCmsNotes");
  chkShowConsignorCondensedCmsNotes = mustGet("chkShowConsignorCondensedCmsNotes");
  chkShowPreConsignorCmsNotes = mustGet("chkShowPreConsignorCmsNotes");
  chkShowPreConsignorCondensedCmsNotes = mustGet("chkShowPreConsignorCondensedCmsNotes");
  chkShowPreRepCmsNotes = mustGet("chkShowPreRepCmsNotes");
  chkShowPreRepCondensedCmsNotes = mustGet("chkShowPreRepCondensedCmsNotes");
  chkBuyerCondensed = mustGet("chkBuyerCondensed");
  chkConsignorCondensed = mustGet("chkConsignorCondensed");
  chkRepCondensed = mustGet("chkRepCondensed");

  chkSalesByConsignor = mustGet("chkSalesByConsignor");
  chkSalesByBuyer = mustGet("chkSalesByBuyer");
  chkSalesByRep = mustGet("chkSalesByRep");
  chkCompleteBuyer = mustGet("chkCompleteBuyer");
  chkCompleteConsignor = mustGet("chkCompleteConsignor");
  chkCompleteRep = mustGet("chkCompleteRep");
  chkAuctionRecap = mustGet("chkAuctionRecap");

  buildBtn = mustGet("buildBtn");
  builderError = mustGet("builderError");

  csvPreview = mustGet("csvPreview");
  csvPreviewContent = mustGet("csvPreviewContent");

  listBuyerReports = mustGet("listBuyerReports");
  listLotByLot = mustGet("listLotByLot");
  listConsignorReports = mustGet("listConsignorReports");
  listRepReports = mustGet("listRepReports");
  listBuyerContracts = mustGet("listBuyerContracts");
  listSellerContracts = mustGet("listSellerContracts");
  listBuyerContractsGrouped = mustGet("listBuyerContractsGrouped");
  listConsignorContractsGrouped = mustGet("listConsignorContractsGrouped");

  listPreConsignorReports = mustGet("listPreConsignorReports");
  listPreRepReports = mustGet("listPreRepReports");

  listSalesByConsignor = mustGet("listSalesByConsignor");
  listSalesByBuyer = mustGet("listSalesByBuyer");
  listSalesByRep = mustGet("listSalesByRep");
  listCompleteBuyer = mustGet("listCompleteBuyer");
  listCompleteConsignor = mustGet("listCompleteConsignor");
  listCompleteRep = mustGet("listCompleteRep");
  listAuctionRecap = mustGet("listAuctionRecap");

  zipBuyerReports = mustGet("zipBuyerReports");
  zipLotByLot = mustGet("zipLotByLot");
  zipBuyerContracts = mustGet("zipBuyerContracts");
  zipSellerContracts = mustGet("zipSellerContracts");
  zipBuyerContractsGrouped = mustGet("zipBuyerContractsGrouped");
  zipConsignorContractsGrouped = mustGet("zipConsignorContractsGrouped");
  zipConsignorReports = mustGet("zipConsignorReports");
  zipRepReports = mustGet("zipRepReports");

  zipPreConsignorReports = mustGet("zipPreConsignorReports");
  zipPreRepReports = mustGet("zipPreRepReports");
  
  zipSalesByConsignor = mustGet("zipSalesByConsignor");
  zipSalesByBuyer = mustGet("zipSalesByBuyer");
  zipSalesByRep = mustGet("zipSalesByRep");
  zipSpecialReports = mustGet("zipSpecialReports");
  
  zipAll = mustGet("zipAll");

  togBuyerReports = mustGet("togBuyerReports");
  togLotByLot = mustGet("togLotByLot");
  togBuyerContracts = mustGet("togBuyerContracts");
  togSellerContracts = mustGet("togSellerContracts");
  togBuyerContractsGrouped = mustGet("togBuyerContractsGrouped");
  togConsignorContractsGrouped = mustGet("togConsignorContractsGrouped");
  togConsignorReports = mustGet("togConsignorReports");
  togRepReports = mustGet("togRepReports");

  togPreConsignorReports = mustGet("togPreConsignorReports");
  togPreRepReports = mustGet("togPreRepReports");

  togSalesByConsignor = mustGet("togSalesByConsignor");
  togSalesByBuyer = mustGet("togSalesByBuyer");
  togSalesByRep = mustGet("togSalesByRep");
  togCompleteBuyer = mustGet("togCompleteBuyer");
  togCompleteConsignor = mustGet("togCompleteConsignor");
  togCompleteRep = mustGet("togCompleteRep");
  togAuctionRecap = mustGet("togAuctionRecap");

  backBtn = mustGet("backBtn");
  exitBtn = mustGet("exitBtn");
  resultsMeta = mustGet("resultsMeta");
}

/* ---------------- STATE ---------------- */
let csvRows = [];
let contractColName = null;

let blobUrls = [];
let generated = {
  buyerReports: [],
  lotByLot: [],
  buyerContracts: [],
  sellerContracts: [],
  buyerContractsGrouped: [],
  consignorContractsGrouped: [],
  consignorReports: [],
  repReports: [],
  preConsignorReports: [],
  preRepReports: [],
};

/* ---------------- UTIL ---------------- */
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function goto(page){
  [pageAuth, pageBuilder, pageResults].forEach(hide);
  show(page);
}

function setError(el, msg){
  if(!msg){ hide(el); el.textContent=""; return; }
  el.textContent = msg;
  show(el);
}

function safeStr(v){
  if(v === null || v === undefined) return "";
  return String(v)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    // Remove other common problem characters
    .replace(/[◆◇■□●○▪▫★☆♦♥♠♣]/g, "*")  // Shapes/symbols → asterisk
    .replace(/[•]/g, "-")  // Bullet → dash
    .replace(/[™®©]/g, "")  // Trademark symbols → remove
    .replace(/[¢£¥€]/g, "$")  // Currency symbols → dollar
    .replace(/[°]/g, " deg")  // Degree symbol
    .replace(/[×]/g, "x")  // Multiplication sign
    .replace(/[÷]/g, "/")  // Division sign
    // AGGRESSIVE: Remove ALL non-ASCII characters (only keep 32-126)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(v){
  const s = safeStr(v);
  if(!s) return 0;
  const cleaned = s.replace(/\$/g,"").replace(/,/g,"").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n){
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + fmt.format(Number.isFinite(n) ? n : 0);
}

function formatNumber(n){
  const fmt = new Intl.NumberFormat("en-US");
  return fmt.format(Number.isFinite(n) ? n : 0);
}

function priceDisplay(v){
  const n = toNumber(v);
  return (n === 0) ? "PO" : formatMoney(n);
}

function downMoneyDisplay(v){
  const n = toNumber(v);
  return formatMoney(n);
}

function fileSafeName(name){
  return safeStr(name)
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function groupBy(rows, key){
  const map = new Map();
  for(const r of rows){
    const k = safeStr(r[key]);
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function requiredColsPresent(rows){
  const required = Object.values(CONFIG.COLS).filter(c => ![
    CONFIG.COLS.breed,
    CONFIG.COLS.type,
    CONFIG.COLS.year,
    CONFIG.COLS.cmsInternalNotes
  ].includes(c));
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

function detectContractColumn(rows){
  const row0 = rows[0] || {};
  const keys = Object.keys(row0);

  for(const cand of CONFIG.CONTRACT_COL_CANDIDATES){
    if(keys.includes(cand)) return cand;
  }
  const lower = keys.map(k => k.toLowerCase());
  for(const cand of CONFIG.CONTRACT_COL_CANDIDATES){
    const idx = lower.indexOf(cand.toLowerCase());
    if(idx >= 0) return keys[idx];
  }
  return null;
}

// Helper to check for Representative or Rep column
function getRepColumn(row){
  if(row[CONFIG.COLS.rep]) return row[CONFIG.COLS.rep];
  if(row[CONFIG.PRE_COLS.rep]) return row[CONFIG.PRE_COLS.rep];
  return "";
}

function getContract(row){
  if(!contractColName) return "";
  return safeStr(row[contractColName]);
}

function sortLots(a,b){
  const sa = toNumber(a[CONFIG.COLS.lotSeq]);
  const sb = toNumber(b[CONFIG.COLS.lotSeq]);
  if(sa !== sb) return sa - sb;
  return getContract(a).localeCompare(getContract(b), undefined, {numeric:true});
}

// Pre-auction lot number logic
function getPreLotNumber(row){
  const lotNum = safeStr(row[CONFIG.PRE_COLS.lotNumber]);
  const option = safeStr(row[CONFIG.PRE_COLS.option]);
  
  // If lot number exists, use it (may already have option letter like "123A")
  if(lotNum) return lotNum;
  
  // If no lot number but option exists, show "A-TBD", "B-TBD", etc.
  if(option) return `${option}-TBD`;
  
  // If neither exists, just show "TBD"
  return "TBD";
}

function assertLibsLoaded(){
  if(!window.PDFLib) throw new Error("pdf-lib not loaded.");
  if(!window.Papa) throw new Error("PapaParse not loaded.");
  if(!window.JSZip) throw new Error("JSZip not loaded.");
}

function hexToRgb01(hex){
  const h = hex.replace("#","").trim();
  const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}

function hashIndex(str, mod){
  let h = 0;
  const s = safeStr(str);
  for(let i=0;i<s.length;i++){
    h = ((h<<5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

function wrapLines(fontObj, text, size, maxW){
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  if(words.length === 0) return [""];
  const lines = [];
  let line = words[0];
  for(let i=1;i<words.length;i++){
    const test = line + " " + words[i];
    if(fontObj.widthOfTextAtSize(test, size) <= maxW){
      line = test;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/* ---------------- TYPE COLOR ---------------- */
function pickTypeColorHex(row, isPre = false){
  const typeKey = isPre ? CONFIG.PRE_COLS.type : CONFIG.COLS.type;
  const breedKey = isPre ? CONFIG.PRE_COLS.breed : CONFIG.COLS.breed;
  const descKey = isPre ? CONFIG.PRE_COLS.description : CONFIG.COLS.description;

  const type = safeStr(row[typeKey]).toLowerCase();
  const desc = safeStr(row[descKey]).toLowerCase();
  const breed = safeStr(row[breedKey]).toLowerCase();
  const hay = `${type} ${breed} ${desc}`.trim();

  const hasChar = hay.includes("charolais");
  const hasBod = hay.includes("beef on dairy") || hay.includes("beefx dairy") || hay.includes("beef x dairy");

  if(hasChar && hasBod) return "#C9A66B";
  if(hasChar) return "#C9A66B";
  if(hasBod || hay.includes("blackx") || hay.includes("black x")) return "#202E4A";
  if(hay.includes("native")) return "#3FA796";
  if(hay.includes("holstein")) return "#6F8FAF";

  return CONFIG.COLORS.cmsBlue;
}

/* ---------------- DROPZONE ---------------- */
function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
  zoneEl.addEventListener("dragover", (e)=>{ e.preventDefault(); zoneEl.classList.add("dragover"); });
  zoneEl.addEventListener("dragleave", ()=> zoneEl.classList.remove("dragover"));
  zoneEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    zoneEl.classList.remove("dragover");
    const f = e.dataTransfer.files?.[0];
    if(f){ inputEl.value = ""; onFile(f); }
  });

  inputEl.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) onFile(f);
  });

  if(metaEl){
    metaEl.textContent = "";
    metaEl.classList.add("hidden");
  }
}

function setBuildEnabled(){
  const anyChecked =
    chkBuyer.checked ||
    chkConsignor.checked ||
    chkRep.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked ||
    chkPreConsignor.checked ||
    chkPreRep.checked;

  buildBtn.disabled = !(csvRows.length > 0 && anyChecked);
  
  // Update CSV preview
  updateCsvPreview();
}

function updateCsvPreview(){
  if(csvRows.length === 0 || !anyChecked()){
    hide(csvPreview);
    return;
  }

  const counts = {
    buyerReports: 0,
    lotByLot: 0,
    buyerContracts: 0,
    sellerContracts: 0,
    consignorReports: 0,
    repReports: 0,
    preConsignorReports: 0,
    preRepReports: 0,
    salesByConsignor: 0,
    salesByBuyer: 0,
    salesByRep: 0,
    completeBuyer: 0,
    completeConsignor: 0,
    completeRep: 0,
    auctionRecap: 0
  };

  // Count unique entities
  if(chkBuyer.checked){
    const buyers = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
    counts.buyerReports = buyers.size;
  }
  
  if(chkBuyerCondensed.checked){
    const buyers = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
    counts.buyerReports += buyers.size; // Add condensed count
  }

  if(chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked){
    const contracts = csvRows.filter(r => getContract(r)).length;
    if(chkLotByLot.checked) counts.lotByLot = contracts;
    if(chkBuyerContracts.checked) counts.buyerContracts = contracts;
    if(chkSellerContracts.checked) counts.sellerContracts = contracts;
    if(chkBuyerContractsGrouped.checked){
      const buyers = new Set(csvRows.filter(r => getContract(r)).map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
      counts.buyerContractsGrouped = buyers.size;
    }
    if(chkConsignorContractsGrouped.checked){
      const consignors = new Set(csvRows.filter(r => getContract(r)).map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
      counts.consignorContractsGrouped = consignors.size;
    }
  }

  if(chkConsignor.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
    counts.consignorReports = consignors.size;
  }
  
  if(chkConsignorCondensed.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
    counts.consignorReports += consignors.size; // Add condensed count
  }

  if(chkRep.checked){
    const reps = new Set(csvRows.map(r => getRepColumn(r)).filter(Boolean));
    counts.repReports = reps.size;
  }
  
  if(chkRepCondensed.checked){
    const reps = new Set(csvRows.map(r => getRepColumn(r)).filter(Boolean));
    counts.repReports += reps.size; // Add condensed count
  }

  if(chkPreConsignor.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.consignor])).filter(Boolean));
    counts.preConsignorReports = consignors.size;
  }
  
  if(chkPreConsignorCondensed.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.consignor])).filter(Boolean));
    counts.preConsignorReports += consignors.size; // Add condensed count
  }

  if(chkPreRep.checked){
    const reps = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.rep])).filter(Boolean));
    counts.preRepReports = reps.size;
  }
  
  if(chkPreRepCondensed.checked){
    const reps = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.rep])).filter(Boolean));
    counts.preRepReports += reps.size; // Add condensed count
  }

  // Special Reports
  if(chkSalesByConsignor.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
    counts.salesByConsignor = consignors.size;
  }

  if(chkSalesByBuyer.checked){
    const buyers = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
    counts.salesByBuyer = buyers.size;
  }

  if(chkSalesByRep.checked){
    const reps = new Set(csvRows.map(r => getRepColumn(r)).filter(Boolean));
    counts.salesByRep = reps.size;
  }

  if(chkCompleteBuyer.checked) counts.completeBuyer = 1;
  if(chkCompleteConsignor.checked) counts.completeConsignor = 1;
  if(chkCompleteRep.checked) counts.completeRep = 1;
  if(chkAuctionRecap.checked) counts.auctionRecap = 1;

  // Build preview HTML
  const lines = [];
  lines.push(`✓ CSV loaded: <b>${csvRows.length} rows</b>`);
  lines.push(`✓ Will generate:`);
  
  const items = [];
  if(counts.buyerReports) items.push(`${counts.buyerReports} Buyer Report${counts.buyerReports > 1 ? 's' : ''}`);
  if(counts.lotByLot) items.push(`${counts.lotByLot} Contract Detail${counts.lotByLot > 1 ? 's' : ''}`);
  if(counts.buyerContracts) items.push(`${counts.buyerContracts} Buyer Contract${counts.buyerContracts > 1 ? 's' : ''}`);
  if(counts.sellerContracts) items.push(`${counts.sellerContracts} Seller Contract${counts.sellerContracts > 1 ? 's' : ''}`);
  if(counts.consignorReports) items.push(`${counts.consignorReports} Consignor Trade Confirmation${counts.consignorReports > 1 ? 's' : ''}`);
  if(counts.repReports) items.push(`${counts.repReports} Rep Trade Confirmation${counts.repReports > 1 ? 's' : ''}`);
  if(counts.preConsignorReports) items.push(`${counts.preConsignorReports} Consignor Listing Confirmation${counts.preConsignorReports > 1 ? 's' : ''}`);
  if(counts.preRepReports) items.push(`${counts.preRepReports} Rep Listing Confirmation${counts.preRepReports > 1 ? 's' : ''}`);
  
  // Special Reports
  if(counts.salesByConsignor) items.push(`${counts.salesByConsignor} Sales Summary by Consignor`);
  if(counts.salesByBuyer) items.push(`${counts.salesByBuyer} Sales Summary by Buyer`);
  if(counts.salesByRep) items.push(`${counts.salesByRep} Sales Summary by Rep`);
  if(counts.completeBuyer) items.push(`1 Complete Buyer Summary`);
  if(counts.completeConsignor) items.push(`1 Complete Consignor Summary`);
  if(counts.auctionRecap) items.push(`1 Auction Recap Summary`);

  items.forEach(item => lines.push(`&nbsp;&nbsp;• ${item}`));

  csvPreviewContent.innerHTML = lines.join('<br>');
  show(csvPreview);
}

function anyChecked(){
  return chkBuyer.checked ||
    chkBuyerCondensed.checked ||
    chkConsignor.checked ||
    chkConsignorCondensed.checked ||
    chkRep.checked ||
    chkRepCondensed.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked ||
    chkBuyerContractsGrouped.checked ||
    chkConsignorContractsGrouped.checked ||
    chkPreConsignor.checked ||
    chkPreConsignorCondensed.checked ||
    chkPreRep.checked ||
    chkPreRepCondensed.checked ||
    chkSalesByConsignor.checked ||
    chkSalesByBuyer.checked ||
    chkSalesByRep.checked ||
    chkCompleteBuyer.checked ||
    chkCompleteConsignor.checked ||
    chkCompleteRep.checked ||
    chkAuctionRecap.checked;
}

/* ---------------- SECTION SELECT/DESELECT ---------------- */

/* ---------------- RESULTS DROPDOWNS ---------------- */
function wireResultsDropdowns(){
  const pairs = [
    [togBuyerReports, listBuyerReports],
    [togLotByLot, listLotByLot],
    [togBuyerContracts, listBuyerContracts],
    [togSellerContracts, listSellerContracts],
    [togBuyerContractsGrouped, listBuyerContractsGrouped],
    [togConsignorContractsGrouped, listConsignorContractsGrouped],
    [togConsignorReports, listConsignorReports],
    [togRepReports, listRepReports],
    [togPreConsignorReports, listPreConsignorReports],
    [togPreRepReports, listPreRepReports],
    [togSalesByConsignor, listSalesByConsignor],
    [togSalesByBuyer, listSalesByBuyer],
    [togSalesByRep, listSalesByRep],
    [togCompleteBuyer, listCompleteBuyer],
    [togCompleteConsignor, listCompleteConsignor],
    [togCompleteRep, listCompleteRep],
    [togAuctionRecap, listAuctionRecap],
  ];

  for(const [btn, list] of pairs){
    const sync = () => {
      const collapsed = list.classList.contains("collapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };
    btn.addEventListener("click", ()=>{
      list.classList.toggle("collapsed");
      sync();
    });
    sync();
  }
}

/* ---------------- CSV ---------------- */
function handleCsvFile(file){
  setError(builderError, "");
  if(!file) return;

  fileMeta.textContent = `CSV loaded: ${file.name || "uploaded.csv"}`;
  show(fileMeta);

  try{ assertLibsLoaded(); }
  catch(err){
    setError(builderError, err.message);
    csvRows = [];
    setBuildEnabled();
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      csvRows = (results.data || []).filter(r => Object.values(r).some(v => safeStr(v) !== ""));
      if(csvRows.length === 0){
        setError(builderError, "CSV parsed, but it contains no rows.");
        setBuildEnabled();
        return;
      }

      csvRows = csvRows.map(row => {
        const cleaned = {};
        for(const k of Object.keys(row)) cleaned[k] = safeStr(row[k]);
        return cleaned;
      });

      // Don't require specific columns - just load it
      contractColName = detectContractColumn(csvRows);
      
      setBuildEnabled();
    },
    error: () => {
      setError(builderError, "Could not parse CSV. Make sure it's a valid CSV export.");
      csvRows = [];
      setBuildEnabled();
    }
  });
}

/* ---------------- AUTH ---------------- */
function wireAuth(){
  pinSubmit.addEventListener("click", () => {
    const entered = safeStr(pinInput.value);
    if(entered === CONFIG.PIN){
      setError(authError, "");
      pinInput.value = "";
      goto(pageBuilder);
    } else {
      setError(authError, "Incorrect PIN.");
    }
  });

  pinInput.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") pinSubmit.click();
  });
}


/* =========================================================================
   PDF: PRE-AUCTION LISTING CONFIRMATIONS (Consignor / Rep)
   PRICE COLUMN REMOVED
   ========================================================================= */
async function buildPreAuctionListingPdf({entityName, rows, mode, showCmsNotes=false}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);

  const topBarHex = mode === "consignor" ? CONFIG.COLORS.consignorColor : CONFIG.COLORS.repBar;
  const topBarColor = rgb(...hexToRgb01(topBarHex));

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  // Removed price column from pre-auction
  const colDefs = [
    { key: "loads", label: "Loads",   w: 50 },
    { key: "head",  label: "Head",    w: 50 },
    { key: "sex",   label: "Sex",     w: 80 },
    { key: "bw",    label: "Base Wt", w: 75 },
    { key: "del",   label: "Delivery",w: 150 },
    { key: "loc",   label: "Location",w: 120 },
    { key: "shr",   label: "Shrink",  w: 55 },
    { key: "sld",   label: "Slide",   w: 160 },
  ];
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const leftLabel = mode === "consignor" ? "Consignor" : "Rep";
  const docTitle = "Listing Confirmations";
  const nameSize = CONFIG.PDF.otherNameSize;

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
    page.drawRectangle({ x: 0, y: H - CONFIG.PDF.topBarH, width: W, height: CONFIG.PDF.topBarH, color: topBarColor });
  }

  function drawRightHeaderBlockAligned(rx, topY){
    const title = CONFIG.HEADER_RIGHT_TITLE;
    const titleSize = 12.6;
    const addrSize = 9.2;
    const lh = 11;

    const tw = fontBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, { x: rx - tw, y: topY, size: titleSize, font: fontBold, color: BLACK });

    let yy = topY - (lh + 2);
    for(const ln of CONFIG.HEADER_ADDRESS_LINES){
      const w = font.widthOfTextAtSize(ln, addrSize);
      page.drawText(ln, { x: rx - w, y: yy, size: addrSize, font, color: BLACK });
      yy -= lh;
    }
  }

  function drawHeader(){
    drawTopBar();

    const headerH = (pageIndex === 0) ? CONFIG.PDF.headerHFirst : CONFIG.PDF.headerHOther;
    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 20)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;
    const rx = M + contentW;

    page.drawText(`${leftLabel}: ${safeStr(entityName)}`, { x: lx, y: topY, size: nameSize, font: fontBold, color: BLACK });

    drawRightHeaderBlockAligned(rx, topY);

    if(pageIndex === 0){
      page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 18, size: 10.0, font, color: BLACK });
      if(aDate){
        page.drawText(safeStr(aDate), { x: lx, y: topY - 30, size: 10.0, font, color: BLACK });
      }
      page.drawText(docTitle, { x: lx, y: topY - 54, size: CONFIG.PDF.title, font: fontBold, color: BLACK });
    }

    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

  function computeGridWrapped(record){
    const values = {
      loads: safeStr(record[CONFIG.PRE_COLS.loads]) || "0",
      head:  safeStr(record[CONFIG.PRE_COLS.head])  || "0",
      sex:   safeStr(record[CONFIG.PRE_COLS.sex]),
      bw:    safeStr(record[CONFIG.PRE_COLS.baseWeight]),
      del:   safeStr(record[CONFIG.PRE_COLS.delivery]),
      loc:   safeStr(record[CONFIG.PRE_COLS.location]),
      shr:   safeStr(record[CONFIG.PRE_COLS.shrink]),
      sld:   safeStr(record[CONFIG.PRE_COLS.slide]),
    };

    const wrapped = {};
    let maxLines = 1;
    for(const c of colDefs){
      const cellW = c.w - 2*CONFIG.PDF.cellPadX;
      const lines = wrapLines(font, values[c.key], CONFIG.PDF.gridValue, cellW);
      wrapped[c.key] = lines;
      maxLines = Math.max(maxLines, lines.length);
    }
    return { wrapped, maxLines };
  }

  function computeNotesLines(record){
    const desc = safeStr(record[CONFIG.PRE_COLS.description]);
    const desc2 = safeStr(record[CONFIG.PRE_COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const notesLine = safeStr(`Notes: ${notesText}`);
    const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
    const regularLines = wrapLines(font, notesLine, CONFIG.PDF.notes, maxW);
    
    // For rep mode, add CMS External Notes below (bold) - ONLY if showCmsNotes is enabled
    // Pre-auction CSVs may not have this column, so check if it exists
    const cmsNotes = (mode === "rep" && showCmsNotes && record[CONFIG.COLS.cmsExternalNotes]) 
      ? safeStr(record[CONFIG.COLS.cmsExternalNotes]) 
      : "";
    
    return { regularLines, cmsNotes };
  }

  function lotBlockHeight(record){
    const row1H = 32;
    const labelH = 14;

    const { maxLines } = computeGridWrapped(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const { regularLines, cmsNotes } = computeNotesLines(record);
    let notesLineCount = regularLines.length;
    
    // Add lines for CMS Internal Notes if present (rep mode)
    if(cmsNotes){
      const cmsText = `CMS Internal Notes: ${cmsNotes}`;
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, cmsText, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;

    return row1H + gridH + notesH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit) newPage();
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : rgb(1,1,1);
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;

    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H,
      width: contentW, height: row1H,
      color: fill,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawText(textLeft, { x: M + CONFIG.PDF.padX, y: y - 14, size: CONFIG.PDF.lotTitle, font: fontBold, color: textColor });
    return row1H;
  }

  function drawCenteredLines(lines, xCenter, yTop, lineH, size){
    let yy = yTop;
    for(const ln of lines){
      const w = font.widthOfTextAtSize(ln || "", size);
      page.drawText(ln, { x: xCenter - w/2, y: yy, size, font, color: BLACK });
      yy -= lineH;
    }
  }

  function drawLotBlock(r){
    const lotNum = getPreLotNumber(r);
    const consignor = safeStr(r[CONFIG.PRE_COLS.consignor]);
    const breed = safeStr(r[CONFIG.PRE_COLS.breed]) || safeStr(r[CONFIG.PRE_COLS.description]);

    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r, true);
    }

    const topLine = `Lot # ${lotNum} - ${consignor}`;
    const row1H = drawLotHeaderRow({ textLeft: topLine, fillHex: headerFillHex });

    const breedColor = headerFillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;
    page.drawText(safeStr(breed), { x: M + CONFIG.PDF.padX, y: y - 27, size: CONFIG.PDF.lotBreed, font, color: breedColor });
    y -= row1H;

    const labelH = 14;
    const { wrapped, maxLines } = computeGridWrapped(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({ x:M, y:y-gridH, width:gridW, height:gridH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
    page.drawLine({ start:{x:M, y:y-labelH}, end:{x:M+gridW, y:y-labelH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });

    let cx = M;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];
      if(i !== 0){
        page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });
      }

      const cellCenter = cx + c.w/2;
      const lw = fontBold.widthOfTextAtSize(c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, { x: cellCenter - lw/2, y: y - 11, size: CONFIG.PDF.gridLabel, font: fontBold, color: BLACK });

      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue);

      cx += c.w;
    }

    y -= gridH;

    const { regularLines, cmsNotes } = computeNotesLines(r);
    let notesLineCount = regularLines.length;
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;
    page.drawRectangle({ x:M, y:y-notesH, width:contentW, height:notesH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    let ny = y - 12;
    
    // Draw regular notes
    for(const ln of regularLines){
      page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font, color: BLACK });
      ny -= CONFIG.PDF.notesLineH;
    }
    
    // Draw CMS Internal Notes (bold) for rep mode
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      for(const ln of cmsLines){
        page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font: fontBold, color: BLACK });
        ny -= CONFIG.PDF.notesLineH;
      }
    }
    
    y -= notesH;

    y -= CONFIG.PDF.lotGap;
  }

  // Keep CSV order for pre-auction
  const sorted = [...rows];
  for(const r of sorted){
    ensureRoom(r);
    drawLotBlock(r);
  }

  return await pdfDoc.save();
}


/* =========================================================================
   PDF: POST-AUCTION GROUP + CONTRACT DETAILS (LANDSCAPE - unchanged)
   ========================================================================= */
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false, forceBuyerName=null, headerRightBig=null, showCmsNotes=false, lotByLotBannerColorHex=null}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.5,0.5,0.5);
  const FILL = rgb(0.98,0.98,0.98);

  const topBarHex =
    (singleLotMode && lotByLotBannerColorHex) ? lotByLotBannerColorHex :
    mode === "buyer" ? CONFIG.COLORS.cmsBlue :
    mode === "consignor" ? CONFIG.COLORS.consignorColor :
    CONFIG.COLORS.repBar;

  const topBarColor = rgb(...hexToRgb01(topBarHex));


  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  const colDefs = [
    { key: "loads", label: "Loads",   w: 45 },
    { key: "head",  label: "Head",    w: 45 },
    { key: "sex",   label: "Sex",     w: 80 },
    { key: "bw",    label: "Base Wt", w: 75 },
    { key: "del",   label: "Delivery",w: 150 },
    { key: "loc",   label: "Location",w: 110 },
    { key: "shr",   label: "Shrink",  w: 48 },
    { key: "sld",   label: "Slide",   w: 134 },
    { key: "price", label: "Price",   w: 53 },
  ];
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const leftLabel =
    mode === "buyer" ? "Buyer" : (mode === "consignor" ? "Consignor" : "Rep");

  const docTitle =
    (mode === "buyer")
      ? (singleLotMode ? "Contract Details" : "Buyer Recap and Down Money Invoice")
      : "Trade Confirmations";

  const nameSize = (mode === "buyer") ? CONFIG.PDF.buyerNameSize : CONFIG.PDF.otherNameSize;

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
    page.drawRectangle({ x: 0, y: H - CONFIG.PDF.topBarH, width: W, height: CONFIG.PDF.topBarH, color: topBarColor });
  }

  function drawRightHeaderBlockAligned(rx, topY){
    const title = CONFIG.HEADER_RIGHT_TITLE;
    const titleSize = 12.6;
    const addrSize = 9.2;
    const lh = 11;

    const tw = fontBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, { x: rx - tw, y: topY, size: titleSize, font: fontBold, color: BLACK });

    let yy = topY - (lh + 2);
    for(const ln of CONFIG.HEADER_ADDRESS_LINES){
      const w = font.widthOfTextAtSize(ln, addrSize);
      page.drawText(ln, { x: rx - w, y: yy, size: addrSize, font, color: BLACK });
      yy -= lh;
    }
  }

  function drawHeader(){
    drawTopBar();

    const headerH = (pageIndex === 0) ? CONFIG.PDF.headerHFirst : CONFIG.PDF.headerHOther;
    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 20)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;
    const rx = M + contentW;

    if(!singleLotMode){
      const leftName = forceBuyerName ? safeStr(forceBuyerName) : safeStr(entityName);
      page.drawText(`${leftLabel}: ${leftName}`, { x: lx, y: topY, size: nameSize, font: fontBold, color: BLACK });
    }

    const isContractDetailsFirstPage = (singleLotMode && pageIndex === 0 && !!headerRightBig);
    if(!isContractDetailsFirstPage){
      drawRightHeaderBlockAligned(rx, topY);
    }

    if(pageIndex === 0){
      if(singleLotMode){
        page.drawText(docTitle, { x: lx, y: topY - 20, size: 12.2, font: fontBold, color: BLACK });
        page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 38, size: 10.0, font, color: BLACK });
        if(aDate){
          page.drawText(safeStr(aDate), { x: lx, y: topY - 50, size: 10.0, font, color: BLACK });
        }

        if(headerRightBig){
          const DROP = 44;
          const t = safeStr(headerRightBig);
          const s = 17.5;
          const w = fontBold.widthOfTextAtSize(t, s);
          page.drawText(t, { x: rx - w, y: topY + 18 - DROP, size: s, font: fontBold, color: BLACK });
          drawRightHeaderBlockAligned(rx, topY - DROP);
        }
      } else {
        page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 18, size: 10.0, font, color: BLACK });
        if(aDate){
          page.drawText(safeStr(aDate), { x: lx, y: topY - 30, size: 10.0, font, color: BLACK });
        }
        page.drawText(docTitle, { x: lx, y: topY - 54, size: CONFIG.PDF.title, font: fontBold, color: BLACK });
      }
    }

    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

  let buyerDownMoneyTotal = 0;

  function computeGridWrapped(record){
    const values = {
      loads: safeStr(record[CONFIG.COLS.loads]) || "0",
      head:  safeStr(record[CONFIG.COLS.head])  || "0",
      sex:   safeStr(record[CONFIG.COLS.sex]),
      bw:    safeStr(record[CONFIG.COLS.baseWeight]),
      del:   safeStr(record[CONFIG.COLS.delivery]),
      loc:   safeStr(record[CONFIG.COLS.location]),
      shr:   safeStr(record[CONFIG.COLS.shrink]),
      sld:   safeStr(record[CONFIG.COLS.slide]),
      price: priceDisplay(record[CONFIG.COLS.price]),
    };

    const wrapped = {};
    let maxLines = 1;
    for(const c of colDefs){
      const cellW = c.w - 2*CONFIG.PDF.cellPadX;
      const lines = wrapLines(font, values[c.key], CONFIG.PDF.gridValue, cellW);
      wrapped[c.key] = lines;
      maxLines = Math.max(maxLines, lines.length);
    }
    return { wrapped, maxLines };
  }

  function computeNotesLines(record){
    const desc = safeStr(record[CONFIG.COLS.description]);
    const desc2 = safeStr(record[CONFIG.COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const notesLine = safeStr(`Notes: ${notesText}`);
    const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
    const regularLines = wrapLines(font, notesLine, CONFIG.PDF.notes, maxW);
    
    // For rep mode, add CMS External Notes below (bold) - ONLY if showCmsNotes is enabled
    const cmsNotes = (mode === "rep" && showCmsNotes) ? safeStr(record[CONFIG.COLS.cmsExternalNotes]) : "";
    
    return { regularLines, cmsNotes };
  }

  function drawSingleLotBuyerAndRepBlock(r){
    const buyer = safeStr(r[CONFIG.COLS.buyer]);
    const rep = getRepColumn(r);
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    let used = 0;

    // Buyer first
    if(buyer){
      page.drawText(`Buyer: ${buyer}`, { x: M, y: y - 12 - used, size: 12.2, font: fontBold, color: BLACK });
      used += 14;
    }
    
    // Rep second
    if(rep){
      page.drawText(`Rep: ${rep}`, { x: M, y: y - 12 - used, size: 10.6, font, color: BLACK });
      used += 14;
    }

    // Consignor in light grey box (moved below buyer/rep)
    if(consignor){
      used += 4; // Small gap before consignor box
      const consignorBoxH = 20;
      const LIGHT_GREY_BOX = rgb(0.93, 0.93, 0.93); // Light grey
      page.drawRectangle({
        x: M, y: y - 12 - used - consignorBoxH, width: contentW, height: consignorBoxH,
        color: LIGHT_GREY_BOX, borderWidth: 0.5, borderColor: GRAY
      });
      page.drawText(`Consignor: ${consignor}`, { x: M + 8, y: y - 12 - used - 13, size: 11, font: fontBold, color: BLACK });
      used += consignorBoxH + 2;
    }

    used += 10;
    y -= Math.max(0, used);
  }

  function drawDownMoneyReceivedBlock(){
    const rowY = y - 14;
    const box = 12;
    const boxY = rowY - (box/2) + 4;

    page.drawRectangle({
      x: M, y: boxY, width: box, height: box,
      borderWidth: 1.0, borderColor: BLACK,
      color: rgb(1,1,1)
    });

    const labelX = M + box + 8;
    page.drawText("Down Money Received", { x: labelX, y: rowY, size: 10.2, font: fontBold, color: BLACK });

    const lineY = rowY - 2;
    const initialsX = M + 305;
    const dateX = M + 505;

    page.drawText("Initials:", { x: initialsX - 52, y: rowY, size: 9.6, font, color: BLACK });
    page.drawLine({ start:{x: initialsX, y: lineY}, end:{x: initialsX + 96, y: lineY}, thickness:1.0, color: BLACK });

    page.drawText("Date:", { x: dateX - 34, y: rowY, size: 9.6, font, color: BLACK });
    page.drawLine({ start:{x: dateX, y: lineY}, end:{x: dateX + 110, y: lineY}, thickness:1.0, color: BLACK });

    y = rowY - 18;
  }

  function drawCmsNotesIfAny(r){
    const internalNotes = safeStr(r[CONFIG.COLS.cmsInternalNotes]);
    const externalNotes = safeStr(r[CONFIG.COLS.cmsExternalNotes]);
    
    if(!internalNotes && !externalNotes) return;

    y -= 26;

    const size = 10.0;
    const maxW = (W - 2*M);

    // Draw Internal Notes in RED
    if(internalNotes){
      const RED = rgb(0.8, 0, 0);
      const label = "CMS Internal Notes: ";
      const labelW = fontBold.widthOfTextAtSize(label, size);
      const lines = wrapLines(fontBold, internalNotes, size, maxW - labelW);

      let yy = y - 10;
      page.drawText(label, { x: M, y: yy, size, font: fontBold, color: RED });
      page.drawText(lines[0] || "", { x: M + labelW, y: yy, size, font: fontBold, color: RED });
      yy -= 12;

      for(let i=1;i<lines.length;i++){
        page.drawText(lines[i], { x: M + labelW, y: yy, size, font: fontBold, color: RED });
        yy -= 12;
      }

      y = yy - 8;
    }

    // Draw External Notes
    if(externalNotes){
      const label = "CMS External Notes: ";
      const labelW = fontBold.widthOfTextAtSize(label, size);
      const lines = wrapLines(fontBold, externalNotes, size, maxW - labelW);

      let yy = y - 10;
      page.drawText(label, { x: M, y: yy, size, font: fontBold, color: BLACK });
      page.drawText(lines[0] || "", { x: M + labelW, y: yy, size, font: fontBold, color: BLACK });
      yy -= 12;

      for(let i=1;i<lines.length;i++){
        page.drawText(lines[i], { x: M + labelW, y: yy, size, font: fontBold, color: BLACK });
        yy -= 12;
      }

      y = yy;
    }
  }

  function lotBlockHeight(record){
    const row1H = 32;
    const labelH = 14;

    const { maxLines } = computeGridWrapped(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const { regularLines, cmsNotes } = computeNotesLines(record);
    let notesLineCount = regularLines.length;
    
    // Add lines for CMS Internal Notes if present (rep mode)
    if(cmsNotes){
      const cmsText = `CMS Internal Notes: ${cmsNotes}`;
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, cmsText, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;

    const dmRowH = (mode === "buyer") ? 18 : 0;
    const preLinesH = singleLotMode ? 40 : 0;

    const dm = toNumber(record[CONFIG.COLS.downMoney]);
    const receivedBlockH = (singleLotMode && dm > 0) ? 26 : 0;
    const internalNotesH = (singleLotMode && (safeStr(record[CONFIG.COLS.cmsInternalNotes]) || safeStr(record[CONFIG.COLS.cmsExternalNotes]))) ? 60 : 0;

    return preLinesH + row1H + gridH + notesH + dmRowH + receivedBlockH + internalNotesH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit) newPage();
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : rgb(1,1,1);
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;

    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H,
      width: contentW, height: row1H,
      color: fill,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawText(textLeft, { x: M + CONFIG.PDF.padX, y: y - 14, size: CONFIG.PDF.lotTitle, font: fontBold, color: textColor });
    return row1H;
  }

  function drawCenteredLines(lines, xCenter, yTop, lineH, size){
    let yy = yTop;
    for(const ln of lines){
      const w = font.widthOfTextAtSize(ln || "", size);
      page.drawText(ln, { x: xCenter - w/2, y: yy, size, font, color: BLACK });
      yy -= lineH;
    }
  }

  function drawLotBlock(r){
    const contract = safeStr(getContract(r));
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);
    
    // Use Lot Number #2 for consignor/rep modes, regular for buyer
    const lotForHeader = (mode === "consignor" || mode === "rep") ? 
      safeStr(r[CONFIG.COLS.lotNumber2]) || safeStr(r[CONFIG.COLS.lotNumber]) :
      safeStr(r[CONFIG.COLS.lotNumber]);

    if(mode === "buyer") buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);

    if(mode === "buyer" && singleLotMode) drawSingleLotBuyerAndRepBlock(r);

    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r);
    }

    const topLine = mode === "rep" ? 
      `Lot # ${lotForHeader || contract} - ${consignor}` :
      mode === "buyer" ?
      // Contract Details (singleLotMode) already shows "Consignor: ..." in its own grey box,
      // so keep the consignor out of the lot header there to avoid printing it twice.
      `${lotForHeader ? `Lot # ${lotForHeader}` : `Contract # ${contract}`}${singleLotMode ? "" : ` - ${consignor}`}` :
      (lotForHeader ? `Lot # ${lotForHeader}` : `Contract # ${contract}`);
    const row1H = drawLotHeaderRow({ textLeft: topLine, fillHex: headerFillHex });

    // Use white text for Black X Beef on Dairy colored headers
    const isBlackX = headerFillHex === "#202E4A";
    const breedColor = (headerFillHex && isBlackX) ? rgb(...CONFIG.COLORS.textWhite) : 
                       (headerFillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK);
    page.drawText(safeStr(breed), { x: M + CONFIG.PDF.padX, y: y - 27, size: CONFIG.PDF.lotBreed, font, color: breedColor });
    y -= row1H;

    const labelH = 14;
    const { wrapped, maxLines } = computeGridWrapped(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({ x:M, y:y-gridH, width:gridW, height:gridH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
    page.drawLine({ start:{x:M, y:y-labelH}, end:{x:M+gridW, y:y-labelH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });

    let cx = M;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];
      if(i !== 0){
        page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });
      }

      const cellCenter = cx + c.w/2;
      const lw = fontBold.widthOfTextAtSize(c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, { x: cellCenter - lw/2, y: y - 11, size: CONFIG.PDF.gridLabel, font: fontBold, color: BLACK });

      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue);

      cx += c.w;
    }

    y -= gridH;

    const { regularLines, cmsNotes } = computeNotesLines(r);
    let notesLineCount = regularLines.length;
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;
    page.drawRectangle({ x:M, y:y-notesH, width:contentW, height:notesH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    let ny = y - 12;
    
    // Draw regular notes
    for(const ln of regularLines){
      page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font, color: BLACK });
      ny -= CONFIG.PDF.notesLineH;
    }
    
    // Draw CMS Internal Notes (bold) for rep mode
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      for(const ln of cmsLines){
        page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font: fontBold, color: BLACK });
        ny -= CONFIG.PDF.notesLineH;
      }
    }
    
    y -= notesH;

    if(mode === "buyer"){
      const dmRowH = 18;
      const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);
      const dmAmount = toNumber(r[CONFIG.COLS.downMoney]);
      const dmColor = (singleLotMode && dmAmount > 0) ? rgb(0.8, 0, 0) : BLACK; // Red only in Contract Details if > 0
      page.drawRectangle({ x:M, y:y-dmRowH, width:contentW, height:dmRowH, color: FILL, borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
      page.drawText(`Down Money Due: ${dm}`, { x:M + CONFIG.PDF.padX, y:y-13, size: 10.0, font: fontBold, color: dmColor });
      y -= dmRowH;
    }

    if(mode === "buyer" && singleLotMode){
      const dm = toNumber(r[CONFIG.COLS.downMoney]);
      if(dm > 0){ y -= 8; drawDownMoneyReceivedBlock(); }
      drawCmsNotesIfAny(r);
    }

    y -= CONFIG.PDF.lotGap;
  }

  const sorted = [...rows].sort(sortLots);
  
  for(let i = 0; i < sorted.length; i++){
    const r = sorted[i];
    ensureRoom(r);
    drawLotBlock(r);
  }

  // Buyer footer
  if(mode === "buyer" && !singleLotMode){
    const footerNeed = CONFIG.PDF.footerMinH + 36;
    if(y < bottomLimit + footerNeed) newPage();

    const totalBoxW = 270;
    const totalBoxH = 22;
    const totalX = M + contentW - totalBoxW;
    const totalY = y - totalBoxH;

    page.drawRectangle({ x: totalX, y: totalY, width: totalBoxW, height: totalBoxH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    const totalText = `Total Down Money Due: ${formatMoney(buyerDownMoneyTotal)}`;
    let ts = 10.6;
    while(ts > 8.6 && fontBold.widthOfTextAtSize(totalText, ts) > (totalBoxW - 12)) ts -= 0.2;

    page.drawText(totalText, { x: totalX + 6, y: totalY + 6, size: ts, font: fontBold, color: BLACK });
    y = totalY - 10;

    const footerHeader = "REMIT TO CMS LIVESTOCK AUCTION VIA WIRE TRANSFER, ACH, OR OVERNIGHT DELIVERY OF A CHECK";
    const footerLeft =
`PLEASE INCLUDE BUYER NAME AND LOT NUMBERS ON PAYMENT
Wire Instructions for CMS Livestock Auction:
Send Overnight Payments to:
CMS Livestock Auction
6900 I-40 West,
Suite 135
Amarillo, TX 79106.`;

    const footerRight =
`Wire funds to:
Happy State Bank 200 Main Street
Canadian, Tx 79014
Contact our office at (806) 355-7505 or CMSCattleAuctions@gmail.com for account and routing number`;

    const colGap = 22;
    const colW = (contentW - colGap) / 2;
    const leftX = M;
    const rightX = M + colW + colGap;

    const leftLines = footerLeft.split("\n").map(safeStr).filter(Boolean);
    const rightLines = footerRight.split("\n").map(safeStr).filter(Boolean);

    const neededLines = Math.max(leftLines.length, rightLines.length);
    const footerNeedH = 16 + (neededLines * CONFIG.PDF.footerLineH) + 22;

    if(y < bottomLimit + footerNeedH){
      newPage();
      y = H - CONFIG.PDF.topBarH - CONFIG.PDF.headerHOther - 10;
    }

    page.drawText(footerHeader, { x: M, y: y, size: 8.2, font: fontBold, color: BLACK });
    y -= (CONFIG.PDF.footerLineH + 4);

    let ly = y;
    for(const ln of leftLines){
      page.drawText(ln, { x: leftX, y: ly, size: 7.9, font, color: BLACK });
      ly -= CONFIG.PDF.footerLineH;
    }

    let ry = y;
    for(const ln of rightLines){
      page.drawText(ln, { x: rightX, y: ry, size: 7.9, font, color: BLACK });
      ry -= CONFIG.PDF.footerLineH;
    }
  }

  return await pdfDoc.save();
}


/* =========================================================================
   PDF: BUYER/SELLER CONTRACTS — PORTRAIT, TABLE LAYOUT
   - Portrait 8.5×11
   - Optimized for single-page fit
   - Terms section restructured (no separate Terms header)
   - Location: FOB, City format
   - Price with full border box
   - Tight spacing throughout
   ========================================================================= */
async function buildSalesContractPdf({row, side}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Portrait 8.5×11
  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  // Seller contracts use consignor color for top bar
  const topBarHex = (side === "seller") ? CONFIG.COLORS.consignorColor : CONFIG.COLORS.cmsBlue;
  const topBarColor  = rgb(...hexToRgb01(topBarHex));
  
  const BLACK        = rgb(0, 0, 0);
  const DARK_GRAY    = rgb(0.3, 0.3, 0.3);
  const GRAY         = rgb(0.55, 0.55, 0.55);
  const SECTION_BG   = rgb(0.94, 0.94, 0.94);
  const HIGHLIGHT_BG = rgb(...CONFIG.COLORS.highlightBg);
  const WHITE        = rgb(1, 1, 1);

  // ---- Data ----
  const contract       = safeStr(getContract(row));
  const lotNumber      = safeStr(row[CONFIG.COLS.lotNumber2]);
  const buyer          = safeStr(row[CONFIG.COLS.buyer]);
  const consignor      = safeStr(row[CONFIG.COLS.consignor]);
  const rep            = getRepColumn(row);
  const downMoneyAmt   = toNumber(row[CONFIG.COLS.downMoney]);
  const downMoney      = downMoneyDisplay(row[CONFIG.COLS.downMoney]);
  const breed          = safeStr(row[CONFIG.COLS.breed]) || safeStr(row[CONFIG.COLS.description]);
  const loads          = safeStr(row[CONFIG.COLS.loads])      || "0";
  const head           = safeStr(row[CONFIG.COLS.head])       || "0";
  const sex            = safeStr(row[CONFIG.COLS.sex]);
  const bw             = safeStr(row[CONFIG.COLS.baseWeight]);
  const del            = safeStr(row[CONFIG.COLS.delivery]);
  const loc            = safeStr(row[CONFIG.COLS.location]);
  const shr            = safeStr(row[CONFIG.COLS.shrink]);
  const sld            = safeStr(row[CONFIG.COLS.slide]);
  const price          = priceDisplay(row[CONFIG.COLS.price]);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra            = safeStr(auctionLabel.value);
  const auctionTitle     = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate            = safeStr(auctionDate.value) || "";

  // ---- Table geometry (tightened for single-page fit) ----
  const tableW  = contentW;
  const labelW  = 130;
  const valueW  = tableW - labelW;
  const secH    = 16;   // section header (reduced from 18)
  const dataH   = 15;   // data row height (reduced from 17)
  const padX    = 8;
  const termsLineH = 10.5;  // tighter (was 11.5)
  const paraGap    = 2;     // tighter (was 3)

  // ---- Helper: draw page header ----
  function drawPageHeader(pg, pageNum){
    pg.drawRectangle({ x:0, y:H-8, width:W, height:8, color: topBarColor });

    const topY = H - 8 - 28;

    // Left: "Cattle Sales Contract" with BUYER/SELLER COPY
    const contractLabel = side === "buyer" ? "Buyer Cattle Sales Contract" : "Seller Cattle Sales Contract";
    pg.drawText(contractLabel, {
      x: M, y: topY, size: 16, font: fontBold, color: BLACK
    });

    // Right: Contract #: {Contract}
    const headerRight = `Contract #: ${contract}`.trim();
    const cnW = fontBold.widthOfTextAtSize(headerRight, 16);
    pg.drawText(headerRight, {
      x: M + contentW - cnW, y: topY, size: 16, font: fontBold, color: BLACK
    });

    // Page 1: Company address right-aligned
    // Page 2+: Simple header
    if(pageNum === 1){
      const addrLines = [
        "CMS Livestock Auction",  // Changed from CMS Orita Calf Auctions
        "6900 I-40 West, Suite 135",
        "Amarillo, TX 79106",
        "(806) 355-7505"
      ];
      let ay = topY - 14;
      const addrX = M + contentW;
      pg.drawText(addrLines[0], { x: addrX - fontBold.widthOfTextAtSize(addrLines[0],9.6), y:ay, size:9.6, font:fontBold, color:BLACK });
      for(let i=1;i<addrLines.length;i++){
        ay -= 11;
        pg.drawText(addrLines[i], { x: addrX - font.widthOfTextAtSize(addrLines[i],9.2), y:ay, size:9.2, font, color:BLACK });
      }

      // Auction info (left)
      let lY = topY - 18;
      pg.drawText(safeStr(auctionTitle), { x:M, y:lY, size:9.8, font, color:BLACK });
      lY -= 12;
      if(aDate){ pg.drawText(safeStr(aDate), { x:M, y:lY, size:9.8, font, color:BLACK }); lY -= 12; }
    } else {
      // Page 2+ header: simple centered text
      const hdrText = "CMS Livestock Auction\n6900 I-40 West, Suite 135\nAmarillo, TX 79106\n(806) 355-7505";
      const lines = hdrText.split('\n');
      let hy = topY - 14;
      for(const ln of lines){
        const lw = font.widthOfTextAtSize(ln, 9);
        pg.drawText(ln, { x: W/2 - lw/2, y: hy, size: 9, font, color: BLACK });
        hy -= 11;
      }
    }

    // Page number on page 2+
    if(pageNum > 1){
      const pnText = `Page ${pageNum}`;
      const pnW = font.widthOfTextAtSize(pnText, 9);
      pg.drawText(pnText, { x: W/2 - pnW/2, y: 20, size:9, font, color:GRAY });
    }

    return pageNum === 1 ? (H - 8 - 110) : (H - 8 - 80);
  }

  // ---- MEASURE table height (data rows may be multiline) ----
  // Restructured: Quantity & Description, then Terms (with Delivery, Location, Shrink, Slide)
  const tableData = [
    { section: "Quantity & Description" },
    { label: "Loads:",        value: loads },
    { label: "Head Count:",   value: head },
    { label: "Sex:",          value: sex },
    { label: "Base Weight:",  value: bw + " lbs" },

    { section: "Terms" },
    { label: "Delivery:",     value: del },
    { label: "Location:",     value: `FOB, ${loc}` },  // Format: FOB, Clovis, NM
    { label: "Shrink:",       value: shr },
    { label: "Slide:",        value: sld },
  ];

  // Pre-compute actual row heights (data rows may wrap)
  function rowHeight(item){
    if(item.section) return secH;
    const lines = wrapLines(font, item.value, 9.5, valueW - padX*2);
    return Math.max(dataH, lines.length * 11 + 4);
  }

  const rowHeights = tableData.map(rowHeight);
  const priceRowH  = 20;  // tighter (was 22)
  const totalTableH = rowHeights.reduce((s,h)=>s+h, 0) + priceRowH;

  // ---- NOTES dynamic height ----
  const desc  = safeStr(row[CONFIG.COLS.description]);
  const desc2 = safeStr(row[CONFIG.COLS.secondDescription]);
  const notesRaw  = [desc, desc2].filter(Boolean).join("  |  ");
  const notesText = safeStr(`Notes: ${notesRaw}`);
  const notesWrapW = contentW - padX*2 - 8;
  const notesWrapped = wrapLines(font, notesText, 8.5, notesWrapW);  // smaller font
  const notesH = 10 + notesWrapped.length * 10 + 4;  // increased top padding from 6 to 10

  // ---- DOWN MONEY row height ----
  const dmH = 18;  // tighter (was 22)

  // ---- CONTRACT TERMS: pre-render all lines ----
  const rawTerms   = (side==="buyer") ? CONFIG.CONTRACT_TERMS.buyer : CONFIG.CONTRACT_TERMS.seller;
  const termsText2 = rawTerms.replace(/\{\{\s*Down Money Due\s*\}\}/g, downMoney);
  const boldStart  = "Buyer does hereby agree to a down payment of $30.00";
  const termsParas = termsText2.split("\n").map(s=>safeStr(s)).filter(p=>p.length>0);

  const termLines = [];
  for(const p of termsParas){
    const useBold = (side==="buyer") && p.startsWith(boldStart);
    const f = useBold ? fontBold : font;
    const wrapped = wrapLines(f, p, 9.0, contentW - padX*2);  // smaller font
    for(const ln of wrapped) termLines.push({ text: ln, bold: useBold });
    termLines.push({ text: "", gap: true });
  }

  // ---- SIGNATURE block height ----
  const sigBlockH = 50;  // tighter

  // ---- Page 1 setup ----
  let pages = [pdfDoc.addPage([W,H])];
  let pageNum = 1;
  let curPage = pages[0];
  let y = drawPageHeader(curPage, 1);

  // ---- Intro text (starts right after phone number) ----
  y -= 4;  // minimal gap

  if(side === "buyer"){
    const introText = `CMS Livestock Auction does hereby agree to sell and the buyer listed below does hereby agree to the purchase of the following livestock:`;
    const introLines = wrapLines(font, introText, 10.0, contentW - 10);
    for(const ln of introLines){
      curPage.drawText(ln, { x:M, y, size:10.0, font, color:BLACK });
      y -= 11.5;
    }
    y -= 6;  // reduced from 8
    curPage.drawText(`Buyer: ${buyer}`, { x:M, y, size:12.2, font:fontBold, color:BLACK });
    y -= 14;
  } else {
    const introText = `CMS Livestock Auction does hereby confirm the following cattle were sold on CMS Livestock Auction:`;
    const introLines = wrapLines(font, introText, 10.0, contentW - 10);
    for(const ln of introLines){
      curPage.drawText(ln, { x:M, y, size:10.0, font, color:BLACK });
      y -= 11.5;
    }
    y -= 6;  // reduced from 8
  }

  y -= 4;  // reduced gap before top box

  // ---- TOP BOX: Lot # + Seller/Consignor (for both sides) + Breed ----
  const topBoxLines = [];
  if(lotNumber){ topBoxLines.push({ text: `Lot # ${lotNumber}`, bold: true, size: 10.6 }); }
  // Show seller/consignor on BOTH buyer and seller contracts
  topBoxLines.push({ text: `Seller: ${consignor}`, bold: true, size: 10.6 });
  topBoxLines.push({ text: safeStr(breed), bold: side === "buyer", size: 9.6 });

  const topBoxH = 8 + topBoxLines.length * 13;  // tighter
  curPage.drawRectangle({
    x:M, y:y-topBoxH, width:contentW, height:topBoxH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });
  let bby = y - 11;
  for(const item of topBoxLines){
    curPage.drawText(item.text, {
      x: M+padX, y: bby,
      size: item.size,
      font: item.bold ? fontBold : font,
      color: BLACK
    });
    bby -= 13;
  }
  y -= topBoxH + 3;  // reduced from 4

  // ---- TABLE ----
  // Draw outer border first
  curPage.drawRectangle({
    x:M, y:y-totalTableH, width:tableW, height:totalTableH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });

  let ty = y;
  for(let i=0; i<tableData.length; i++){
    const item = tableData[i];
    const rh   = rowHeights[i];

    if(item.section){
      // Section header background - same for both buyer and seller
      curPage.drawRectangle({
        x:M, y:ty-rh, width:tableW, height:rh,
        color:SECTION_BG, borderWidth:0
      });
      // Redraw top, left, and right borders
      curPage.drawLine({ start:{x:M,       y:ty},    end:{x:M+tableW,   y:ty},    thickness:1.0, color:GRAY }); // Top
      curPage.drawLine({ start:{x:M,       y:ty},    end:{x:M,          y:ty-rh}, thickness:1.0, color:GRAY }); // Left
      curPage.drawLine({ start:{x:M+tableW, y:ty},   end:{x:M+tableW,   y:ty-rh}, thickness:1.0, color:GRAY }); // Right

      curPage.drawText(item.section, {
        x:M+padX, y:ty-11, size:9.5, font:fontBold, color:BLACK
      });
    } else {
      // Data row — redraw left + right side borders
      curPage.drawLine({ start:{x:M,       y:ty}, end:{x:M,         y:ty-rh}, thickness:1.0, color:GRAY });
      curPage.drawLine({ start:{x:M+tableW,y:ty}, end:{x:M+tableW, y:ty-rh}, thickness:1.0, color:GRAY });

      // Label
      curPage.drawText(item.label, {
        x:M+padX, y:ty-11, size:9.0, font, color:DARK_GRAY
      });

      // Vertical divider
      curPage.drawLine({
        start:{x:M+labelW, y:ty}, end:{x:M+labelW, y:ty-rh},
        thickness:0.8, color:GRAY
      });

      // Value (may wrap)
      const vLines = wrapLines(font, item.value, 9.5, valueW - padX*2);
      let vy = ty - 11;
      for(const vl of vLines){
        curPage.drawText(vl, { x:M+labelW+padX, y:vy, size:9.5, font, color:BLACK });
        vy -= 11;
      }
    }

    // Row bottom divider
    curPage.drawLine({
      start:{x:M, y:ty-rh}, end:{x:M+tableW, y:ty-rh},
      thickness:0.8, color:GRAY
    });

    ty -= rh;
  }

  // ---- PRICE ROW (highlighted, left-aligned, FULL BORDER BOX) ----
  curPage.drawRectangle({
    x:M, y:ty-priceRowH, width:tableW, height:priceRowH,
    color:HIGHLIGHT_BG, borderWidth:1.0, borderColor:GRAY  // Add full border
  });

  // Left-aligned label + value
  curPage.drawText("Purchase Price:", {
    x:M+padX, y:ty-13, size:9.0, font:fontBold, color:DARK_GRAY
  });
  curPage.drawLine({ start:{x:M+labelW,y:ty}, end:{x:M+labelW,y:ty-priceRowH}, thickness:0.8, color:GRAY });
  curPage.drawText(`${price}/cwt`, {
    x:M+labelW+padX, y:ty-13, size:11.5, font:fontBold, color:BLACK
  });

  ty -= priceRowH;
  y = ty;
  y -= 4;  // reduced from 6

  // ---- NOTES (dynamic height, proper right padding) ----
  curPage.drawRectangle({
    x:M, y:y-notesH, width:contentW, height:notesH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });
  let ny = y - 12; // increased from 8 to 12 for more top padding
  for(const ln of notesWrapped){
    curPage.drawText(ln, { x:M+padX, y:ny, size:8.5, font, color:BLACK });
    ny -= 10;
  }
  y -= notesH;
  y -= 4;  // reduced from 6

  // ---- DOWN MONEY (buyer only) ----
  if(side === "buyer"){
    if(downMoneyAmt > 0){
      curPage.drawRectangle({
        x:M, y:y-dmH, width:contentW, height:dmH,
        color:HIGHLIGHT_BG, borderWidth:1.0, borderColor:GRAY
      });
      curPage.drawText(`Down Money Due: ${downMoney}`, {
        x:M+padX, y:y-12, size:10.5, font:fontBold, color:BLACK
      });
    } else {
      curPage.drawRectangle({
        x:M, y:y-dmH, width:contentW, height:dmH,
        color:WHITE, borderWidth:1.0, borderColor:GRAY
      });
      curPage.drawText(`Down Money Due: ${downMoney}`, {
        x:M+padX, y:y-12, size:9.5, font, color:BLACK
      });
    }
    y -= dmH;
    y -= 18;   // reduced from 26
  } else {
    y -= 18;   // reduced from 26 (after notes on seller)
  }

  // ---- CONTRACT TERMS (never cut off, overflow gracefully) ----
  const termsX = M;
  const termsWrap = contentW - padX;

  // Signature block helper — draws side-by-side sigs on current page
  function drawSignatures(pg){
    const sigY  = 60;  // tighter
    const sigW  = (contentW - 30) / 2;
    const lX    = M;
    const rX    = M + sigW + 30;

    pg.drawLine({ start:{x:lX, y:sigY}, end:{x:lX+sigW, y:sigY}, thickness:1.0, color:BLACK });
    pg.drawLine({ start:{x:rX, y:sigY}, end:{x:rX+sigW, y:sigY}, thickness:1.0, color:BLACK });

    const lLabel = (side==="buyer") ? "Buyer Signature / Date" : "Seller Signature / Date";
    pg.drawText(lLabel,                               { x:lX, y:sigY-13, size:8.5, font, color:BLACK });
    pg.drawText("CMS Livestock Auction Signature / Date", { x:rX, y:sigY-13, size:8.5, font, color:BLACK });
  }

  // Add a new page and return starting y
  function addContractPage(){
    pageNum++;
    const pg = pdfDoc.addPage([W,H]);
    pages.push(pg);
    const startY = drawPageHeader(pg, pageNum);
    return { pg, startY };
  }

  const SIG_CLEARANCE = 80;  // space needed at bottom for signatures

  for(let i=0; i<termLines.length; i++){
    const tl = termLines[i];

    if(tl.gap){
      y -= paraGap;
      continue;
    }

    // Need room for this line + signature block
    if(y < SIG_CLEARANCE + termsLineH){
      // Overflow to new page
      const { pg, startY } = addContractPage();
      curPage = pg;
      y = startY;
      
      // Add page number to previous page
      const prevPg = pages[pageNum-2];
      const pnPrev = `Page ${pageNum-1}`;
      const pnPrevW = font.widthOfTextAtSize(pnPrev, 9);
      prevPg.drawText(pnPrev, { x:W/2-pnPrevW/2, y:20, size:9, font, color:GRAY });
    }

    curPage.drawText(tl.text, {
      x: termsX,
      y,
      size: 9.0,
      font: tl.bold ? fontBold : font,
      color: BLACK
    });
    y -= termsLineH;
  }

  // ---- SIGNATURES on final page ----
  drawSignatures(curPage);

  return await pdfDoc.save();
}

/* =========================================================================
   SPECIAL REPORTS: HELPER FUNCTIONS
   ========================================================================= */

function getWeightClass(baseWeight){
  const w = toNumber(baseWeight);
  if(w < 400) return "<400 lbs";
  if(w <= 500) return "400-500 lbs";
  return "500+ lbs";
}

function isPO(row){
  const p = safeStr(row[CONFIG.COLS.price]);
  return p.toUpperCase() === 'PO' || p.toUpperCase() === 'SCRATCH' || p === '';
}

function isOptionLot(row, isPre=false){
  // Pre-auction: check "Option" column for value
  if(isPre){
    const option = safeStr(row["Option"]);
    return option !== "";
  }
  
  // Post-auction: check if lot number ends with A, B, C, etc.
  const lotNum = safeStr(row[CONFIG.COLS.lotNumber]);
  return /[A-Z]$/.test(lotNum);
}

function groupLotsByType(rows){
  const groups = new Map();
  for(const r of rows){
    const type = safeStr(r[CONFIG.COLS.type]) || "Other";
    if(!groups.has(type)) groups.set(type, []);
    groups.get(type).push(r);
  }
  return groups;
}

function calculateLotTotal(row){
  if(isPO(row)) return 0;
  const head = toNumber(row[CONFIG.COLS.head]);
  const baseWt = toNumber(row[CONFIG.COLS.baseWeight]);
  const price = toNumber(row[CONFIG.COLS.price]);
  return (head * baseWt * price) / 100;
}


/* =========================================================================
   SPECIAL REPORT 1-3: SALES SUMMARY (Consignor/Buyer/Rep)
   Individual PDFs with sold/PO sections, grouped by type
   ========================================================================= */
async function buildSalesSummaryPdf({entityName, rows, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);
  const DARK_GRAY = rgb(0.3,0.3,0.3);
  const LIGHT_BG = rgb(0.95, 0.95, 0.95);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 50;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;

  // Header
  const title = mode === "consignor" ? "SALES SUMMARY - CONSIGNOR" : 
                mode === "buyer" ? "SALES SUMMARY - BUYER" : "SALES SUMMARY - REPRESENTATIVE";
  page.drawText(title, { x:M, y, size:14, font:fontBold, color:BLACK });
  y -= 16;
  page.drawText(entityName, { x:M, y, size:12, font:fontBold, color:BLACK });
  y -= 14;
  page.drawText(auctionTitle, { x:M, y, size:9, font, color:DARK_GRAY });
  y -= 20;

  // Calculate totals
  const soldRows = rows.filter(r => !isPO(r));
  const poRows = rows.filter(r => isPO(r));
  
  const totalHead = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
  const totalSales = soldRows.reduce((sum, r) => sum + calculateLotTotal(r), 0);
  const avgPrice = totalHead > 0 ? (totalSales / (soldRows.reduce((sum,r) => sum + (toNumber(r[CONFIG.COLS.head]) * toNumber(r[CONFIG.COLS.baseWeight])), 0) / 100)) : 0;

  // Summary box
  page.drawText(`Total Head: ${formatNumber(totalHead)}`, { x:M, y, size:10, font:fontBold, color:BLACK });
  page.drawText(`Total Sales: ${formatMoney(totalSales)}`, { x:M+200, y, size:10, font:fontBold, color:BLACK });
  page.drawText(`Avg Price: $${avgPrice.toFixed(2)}/cwt`, { x:M+380, y, size:10, font:fontBold, color:BLACK });
  y -= 25;

  // Draw horizontal line
  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 15;

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    y = H - 50;
  }

  function drawSectionHeader(text){
    if(y < 80){ newPage(); }
    page.drawRectangle({ x:M, y:y-16, width:contentW, height:16, color:LIGHT_BG, borderWidth:0 });
    page.drawText(text, { x:M+4, y:y-12, size:10, font:fontBold, color:BLACK });
    y -= 18;
  }

  function drawTableHeader(){
    if(y < 80){ newPage(); }
    const cols = [
      {label:"Lot #", x:M, w:50},
      {label:"Head", x:M+50, w:45},
      {label:"Sex", x:M+95, w:60},
      {label:"Base Wt", x:M+155, w:60},
      {label:"Delivery", x:M+215, w:80},
      {label:"Price", x:M+295, w:70},
      {label:"Total", x:M+365, w:75},
    ];
    
    for(const c of cols){
      page.drawText(c.label, { x:c.x+2, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    }
    y -= 14;
  }

  function drawLotRow(row, includePrice=true){
    if(y < 50){ newPage(); drawTableHeader(); }
    
    const lotNum = safeStr(row[CONFIG.COLS.lotNumber]) || "";
    const head = safeStr(row[CONFIG.COLS.head]);
    const sex = safeStr(row[CONFIG.COLS.sex]);
    const baseWt = safeStr(row[CONFIG.COLS.baseWeight]) + " lbs";
    const delivery = safeStr(row[CONFIG.COLS.delivery]);
    const price = includePrice ? priceDisplay(row[CONFIG.COLS.price]) + "/cwt" : "-";
    const total = includePrice ? formatMoney(calculateLotTotal(row)) : "-";

    // Truncate text if it's too wide for the column
    function truncateText(text, maxWidth, fontSize) {
      let truncated = text;
      while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      if (truncated.length < text.length && truncated.length > 3) {
        truncated = truncated.slice(0, -3) + "...";
      }
      return truncated;
    }

    page.drawText(truncateText(lotNum, 46, 8), { x:M+2, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(head, 41, 8), { x:M+52, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(sex, 56, 8), { x:M+97, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(baseWt, 56, 8), { x:M+157, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(delivery, 76, 8), { x:M+217, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(price, 66, 8), { x:M+297, y:y-9, size:8, font, color:BLACK });
    page.drawText(truncateText(total, 71, 8), { x:M+367, y:y-9, size:8, font, color:BLACK });
    
    y -= 12;
  }

  // SOLD LOTS
  if(soldRows.length > 0){
    drawSectionHeader("SOLD LOTS");
    drawTableHeader();

    const byType = groupLotsByType(soldRows);
    const sortedTypes = Array.from(byType.keys()).sort();

    for(const type of sortedTypes){
      const typeRows = byType.get(type).sort(sortLots);
      
      // Type header
      if(y < 60){ newPage(); }
      page.drawText(type.toUpperCase(), { x:M, y:y-10, size:9, font:fontBold, color:BLACK });
      y -= 14;

      for(const row of typeRows){
        drawLotRow(row, true);
      }

      // Type subtotal
      const typeHead = typeRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
      const typeTotal = typeRows.reduce((sum, r) => sum + calculateLotTotal(r), 0);
      
      if(y < 40){ newPage(); }
      page.drawText(`${type} Subtotal:`, { x:M, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      page.drawText(`${formatNumber(typeHead)} head`, { x:M+297, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      page.drawText(formatMoney(typeTotal), { x:M+367, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      y -= 18;
    }

    // Grand total for sold
    if(y < 40){ newPage(); }
    page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
    y -= 14;
    page.drawText("TOTAL SOLD:", { x:M+217, y:y-10, size:9, font:fontBold, color:BLACK });
    page.drawText(`${formatNumber(totalHead)} head`, { x:M+297, y:y-10, size:9, font:fontBold, color:BLACK });
    page.drawText(formatMoney(totalSales), { x:M+367, y:y-10, size:9, font:fontBold, color:BLACK });
    y -= 25;
  }

  // PASSED/PO/SCRATCH LOTS
  if(poRows.length > 0){
    if(y < 100){ newPage(); }
    
    drawSectionHeader("PASSED/PO/SCRATCH LOTS");
    
    // PO header (no price/total columns)
    const poCols = [
      {label:"Lot #", x:M},
      {label:"Head", x:M+50},
      {label:"Sex", x:M+95},
      {label:"Base Wt", x:M+155},
      {label:"Delivery", x:M+215},
    ];
    
    for(const c of poCols){
      page.drawText(c.label, { x:c.x+2, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    }
    y -= 14;

    // Truncate helper (same as in drawLotRow)
    function truncateTextPO(text, maxWidth, fontSize) {
      let truncated = text;
      while (font.widthOfTextAtSize(truncated, fontSize) > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
      }
      if (truncated.length < text.length && truncated.length > 3) {
        truncated = truncated.slice(0, -3) + "...";
      }
      return truncated;
    }

    const poSorted = [...poRows].sort(sortLots);
    for(const row of poSorted){
      if(y < 50){ newPage(); }
      
      const lotNum = safeStr(row[CONFIG.COLS.lotNumber]) || "";
      const head = safeStr(row[CONFIG.COLS.head]);
      const sex = safeStr(row[CONFIG.COLS.sex]);
      const baseWt = safeStr(row[CONFIG.COLS.baseWeight]) + " lbs";
      const delivery = safeStr(row[CONFIG.COLS.delivery]);

      page.drawText(truncateTextPO(lotNum, 46, 8), { x:M+2, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(truncateTextPO(head, 41, 8), { x:M+52, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(truncateTextPO(sex, 56, 8), { x:M+97, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(truncateTextPO(baseWt, 56, 8), { x:M+157, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(truncateTextPO(delivery, 76, 8), { x:M+217, y:y-9, size:8, font, color:DARK_GRAY });
      
      y -= 12;
    }

    const poHead = poRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
    if(y < 40){ newPage(); }
    page.drawText(`Not Sold: ${formatNumber(poHead)} head`, { x:M, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    y -= 20;
  }

  // Buyer-specific: Down Money
  if(mode === "buyer"){
    const totalDownMoney = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.downMoney]), 0);
    if(totalDownMoney > 0){
      if(y < 40){ newPage(); }
      page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
      y -= 14;
      page.drawText("Total Down Money Due:", { x:M, y:y-10, size:10, font:fontBold, color:BLACK });
      page.drawText(formatMoney(totalDownMoney), { x:M+367, y:y-10, size:10, font:fontBold, color:BLACK });
    }
  }

  return await pdfDoc.save();
}


/* =========================================================================
   SPECIAL REPORT 4-5: COMPLETE BUYER/CONSIGNOR SUMMARY
   Single portrait PDF listing all entities with totals
   ========================================================================= */
async function buildCompleteSummaryPdf({summaries, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);
  const DARK_GRAY = rgb(0.3,0.3,0.3);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 50;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;

  // Header
  const title = mode === "buyer" ? "COMPLETE BUYER SUMMARY" : 
                mode === "rep" ? "COMPLETE REP SUMMARY" : 
                "COMPLETE CONSIGNOR SUMMARY";
  page.drawText(title, { x:M, y, size:14, font:fontBold, color:BLACK });
  y -= 16;
  page.drawText(auctionTitle, { x:M, y, size:9, font, color:DARK_GRAY });
  y -= 25;

  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 15;

  // Table header
  const nameCol = mode === "buyer" ? "Buyer Name" : 
                  mode === "rep" ? "Rep Name" : 
                  "Consignor Name";
  page.drawText(nameCol, { x:M+5, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("# Lots", { x:M+250, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("Head", { x:M+310, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("Total $", { x:M+370, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  if(mode === "buyer"){
    page.drawText("Down Money", { x:M+460, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  }
  y -= 14;

  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:0.5, color:GRAY });
  y -= 12;

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    y = H - 50;
  }

  // Separate sold and PO summaries
  const soldSummaries = summaries.filter(s => !s.isPO);
  const poSummaries = summaries.filter(s => s.isPO);
  
  // Sort sold by total $ descending
  const sortedSold = [...soldSummaries].sort((a,b) => b.totalSales - a.totalSales);
  
  // Sort PO alphabetically
  const sortedPO = [...poSummaries].sort((a,b) => a.name.localeCompare(b.name));

  // Render sold buyers/consignors
  for(const s of sortedSold){
    if(y < 50){ newPage(); }

    page.drawText(s.name, { x:M+5, y:y-9, size:9, font, color:BLACK });
    page.drawText(formatNumber(s.lotCount), { x:M+250, y:y-9, size:9, font, color:BLACK });
    page.drawText(formatNumber(s.totalHead), { x:M+310, y:y-9, size:9, font, color:BLACK });
    page.drawText(formatMoney(s.totalSales), { x:M+370, y:y-9, size:9, font, color:BLACK });
    if(mode === "buyer" && s.downMoney !== undefined){
      page.drawText(formatMoney(s.downMoney), { x:M+460, y:y-9, size:9, font, color:BLACK });
    }
    
    y -= 12;
  }
  
  // Sold totals before PO section
  const soldLots = soldSummaries.reduce((sum, s) => sum + s.lotCount, 0);
  const soldHead = soldSummaries.reduce((sum, s) => sum + s.totalHead, 0);
  const soldSales = soldSummaries.reduce((sum, s) => sum + s.totalSales, 0);
  const soldDownMoney = mode === "buyer" ? soldSummaries.reduce((sum, s) => sum + (s.downMoney || 0), 0) : 0;
  
  if(y < 50){ newPage(); }
  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:0.5, color:GRAY });
  y -= 12;
  page.drawText("SOLD TOTALS:", { x:M+5, y:y-9, size:9, font:fontBold, color:BLACK });
  page.drawText(formatNumber(soldHead) + " head", { x:M+310, y:y-9, size:9, font:fontBold, color:BLACK });
  y -= 16;
  
  // Render PO buyers/consignors (if any) in gray
  if(sortedPO.length > 0){
    if(y < 50){ newPage(); }
    y -= 8;
    page.drawText("--- PO/SCRATCH ---", { x:M+5, y:y-9, size:9, font:fontBold, color:DARK_GRAY });
    y -= 12;
    
    for(const s of sortedPO){
      if(y < 50){ newPage(); }

      page.drawText(s.name, { x:M+5, y:y-9, size:9, font, color:DARK_GRAY });
      page.drawText(formatNumber(s.lotCount), { x:M+250, y:y-9, size:9, font, color:DARK_GRAY });
      page.drawText(formatNumber(s.totalHead), { x:M+310, y:y-9, size:9, font, color:DARK_GRAY });
      page.drawText("PO", { x:M+370, y:y-9, size:9, font, color:DARK_GRAY });
      
      y -= 12;
    }
  }

  // Grand totals (sold + PO)
  const grandLots = summaries.reduce((sum, s) => sum + s.lotCount, 0);
  const grandHead = summaries.reduce((sum, s) => sum + s.totalHead, 0);
  const grandDownMoney = mode === "buyer" ? summaries.reduce((sum, s) => sum + (s.downMoney || 0), 0) : 0;

  if(y < 50){ newPage(); }
  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 14;

  page.drawText("GRAND TOTAL:", { x:M+5, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(formatNumber(grandLots), { x:M+250, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(formatNumber(grandHead) + " head", { x:M+310, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(formatMoney(soldSales), { x:M+370, y:y-10, size:10, font:fontBold, color:BLACK });
  if(mode === "buyer" && soldDownMoney > 0){
    page.drawText(formatMoney(soldDownMoney), { x:M+460, y:y-10, size:10, font:fontBold, color:BLACK });
  }

  return await pdfDoc.save();
}


/* =========================================================================
   COMPLETE BUYER / CONSIGNOR SUMMARY
   Portrait US Letter, multi-page. Shares branding with the Auction
   Performance Summary (navy / gold, CMS logo). The Rep summary still
   uses buildCompleteSummaryPdf above.
   ========================================================================= */

// Weighted totals for a set of SOLD lots. Lots with no base weight still
// count toward head and gross, but not toward pounds - no estimated
// weights are substituted. Averages are null when their divisor is zero.
function aggregateSold(rows){
  let head = 0, gross = 0, lbs = 0, weighedHead = 0;
  for(const r of rows){
    const h = toNumber(r[CONFIG.COLS.head]);
    const w = toNumber(r[CONFIG.COLS.baseWeight]);
    head += h;
    gross += calculateLotTotal(r);
    if(w > 0){ lbs += h * w; weighedHead += h; }
  }
  return {
    lots: rows.length, head, gross, lbs,
    weighedHead,
    avgWt:  weighedHead > 0 ? lbs / weighedHead : null,
    // No priced/weighed head at all -> value is unknown, not $0.
    avgHd:  head > 0 && weighedHead > 0 ? gross / head : null,
    avgCwt: lbs > 0 ? (gross / lbs) * 100 : null,
  };
}

// Group rows by party name. Names are matched case- and spacing-
// insensitively so one buyer/consignor never appears twice.
function groupByParty(rows, col){
  const m = new Map();
  for(const r of rows){
    const name = safeStr(r[col]) || "(Unassigned)";
    const key = name.toLowerCase();
    if(!m.has(key)) m.set(key, { name, rows: [] });
    m.get(key).rows.push(r);
  }
  return Array.from(m.values());
}

async function buildPartySummaryPdf({allRows, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font      = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const W = 612, H = 792, M = 30;
  const contentW = W - 2*M;
  const FOOTER_Y = 22;
  const BOTTOM = FOOTER_Y + 18;          // lowest y a row may reach

  const NAVY     = rgb(0.098, 0.180, 0.306);
  const GOLD     = rgb(0.784, 0.627, 0.290);
  const GOLD_BG  = rgb(0.973, 0.941, 0.863);
  const INK      = rgb(0.10, 0.11, 0.14);
  const MUTED    = rgb(0.38, 0.40, 0.44);
  const RULE     = rgb(0.85, 0.86, 0.88);
  const HEAD_BG  = rgb(0.910, 0.918, 0.929);
  const WHITE    = rgb(1,1,1);

  const isBuyer = mode === "buyer";
  const TITLE = isBuyer ? "COMPLETE BUYER SUMMARY" : "COMPLETE CONSIGNOR SUMMARY";
  const SIZE = isBuyer ? 9 : 8;          // consignor table has 11 columns
  const LINE_H = SIZE + 2.6;

  /* ---------- data ---------- */
  const DASH = "—";
  const int   = n => formatNumber(Math.round(n));
  const money = n => formatMoney(n);
  const opt   = (v, f) => v === null || v === undefined ? DASH : f(v);
  const wt    = v => opt(v, n => int(n));
  const pctOf = (part, whole) => whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : DASH;

  const soldRows = allRows.filter(r => !isPO(r));
  const poRows   = allRows.filter(r => isPO(r));
  const sold     = aggregateSold(soldRows);
  const poHead   = poRows.reduce((s, r) => s + toNumber(r[CONFIG.COLS.head]), 0);

  let cols, bodyRows, totalRow, poCols, poBody, poTotal;

  if(isBuyer){
    const buyers = groupByParty(soldRows, CONFIG.COLS.buyer)
      .map(g => ({ name: g.name, ...aggregateSold(g.rows) }))
      .sort((a,b) => b.head - a.head || a.name.localeCompare(b.name));
    cols = [
      { label: "#",         w: 22, align: "right" },
      { label: "Buyer",     flex: true, align: "left" },
      { label: "Lots",      w: 38, align: "right" },
      { label: "Head",      w: 50, align: "right" },
      { label: "Avg Wt",    w: 50, align: "right" },
      { label: "Avg $/Hd",  w: 70, align: "right" },
      { label: "Avg $/Cwt", w: 66, align: "right" },
      { label: "Total $",   w: 92, align: "right" },
    ];
    bodyRows = buyers.map((b, i) => [
      String(i+1), b.name, int(b.lots), int(b.head), wt(b.avgWt),
      opt(b.avgHd, money), opt(b.avgCwt, money), b.weighedHead > 0 || b.head === 0 ? money(b.gross) : DASH,
    ]);
    totalRow = ["", "SOLD TOTALS", int(sold.lots), int(sold.head), wt(sold.avgWt),
      opt(sold.avgHd, money), opt(sold.avgCwt, money), money(sold.gross)];
    poCols = [
      { label: "Status", flex: true, align: "left" },
      { label: "Lots",   w: 120, align: "right" },
      { label: "Head",   w: 140, align: "right" },
    ];
    poBody = [["PO / Scratch", int(poRows.length), int(poHead)]];
    poTotal = null;
  } else {
    const consignors = groupByParty(allRows, CONFIG.COLS.consignor).map(g => {
      const soldPart = g.rows.filter(r => !isPO(r));
      const poPart   = g.rows.filter(r => isPO(r));
      return {
        name: g.name,
        lotsAdv: g.rows.length,
        headAdv: g.rows.reduce((s, r) => s + toNumber(r[CONFIG.COLS.head]), 0),
        poLots: poPart.length,
        poHead: poPart.reduce((s, r) => s + toNumber(r[CONFIG.COLS.head]), 0),
        ...aggregateSold(soldPart),
      };
    }).sort((a,b) => b.head - a.head || b.headAdv - a.headAdv || a.name.localeCompare(b.name));
    cols = [
      { label: "#",          w: 18, align: "right" },
      { label: "Consignor",  flex: true, align: "left" },
      { label: "Lots\nAdv",   w: 32, align: "right" },
      { label: "Lots\nSold",  w: 32, align: "right" },
      { label: "Head\nAdv",   w: 42, align: "right" },
      { label: "Head\nSold",  w: 42, align: "right" },
      { label: "Sold\n%",     w: 40, align: "right" },
      { label: "Avg\nWt",     w: 36, align: "right" },
      { label: "Avg\n$/Hd",   w: 56, align: "right" },
      { label: "Avg\n$/Cwt",  w: 52, align: "right" },
      { label: "Total $",    w: 72, align: "right" },
    ];
    bodyRows = consignors.map((c, i) => [
      String(i+1), c.name, int(c.lotsAdv), int(c.lots), int(c.headAdv), int(c.head),
      pctOf(c.head, c.headAdv), wt(c.avgWt), opt(c.avgHd, money), opt(c.avgCwt, money),
      c.weighedHead > 0 || c.head === 0 ? money(c.gross) : DASH,
    ]);
    const lotsAdv = allRows.length;
    const headAdv = allRows.reduce((s, r) => s + toNumber(r[CONFIG.COLS.head]), 0);
    totalRow = ["", "SOLD TOTALS", int(lotsAdv), int(sold.lots), int(headAdv), int(sold.head),
      pctOf(sold.head, headAdv), wt(sold.avgWt), opt(sold.avgHd, money), opt(sold.avgCwt, money), money(sold.gross)];
    poCols = [
      { label: "Consignor", flex: true, align: "left" },
      { label: "PO Lots",   w: 120, align: "right" },
      { label: "PO Head",   w: 140, align: "right" },
    ];
    poBody = consignors.filter(c => c.poLots > 0)
      .sort((a,b) => b.poHead - a.poHead || a.name.localeCompare(b.name))
      .map(c => [c.name, int(c.poLots), int(c.poHead)]);
    poTotal = ["PO TOTALS", int(poRows.length), int(poHead)];
  }

  /* ---------- page + drawing helpers ---------- */
  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} - ${extra}` : auctionTitleBase;
  const dateLine = reportDateLine(auctionDate.value);
  const subtitle = dateLine ? `${dateLine}   |   ${auctionTitle}` : auctionTitle;

  let logoImg = null;
  const logoBytes = await loadReportLogoBytes();
  if(logoBytes){ try { logoImg = await pdfDoc.embedPng(logoBytes); } catch(e){ logoImg = null; } }

  function widthOf(s, size, f=font){ return f.widthOfTextAtSize(String(s), size); }
  function fit(s, maxW, size, f=font){
    let t = safeStr(s);
    if(widthOf(t, size, f) <= maxW) return t;
    while(t.length > 1 && widthOf(t + "...", size, f) > maxW) t = t.slice(0, -1);
    return t.trimEnd() + "...";
  }
  function text(s, x, y, {size=SIZE, f=font, color=INK, align="left"} = {}){
    const w = widthOf(s, size, f);
    const dx = align === "right" ? -w : align === "center" ? -w/2 : 0;
    page.drawText(String(s), { x: x + dx, y, size, font: f, color });
  }
  function hline(x1, x2, y, color=RULE, thickness=0.5){
    page.drawLine({ start:{x:x1, y}, end:{x:x2, y}, thickness, color });
  }

  let page, y;
  function drawHeader(first){
    const bandH = first ? 82 : 40;
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: NAVY });
    if(first){
      let divX = M + 120;
      if(logoImg){
        const lh = 58, lw = lh * (logoImg.width / logoImg.height);
        page.drawRectangle({ x: M, y: H - bandH/2 - lh/2 - 3, width: lw + 12, height: lh + 6, color: WHITE });
        page.drawImage(logoImg, { x: M + 6, y: H - bandH/2 - lh/2, width: lw, height: lh });
        divX = M + lw + 12 + 18;
      }
      page.drawRectangle({ x: divX, y: H - bandH + 16, width: 2, height: bandH - 32, color: GOLD });
      const tx = divX + 18;
      let ts = 22;
      while(ts > 14 && widthOf(TITLE, ts, serifBold) > M + contentW - tx) ts -= 0.5;
      text(TITLE, tx, H - 38, { size: ts, f: serifBold, color: WHITE });
      text(fit(subtitle, M + contentW - tx, 11), tx, H - 58, { size: 11, color: WHITE });
      y = H - bandH - 10;
      hline(M, M + contentW, y, GOLD, 1);
      y -= 14;
    } else {
      text(TITLE, M, H - 26, { size: 13, f: serifBold, color: WHITE });
      const cont = fit(`${subtitle}  (continued)`, contentW - 24 - widthOf(TITLE, 13, serifBold), 9);
      text(cont, M + contentW, H - 25, { size: 9, color: WHITE, align: "right" });
      y = H - bandH - 14;
    }
  }
  function sectionBar(title){
    const h = 24;
    page.drawRectangle({ x: M, y: y - h, width: contentW, height: h, color: NAVY });
    text(title, M + 12, y - 17, { size: 14, f: serifBold, color: WHITE });
    y -= h;
  }
  function newPage(first=false){
    page = pdfDoc.addPage([W, H]);
    drawHeader(first);
  }

  // Resolve column x positions for a table of the given total width.
  function layout(colsDef, width){
    const fixed = colsDef.reduce((s, c) => s + (c.flex ? 0 : c.w), 0);
    let x = M;
    return colsDef.map(c => {
      const w = c.flex ? width - fixed : c.w;
      const out = { ...c, x, w };
      x += w;
      return out;
    });
  }
  const PAD = 6;
  function cellX(c){ return c.align === "right" ? c.x + c.w - PAD : c.x + PAD; }

  function headerH(cs){ return cs.some(c => c.label.includes("\n")) ? 28 : 20; }
  function tableHeader(cs, width){
    const h = headerH(cs);
    page.drawRectangle({ x: M, y: y - h, width, height: h, color: HEAD_BG });
    cs.forEach(c => {
      const parts = c.label.split("\n");
      const first = y - h/2 - SIZE*0.35 + (parts.length - 1) * LINE_H / 2;
      parts.forEach((pt, i) => text(pt, cellX(c), first - i * LINE_H, { size: SIZE, f: fontBold, color: NAVY, align: c.align }));
    });
    y -= h;
    hline(M, M + width, y, NAVY, 0.8);
  }
  function rowLines(cs, row){
    // Only text (left-aligned) columns wrap; numbers never do.
    return cs.map((c, i) => c.align === "left"
      ? wrapLines(font, row[i], SIZE, c.w - 2*PAD).slice(0, 3)
      : [row[i]]);
  }
  function rowHeight(lines){ return Math.max(17, Math.max(...lines.map(l => l.length)) * LINE_H + 5); }

  function drawRow(cs, width, row, {total=false} = {}){
    const lines = rowLines(cs, row);
    const h = rowHeight(lines);
    if(total){
      page.drawRectangle({ x: M, y: y - h, width, height: h, color: GOLD_BG });
      hline(M, M + width, y, GOLD, 1);
    }
    const f = total ? fontBold : font;
    cs.forEach((c, i) => {
      const firstBase = y - h/2 + (lines[i].length - 1) * LINE_H / 2 - SIZE * 0.36;
      lines[i].forEach((ln, li) => {
        const s = c.align === "left" && lines[i].length === 3 && li === 2 ? fit(ln, c.w - 2*PAD, SIZE, f) : ln;
        const isLabel = total && c.align === "left" && ln;
        text(s, cellX(c), firstBase - li * LINE_H, { size: isLabel ? SIZE + 2 : SIZE, f: isLabel ? serifBold : f, color: INK, align: c.align });
      });
    });
    y -= h;
    hline(M, M + width, y, total ? GOLD : RULE, total ? 1 : 0.5);
  }

  // Draw a table that continues across pages, repeating its header.
  function drawTable(colsDef, width, rows, total){
    const cs = layout(colsDef, width);
    tableHeader(cs, width);
    rows.forEach((row, idx) => {
      const h = rowHeight(rowLines(cs, row));
      // keep the last body row together with the totals row
      const need = h + (idx === rows.length - 1 && total ? rowHeight(rowLines(cs, total)) : 0);
      if(y - need < BOTTOM){ newPage(); tableHeader(cs, width); }
      drawRow(cs, width, row);
    });
    if(total){
      const h = rowHeight(rowLines(cs, total));
      if(y - h < BOTTOM){ newPage(); tableHeader(cs, width); }
      drawRow(cs, width, total, { total: true });
    }
  }
  function tableHeight(colsDef, width, rows, total){
    const cs = layout(colsDef, width);
    return headerH(cs) + [...rows, ...(total ? [total] : [])].reduce((s, r) => s + rowHeight(rowLines(cs, r)), 0);
  }

  /* ---------- render ---------- */
  newPage(true);
  sectionBar(isBuyer ? "BUYER DETAIL" : "CONSIGNOR DETAIL");
  drawTable(cols, contentW, bodyRows, totalRow);

  // PO / Scratch section - kept together when it fits on one page.
  const poWidth = contentW;
  const poRowsToDraw = poBody.length ? poBody : [["None", "0", "0"]];
  const poH = 20 + 24 + tableHeight(poCols, poWidth, poRowsToDraw, poTotal);
  const freshPageRoom = (H - 40 - 14) - BOTTOM;
  if(y - poH < BOTTOM && poH <= freshPageRoom){ newPage(); }
  else { y -= 10; hline(M, M + contentW, y, GOLD, 1); y -= 10; }
  sectionBar("PO / SCRATCH");
  drawTable(poCols, poWidth, poRowsToDraw, poTotal);

  // Footer + page numbers (numbers only when there is more than one page)
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    page = p;
    hline(M, M + contentW, FOOTER_Y + 10, GOLD, 0.8);
    text("CMS Livestock Auction", M, FOOTER_Y, { size: 7.5, color: MUTED });
    if(pages.length > 1) text(`Page ${i+1} of ${pages.length}`, M + contentW, FOOTER_Y, { size: 7.5, color: MUTED, align: "right" });
  });

  return await pdfDoc.save();
}


/* =========================================================================
   SPECIAL REPORT 6: AUCTION PERFORMANCE SUMMARY
   Single portrait page laid out to the approved mockup:
   header -> Gross Sales | Averages -> Overview | Key Metrics ->
   Participation (3 cols) -> Cattle Mix | Delivery Schedule.
   ========================================================================= */
let _reportLogoBytes = null;
async function loadReportLogoBytes(){
  if(_reportLogoBytes) return _reportLogoBytes;
  try {
    const res = await fetch("assets/logo-report.png");
    if(!res.ok) return null;
    _reportLogoBytes = new Uint8Array(await res.arrayBuffer());
    return _reportLogoBytes;
  } catch(e){
    return null; // report still renders without the logo
  }
}

// "February 12th, 2026 @ 1:00PM" -> "February 12, 2026"
function reportDateLine(raw){
  return safeStr(raw)
    .split("@")[0]
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\s+,/g, ",")
    .trim();
}

// Month bucket for the delivery schedule. Unparseable text is kept as-is
// so nothing is silently dropped from the totals.
function deliveryMonthLabel(raw){
  const s = safeStr(raw);
  if(!s) return "";
  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const num = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(num){
    const m = parseInt(num[1], 10);
    if(m >= 1 && m <= 12) return MONTHS[m-1];
  }
  const txt = s.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
  if(txt) return MONTHS.find(m => m.toLowerCase() === txt[1].toLowerCase());
  return s;
}

async function buildAuctionRecapPdf({allRows}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font      = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const W = 612, H = 792, M = 28;
  const contentW = W - 2*M;
  const GAP = 14;

  // CMS palette
  const NAVY     = rgb(0.098, 0.180, 0.306);   // #192E4E
  const GOLD     = rgb(0.784, 0.627, 0.290);   // #C8A04A
  const INK      = rgb(0.10, 0.11, 0.14);
  const MUTED    = rgb(0.30, 0.32, 0.36);
  const BORDER   = rgb(0.78, 0.80, 0.83);
  const RULE     = rgb(0.86, 0.87, 0.89);
  const PANEL_BG = rgb(0.957, 0.961, 0.969);
  const HEAD_BG  = rgb(0.902, 0.910, 0.922);
  const ROW_ALT  = rgb(0.957, 0.961, 0.969);
  const WHITE    = rgb(1,1,1);

  const page = pdfDoc.addPage([W,H]);

  /* ---------- drawing helpers ---------- */
  function fontFor(kind){ return kind === "serif" ? serifBold : kind === "bold" ? fontBold : font; }
  function text(str, x, y, {size=9, kind="regular", color=INK, align="left"} = {}){
    const s = String(str ?? "");
    const f = fontFor(kind);
    const w = f.widthOfTextAtSize(s, size);
    const dx = align === "right" ? -w : align === "center" ? -w/2 : 0;
    page.drawText(s, { x: x + dx, y, size, font: f, color });
    return w;
  }
  function widthOf(str, size, kind="regular"){ return fontFor(kind).widthOfTextAtSize(String(str), size); }
  function fit(str, maxW, size, kind="regular"){
    let s = safeStr(str);
    if(widthOf(s, size, kind) <= maxW) return s;
    while(s.length > 1 && widthOf(s + "...", size, kind) > maxW) s = s.slice(0, -1);
    return s.trimEnd() + "...";
  }
  // Wrap to at most `max` lines; the last line is truncated if needed.
  function wrapMax(str, maxW, size, max=2){
    const lines = wrapLines(font, str, size, maxW);
    if(lines.length <= max) return lines;
    const out = lines.slice(0, max);
    out[max-1] = fit(lines.slice(max-1).join(" "), maxW, size);
    return out;
  }
  function rect(x, yTop, w, h, {fill, border, bw=0.75} = {}){
    page.drawRectangle({ x, y: yTop - h, width: w, height: h,
      ...(fill ? { color: fill } : {}), ...(border ? { borderColor: border, borderWidth: bw } : {}) });
  }
  function hline(x1, x2, y, color=RULE, thickness=0.6){
    page.drawLine({ start:{x:x1, y}, end:{x:x2, y}, thickness, color });
  }
  function vline(x, y1, y2, color=RULE, thickness=0.6){
    page.drawLine({ start:{x, y:y1}, end:{x, y:y2}, thickness, color });
  }
  const BAR_H = 24;
  function sectionBar(x, yTop, w, title){
    rect(x, yTop, w, BAR_H, { fill: NAVY });
    text(title.toUpperCase(), x + 12, yTop - 17, { size: 14, kind: "serif", color: WHITE });
    return yTop - BAR_H;
  }
  // Grid table: gray header row, full cell borders.
  // cols: [{label, w (fraction), align, kind}]; rows: [[...cells]]
  function gridTable(x, yTop, w, cols, rows, {headH=22, rowH=22, size=10} = {}){
    const xs = []; let cx = x;
    cols.forEach(c => { xs.push(cx); cx += c.w * w; });
    rect(x, yTop, w, headH, { fill: HEAD_BG });
    cols.forEach((c, i) => {
      if(!c.label) return;
      const tx = c.align === "right" ? xs[i] + c.w*w - 10 : c.align === "center" ? xs[i] + c.w*w/2 : xs[i] + 10;
      text(c.label, tx, yTop - headH/2 - 3.5, { size: size, kind: "bold", color: INK, align: c.align });
    });
    let yy = yTop - headH;
    rows.forEach((row) => {
      hline(x, x + w, yy, BORDER);
      cols.forEach((c, i) => {
        const cw = c.w * w;
        const tx = c.align === "right" ? xs[i] + cw - 10 : c.align === "center" ? xs[i] + cw/2 : xs[i] + 10;
        const val = c.align === "left" ? fit(row[i], cw - 16, size, c.kind || "regular") : row[i];
        text(val, tx, yy - rowH/2 - size*0.35, { size, kind: c.kind || "regular", color: INK, align: c.align });
      });
      yy -= rowH;
    });
    for(let i = 1; i < xs.length; i++) vline(xs[i], yTop, yy, BORDER);
    return yy;
  }
  // Icons on a 24-unit grid (SVG coords, y down from top-left).
  function gavelIcon(x, yTop, size, color){
    const scale = size / 24;
    page.drawSvgPath("M6.2 9.6 L11.6 4.2 L16.2 8.8 L10.8 14.2 Z", { x, y: yTop, scale, color });
    page.drawSvgPath("M10.6 2.6 L13.2 0 L17.8 4.6 L15.2 7.2 Z", { x, y: yTop, scale, color });
    page.drawSvgPath("M4.6 11.2 L7.2 8.6 L11.8 13.2 L9.2 15.8 Z", { x, y: yTop, scale, color });
    page.drawSvgPath("M13.4 10.4 L14.8 9 L23.4 17.6 L22 19 Z", { x, y: yTop, scale, color });
    page.drawSvgPath("M1 19.2 L13 19.2 L14 21.4 L14 23.6 L0 23.6 L0 21.4 Z", { x, y: yTop, scale, color });
  }
  function cowIcon(x, yTop, size, color){
    const scale = size / 24;
    page.drawSvgPath(
      "M6.4 7.2 C5.2 5.4 3 4.8 0.8 5.6 C1.2 8.2 3.4 9.6 6 9.6 L7.6 16.8 C8 19.8 9.8 21.6 12 21.6 " +
      "C14.2 21.6 16 19.8 16.4 16.8 L18 9.6 C20.6 9.6 22.8 8.2 23.2 5.6 C21 4.8 18.8 5.4 17.6 7.2 " +
      "C16.2 5.8 14.2 5 12 5 C9.8 5 7.8 5.8 6.4 7.2 Z",
      { x, y: yTop, scale, borderColor: color, borderWidth: 1.4 });
    page.drawSvgPath("M8.4 18.2 C9.4 17.2 14.6 17.2 15.6 18.2", { x, y: yTop, scale, borderColor: color, borderWidth: 1.2 });
  }

  /* ---------- metrics ---------- */
  const H_COL = CONFIG.COLS.head;
  const head = r => toNumber(r[H_COL]);
  const lbs  = r => toNumber(r[H_COL]) * toNumber(r[CONFIG.COLS.baseWeight]);
  const sum  = (rows, fn) => rows.reduce((s, r) => s + fn(r), 0);
  const pct  = (part, whole) => whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0.0%";

  const soldRows = allRows.filter(r => !isPO(r));

  const lotsAdv = allRows.length,       lotsSold = soldRows.length;
  const headAdv = sum(allRows, head),    headSold = sum(soldRows, head);
  const lbsAdv  = sum(allRows, lbs),     lbsSold  = sum(soldRows, lbs);

  const grossSales = sum(soldRows, calculateLotTotal);
  const avgPerHead = headSold > 0 ? grossSales / headSold : 0;

  const prices = soldRows.map(r => toNumber(r[CONFIG.COLS.price])).filter(p => p > 0);
  // Weighted: gross / sold lbs x 100 (matches Buyer/Consignor summaries).
  const avgPrice = aggregateSold(soldRows).avgCwt || 0;
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const weights = soldRows.map(r => toNumber(r[CONFIG.COLS.baseWeight])).filter(w => w > 0);
  const minWt = weights.length ? Math.min(...weights) : 0;
  const maxWt = weights.length ? Math.max(...weights) : 0;
  const avgWt = aggregateSold(soldRows).avgWt || 0;   // weighed head only

  const downMoney = sum(soldRows, r => toNumber(r[CONFIG.COLS.downMoney]));

  const buyers     = new Set(soldRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
  const consignors = new Set(allRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
  const reps       = new Set(allRows.map(r => safeStr(getRepColumn(r))).filter(Boolean));

  function topByHead(keyFn, n=3){
    const m = new Map();
    for(const r of soldRows){
      const k = safeStr(keyFn(r));
      if(!k) continue;
      m.set(k, (m.get(k) || 0) + head(r));
    }
    return Array.from(m.entries()).sort((a,b) => b[1] - a[1]).slice(0, n);
  }
  const topBuyers     = topByHead(r => r[CONFIG.COLS.buyer]);
  const topConsignors = topByHead(r => r[CONFIG.COLS.consignor]);
  const topReps       = topByHead(r => getRepColumn(r));
  const typeMix       = topByHead(r => safeStr(r[CONFIG.COLS.type]) || "Other", Infinity);

  const MONTH_ORDER = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];
  const byMonth = new Map();
  for(const r of soldRows){
    const raw = r["Delivery Start Date"] || r[CONFIG.COLS.delivery];
    const label = deliveryMonthLabel(raw);
    if(!label) continue;
    byMonth.set(label, (byMonth.get(label) || 0) + head(r));
  }
  const delivery = Array.from(byMonth.entries()).sort((a,b) => {
    const ai = MONTH_ORDER.indexOf(a[0]), bi = MONTH_ORDER.indexOf(b[0]);
    if(ai >= 0 && bi >= 0) return ai - bi;
    if(ai >= 0) return -1;
    if(bi >= 0) return 1;
    return b[1] - a[1];
  });

  const money = n => formatMoney(n);
  const num   = n => formatNumber(Math.round(n));

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} - ${extra}` : auctionTitleBase;
  const dateLine = reportDateLine(auctionDate.value);

  /* ---------- 1. HEADER ---------- */
  let y = H - 26;
  const LOGO_H = 52;
  let logoRight = M;
  const logoBytes = await loadReportLogoBytes();
  if(logoBytes){
    try {
      const img = await pdfDoc.embedPng(logoBytes);
      const logoW = LOGO_H * (img.width / img.height);
      page.drawImage(img, { x: M + 6, y: y - LOGO_H, width: logoW, height: LOGO_H });
      logoRight = M + 6 + logoW;
    } catch(e){ /* text-only header */ }
  }
  const divX = Math.max(logoRight + 22, M + 150);
  vline(divX, y - 2, y - LOGO_H + 2, GOLD, 1.5);
  const titleX = divX + 22;
  const titleMaxW = M + contentW - titleX;
  let titleSize = 22;
  while(titleSize > 14 && widthOf("AUCTION PERFORMANCE SUMMARY", titleSize, "serif") > titleMaxW) titleSize -= 0.5;
  text("AUCTION PERFORMANCE SUMMARY", titleX, y - 24, { size: titleSize, kind: "serif", color: NAVY });
  const subtitle = dateLine ? `${dateLine}   |   ${auctionTitle}` : auctionTitle;
  text(fit(subtitle, titleMaxW, 12), titleX, y - 46, { size: 12, color: INK });

  y -= LOGO_H + 10;
  hline(M, M + contentW, y, GOLD, 1.5);
  y -= 12;

  /* ---------- 2. TOP ROW: Gross Sales | Averages ---------- */
  const colW = (contentW - GAP) / 2;
  const leftX = M, rightX = M + colW + GAP;
  const TOP_H = 98;

  // Left: Gross Sales
  rect(leftX, y, colW, TOP_H, { fill: PANEL_BG, border: BORDER });
  gavelIcon(leftX + 16, y - 30, 40, GOLD);
  const gDiv = leftX + 70;
  vline(gDiv, y - 22, y - TOP_H + 22, BORDER, 0.9);
  text("GROSS SALES", gDiv + 14, y - 37, { size: 15, kind: "serif", color: INK });
  const grossStr = money(grossSales);
  let grossSize = 30;
  while(grossSize > 16 && widthOf(grossStr, grossSize, "serif") > colW - (gDiv - leftX) - 26) grossSize -= 0.5;
  text(grossStr, gDiv + 14, y - 70, { size: grossSize, kind: "serif", color: INK });

  // Right: Avg $/Hd + Avg $/Cwt, then four counts
  rect(rightX, y, colW, TOP_H, { fill: PANEL_BG, border: BORDER });
  cowIcon(rightX + 10, y - TOP_H/2 + 20, 40, INK);
  const iDiv = rightX + 60;
  vline(iDiv, y - 12, y - TOP_H + 12, BORDER, 0.9);
  const avgW = (rightX + colW - iDiv) / 2;
  const avgC1 = iDiv + avgW / 2, avgC2 = iDiv + avgW * 1.5;
  vline(iDiv + avgW, y - 12, y - 48, GOLD, 1.2);
  text("Avg $/Hd",  avgC1, y - 20, { size: 12, kind: "serif", color: INK, align: "center" });
  text("Avg $/Cwt", avgC2, y - 20, { size: 12, kind: "serif", color: INK, align: "center" });
  const avgSize = Math.min(22, ...[money(avgPerHead), money(avgPrice)].map(s => 22 * (avgW - 12) / widthOf(s, 22, "serif")));
  text(money(avgPerHead), avgC1, y - 44, { size: avgSize, kind: "serif", color: INK, align: "center" });
  text(money(avgPrice),   avgC2, y - 44, { size: avgSize, kind: "serif", color: INK, align: "center" });
  hline(iDiv + 8, rightX + colW - 8, y - 56, BORDER);
  const counts = [
    ["Head", "Advertised", num(headAdv)],
    ["Head", "Sold",       num(headSold)],
    ["Lbs",  "Advertised", num(lbsAdv)],
    ["Lbs",  "Sold",       num(lbsSold)],
  ];
  const cntX = iDiv + 4;
  const cntW = (rightX + colW - 4 - cntX) / counts.length;
  counts.forEach(([l1, l2, val], i) => {
    const cx = cntX + i * cntW + cntW / 2;
    if(i > 0) vline(cntX + i * cntW, y - 62, y - TOP_H + 8, BORDER);
    text(l1, cx, y - 67, { size: 7.5, color: MUTED, align: "center" });
    text(l2, cx, y - 76, { size: 7.5, color: MUTED, align: "center" });
    const vs = Math.min(11.5, 11.5 * (cntW - 6) / widthOf(val, 11.5, "serif"));
    text(val, cx, y - 90, { size: vs, kind: "serif", color: INK, align: "center" });
  });

  y -= TOP_H + GAP;

  /* ---------- 3. MIDDLE ROW: Overview table | Key Metrics ---------- */
  const metricRows = [
    ["Gross Sales:",    money(grossSales)],
    ["Weight Range:",   minWt ? `${num(minWt)}–${num(maxWt)} lb` : "-"],
    ["Avg Weight:",     avgWt ? `${num(avgWt)} lb` : "-"],
    ["Price Range:",    prices.length ? `${money(minPrice)} – ${money(maxPrice)}/cwt` : "-"],
    ["Average Price:",  prices.length ? `${money(avgPrice)}/cwt` : "-"],
    ["Down Money Due:", money(downMoney)],
  ];
  const KM_ROW = 18;
  const MID_BODY = metricRows.length * KM_ROW;
  const MID_H = BAR_H + MID_BODY;

  // Left: Auction Overview
  rect(leftX, y, colW, MID_H, { border: BORDER });
  let ty = sectionBar(leftX, y, colW, "Auction Overview");
  const ovHead = 30, ovRow = (MID_BODY - ovHead) / 3;
  gridTable(leftX, ty, colW, [
    { label: "",           w: 0.22, align: "left",  kind: "bold" },
    { label: "Advertised", w: 0.28, align: "right" },
    { label: "Sold",       w: 0.26, align: "right" },
    { label: "PO %",       w: 0.24, align: "right" },
  ], [
    ["Head", num(headAdv), num(headSold), pct(headAdv - headSold, headAdv)],
    ["Lbs",  num(lbsAdv),  num(lbsSold),  pct(lbsAdv - lbsSold, lbsAdv)],
    ["Lots", num(lotsAdv), num(lotsSold), pct(lotsAdv - lotsSold, lotsAdv)],
  ], { headH: ovHead, rowH: ovRow, size: 10.5 });

  // Right: Key Metrics
  rect(rightX, y, colW, MID_H, { border: BORDER });
  ty = sectionBar(rightX, y, colW, "Key Metrics");
  metricRows.forEach(([label, val], i) => {
    if(i % 2 === 0) rect(rightX + 0.5, ty, colW - 1, KM_ROW, { fill: ROW_ALT });
    const base = ty - KM_ROW / 2 - 3.6;
    text(label, rightX + 14, base, { size: 10, color: INK });
    text(val, rightX + colW - 14, base, { size: 10, color: INK, align: "right" });
    ty -= KM_ROW;
    if(i < metricRows.length - 1) hline(rightX, rightX + colW, ty, RULE);
  });

  y -= MID_H + GAP;

  /* ---------- 4. PARTICIPATION (full width, 3 equal columns) ---------- */
  const pColW = contentW / 3;
  const P_SIZE = 10;
  const P_LINE = 12;
  const partCols = [
    { title: "Buyers",     count: buyers.size,     top: topBuyers },
    { title: "Consignors", count: consignors.size, top: topConsignors },
    { title: "Reps",       count: reps.size,       top: topReps },
  ].map(col => {
    const padL = 16, padR = 16;
    const items = [0,1,2].map(i => {
      const e = col.top[i];
      if(!e) return { lines: ["—"], hd: "" };
      const hd = `${num(e[1])} hd`;
      const nameW = pColW - padL - padR - 18 - widthOf(hd, P_SIZE) - 10;
      return { lines: wrapMax(e[0], nameW, P_SIZE, 2), hd };
    });
    return { ...col, items, padL, padR };
  });
  const rowHeights = [0,1,2].map(i => Math.max(...partCols.map(c => 8 + c.items[i].lines.length * P_LINE)));
  const P_TOP = 60;
  const PART_H = BAR_H + P_TOP + rowHeights.reduce((s,h) => s+h, 0) + 6;
  rect(M, y, contentW, PART_H, { fill: PANEL_BG, border: BORDER });
  ty = sectionBar(M, y, contentW, "Participation");
  partCols.forEach((col, ci) => {
    const cx = M + ci * pColW;
    const mid = cx + pColW / 2;
    if(ci > 0) vline(cx, ty - 12, y - PART_H + 12, GOLD, 1.2);
    text(num(col.count), mid, ty - 27, { size: 24, kind: "serif", color: INK, align: "center" });
    text(col.title, mid, ty - 44, { size: 13, kind: "serif", color: INK, align: "center" });
    const lx = cx + col.padL, rx = cx + pColW - col.padR;
    hline(lx, rx, ty - 52, GOLD, 1);
    let ry = ty - P_TOP + 2;
    col.items.forEach((it, i) => {
      const rh = rowHeights[i];
      const firstBase = ry - (rh - it.lines.length * P_LINE) / 2 - P_SIZE + 1;
      text(`${i+1}.`, lx, firstBase, { size: P_SIZE, color: INK });
      it.lines.forEach((ln, li) => text(ln, lx + 18, firstBase - li * P_LINE, { size: P_SIZE, color: INK }));
      if(it.hd){
        const midBase = ry - rh / 2 - P_SIZE * 0.35;
        text(it.hd, rx, midBase, { size: P_SIZE, color: INK, align: "right" });
      }
      ry -= rh;
      if(i < 2) hline(lx + 16, rx, ry, BORDER);
    });
  });

  y -= PART_H + GAP;

  /* ---------- 6. FOOTER (reserve space first) ---------- */
  const FOOT_Y = 22;
  hline(M, M + contentW, FOOT_Y + 22, GOLD, 1.2);
  const footer = `CMS LIVESTOCK AUCTION   |   ${(dateLine || "").toUpperCase()}`.replace(/\s+\|\s+$/, "");
  const fSize = 9.5, track = 1.6;
  const chars = footer.split("");
  const fW = chars.reduce((s, ch) => s + widthOf(ch, fSize) + track, -track);
  let fx = W / 2 - fW / 2;
  for(const ch of chars){ text(ch, fx, FOOT_Y, { size: fSize, color: NAVY }); fx += widthOf(ch, fSize) + track; }
  hline(M + 10, W/2 - fW/2 - 18, FOOT_Y + 3, GOLD, 1);
  hline(W/2 + fW/2 + 18, M + contentW - 10, FOOT_Y + 3, GOLD, 1);

  /* ---------- 5. BOTTOM ROW: Cattle Mix | Delivery Schedule ---------- */
  const mixW = contentW * 0.615 - GAP / 2;
  const delW = contentW - mixW - GAP;
  const delX = M + mixW + GAP;
  const bottomH = y - (FOOT_Y + 22 + 12);
  const bodyH = bottomH - BAR_H;

  // Keep everything on one page: past ~11pt rows, roll the smallest
  // buckets into one "Other" row.
  function capRows(list, headH){
    const fitRows = Math.max(2, Math.floor((bodyH - headH) / 12));
    if(list.length <= fitRows) return list;
    const keep = [...list].sort((a,b) => b[1] - a[1]).slice(0, fitRows - 1);
    const kept = new Set(keep.map(e => e[0]));
    const rest = list.filter(e => !kept.has(e[0]));
    return list.filter(e => kept.has(e[0]))
      .concat([[`Other (${rest.length})`, rest.reduce((s, e) => s + e[1], 0)]]);
  }

  function bottomPanel(x, w, title, cols, rows, headH, maxRowH, size){
    rect(x, y, w, bottomH, { border: BORDER });
    const t = sectionBar(x, y, w, title);
    const n = Math.max(rows.length, 1);
    const rowH = Math.min(maxRowH, (bodyH - headH) / n);
    const s = Math.min(size, rowH * 0.62);
    gridTable(x, t, w, cols, rows, { headH, rowH, size: s });
  }

  const mixRows = capRows(typeMix, 30);
  bottomPanel(M, mixW, "Cattle Type / Mix", [
    { label: "Type",           w: 0.46, align: "left" },
    { label: "Sold Head",      w: 0.27, align: "center" },
    { label: "% of Sold Head", w: 0.27, align: "center" },
  ], mixRows.map(([t, hd]) => [t, num(hd), pct(hd, headSold)]), 30, 40, 11);

  const delRows = capRows(delivery, 22);
  bottomPanel(delX, delW, "Delivery Schedule", [
    { label: "Month", w: 0.55, align: "left" },
    { label: "Head",  w: 0.45, align: "center" },
  ], delRows.map(([m, hd]) => [m, num(hd)]), 22, 20, 10);

  return await pdfDoc.save();
}


/* =========================================================================
   CONDENSED LISTINGS
   Table-based format for fitting more lots per page (8-12 lots)
   ========================================================================= */
async function buildCondensedListingPdf({entityName, rows, mode, isPre=false, includePrice=false, showCmsNotes=false}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 792; // Landscape
  const H = 612;
  const M = 30;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.5, 0.5, 0.5);
  const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
  const DARK_GRAY = rgb(0.3, 0.3, 0.3);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 40;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value);

  // Header - matching normal confirmation headers
  const title = isPre ? 
    (mode === "rep" ? "Rep Listing Confirmations" : "Consignor Listing Confirmations") :
    (mode === "rep" ? "Rep Trade Confirmations" : "Consignor Trade Confirmations");
  
  page.drawText(title, { x:M, y, size:12, font:fontBold, color:BLACK });
  y -= 14;
  page.drawText(entityName, { x:M, y, size:11, font:fontBold, color:BLACK });
  y -= 13;
  page.drawText(auctionTitle, { x:M, y, size:9, font, color:DARK_GRAY });
  if(aDate){
    y -= 11;
    page.drawText(aDate, { x:M, y, size:9, font, color:DARK_GRAY });
  }
  y -= 18;

  // Table header
  const headers = includePrice ? 
    ["Lot", "Seller", "Head", "Description", "Sex", "Wt", "Delivery", "Location", "Shrink", "Slide", "Notes", "Price"] :
    ["Lot", "Seller", "Head", "Description", "Sex", "Wt", "Delivery", "Location", "Shrink", "Slide", "Notes"];
  
  // Adjusted widths: decreased Wt/Delivery/Seller/Location/Shrink, increased Description/Notes
  const colWidths = includePrice ?
    [35, 55, 35, 115, 50, 30, 60, 60, 35, 70, 145, 50] :
    [35, 55, 35, 120, 55, 30, 65, 65, 35, 75, 155];

  let x = M;
  for(let i=0; i<headers.length; i++){
    page.drawText(headers[i], { x:x+2, y:y-8, size:7, font:fontBold, color:BLACK });
    x += colWidths[i];
  }
  y -= 14;

  // Draw lots grouped by type
  const sorted = [...rows].sort(sortLots);
  
  // Group by type for headers
  const lotsByType = new Map();
  for(const row of sorted){
    const type = safeStr(row[CONFIG.COLS.type] || row[CONFIG.PRE_COLS.type]) || "Other";
    if(!lotsByType.has(type)) lotsByType.set(type, []);
    lotsByType.get(type).push(row);
  }
  
  // Get type color using existing function
  const getTypeColor = (typeLots) => {
    if(typeLots.length === 0) return rgb(0.85, 0.85, 0.85);
    const hex = pickTypeColorHex(typeLots[0], isPre);
    const [r, g, b] = hexToRgb01(hex);
    return rgb(r, g, b);
  };

  let firstType = true;
  for(const [type, typeLots] of lotsByType.entries()){
    // Type header with colored background
    if(!firstType || y < H - 60){
      if(y < 60){
        page = pdfDoc.addPage([W,H]);
        y = H - 40;
        
        // Redraw column headers
        x = M;
        for(let j=0; j<headers.length; j++){
          page.drawText(headers[j], { x:x+2, y:y-8, size:7, font:fontBold, color:BLACK });
          x += colWidths[j];
        }
        y -= 14;
      }
      
      // Draw type header with white text for dark backgrounds
      const typeColor = getTypeColor(typeLots);
      const typeHex = pickTypeColorHex(typeLots[0], isPre);
      const isBlackX = typeHex === "#202E4A";
      const typeTextColor = isBlackX ? rgb(1, 1, 1) : BLACK;
      const typeH = 14;
      page.drawRectangle({
        x:M, y:y-typeH, width:contentW, height:typeH,
        color:typeColor, borderWidth:0
      });
      page.drawText(type, { x:M+5, y:y-10, size:8, font:fontBold, color:typeTextColor });
      y -= typeH + 2;
    }
    firstType = false;

    let prevConsignor = null;
    let drewThickLine = false;
    for(let i=0; i<typeLots.length; i++){
      const row = typeLots[i];
      const currentConsignor = mode === "rep" ? safeStr(row[CONFIG.COLS.consignor] || row[CONFIG.PRE_COLS.consignor]) : null;
      
      drewThickLine = false;
      // Thick line when consignor changes in rep mode (replaces thin line completely)
      if(mode === "rep" && prevConsignor && currentConsignor !== prevConsignor){
        page.drawLine({ start:{x:M, y:y+2}, end:{x:M+contentW, y:y+2}, thickness:3, color:rgb(0.6, 0.6, 0.6) });
        y -= 3;
        drewThickLine = true;
      }
      
      // Thin gray line between lots (skip if we just drew thick line)
      if(i > 0 && !drewThickLine){
        page.drawLine({ start:{x:M, y:y+2}, end:{x:M+contentW, y:y+2}, thickness:0.5, color:LIGHT_GRAY });
        y -= 3;
      }
      
      prevConsignor = currentConsignor;

      // New page if needed
      if(y < 50){
        page = pdfDoc.addPage([W,H]);
      y = H - 40;
      
      // Redraw headers on new page
      x = M;
      for(let j=0; j<headers.length; j++){
        page.drawText(headers[j], { x:x+2, y:y-8, size:7, font:fontBold, color:BLACK });
        x += colWidths[j];
      }
      y -= 14;
    }

    // Draw row - Description from Breed column, with word wrapping
    const baseFontSize = 6.5; // Same size for all columns
    const lineHeight = 8;
    
    // Helper to wrap text within column width
    const wrapText = (text, maxWidth, fontSize) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for(const word of words){
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if(testWidth <= maxWidth - 6){
          currentLine = testLine;
        } else {
          if(currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if(currentLine) lines.push(currentLine);
      return lines.length > 0 ? lines : [''];
    };
    
    // Get raw values - use Lot Number #2
    const lotNum = safeStr(row[CONFIG.COLS.lotNumber2] || row[CONFIG.COLS.lotNumber] || row[CONFIG.PRE_COLS.lotNumber]);
    const seller = safeStr(row[CONFIG.COLS.consignor] || row[CONFIG.PRE_COLS.consignor]);
    const head = safeStr(row[CONFIG.COLS.head] || row[CONFIG.PRE_COLS.head]);
    const breed = safeStr(row[CONFIG.COLS.breed] || row[CONFIG.PRE_COLS.breed] || row[CONFIG.COLS.description] || row[CONFIG.PRE_COLS.description]);
    const sex = safeStr(row[CONFIG.COLS.sex] || row[CONFIG.PRE_COLS.sex]);
    const wt = safeStr(row[CONFIG.COLS.baseWeight] || row[CONFIG.PRE_COLS.baseWeight]);
    const delivery = safeStr(row[CONFIG.COLS.delivery] || row[CONFIG.PRE_COLS.delivery]);
    const location = safeStr(row[CONFIG.COLS.location] || row[CONFIG.PRE_COLS.location]);
    const shrink = safeStr(row[CONFIG.COLS.shrink] || row[CONFIG.PRE_COLS.shrink]);
    const slide = safeStr(row[CONFIG.COLS.slide] || row[CONFIG.PRE_COLS.slide]);
    const notes = (safeStr(row[CONFIG.COLS.description] || row[CONFIG.PRE_COLS.description]) + " " + safeStr(row[CONFIG.COLS.secondDescription] || "")).trim();
    
    // Wrap text for each column - all use same font size now
    const wrappedValues = [
      { lines: wrapText(lotNum, colWidths[0], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(seller, colWidths[1], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(head, colWidths[2], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(breed, colWidths[3], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(sex, colWidths[4], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(wt, colWidths[5], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(delivery, colWidths[6], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(location, colWidths[7], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(shrink, colWidths[8], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(slide, colWidths[9], baseFontSize), fontSize: baseFontSize },
      { lines: wrapText(notes, colWidths[10], baseFontSize), fontSize: baseFontSize }
    ];
    
    if(includePrice){
      const priceVal = isPO(row) ? "PO" : priceDisplay(row[CONFIG.COLS.price]);
      wrappedValues.push({ lines: wrapText(priceVal, colWidths[11], baseFontSize), fontSize: baseFontSize });
    }
    
    // Calculate max lines needed for this row
    const maxLines = Math.max(...wrappedValues.map(v => v.lines.length));
    const rowHeight = maxLines * lineHeight + 2;
    
    // Check if we need a new page
    if(y - rowHeight < 50){
      page = pdfDoc.addPage([W,H]);
      y = H - 40;
      
      // Redraw headers on new page
      x = M;
      for(let j=0; j<headers.length; j++){
        page.drawText(headers[j], { x:x+2, y:y-8, size:7, font:fontBold, color:BLACK });
        x += colWidths[j];
      }
      y -= 14;
    }

    // Draw all lines for this row
    for(let lineIdx = 0; lineIdx < maxLines; lineIdx++){
      x = M;
      for(let colIdx = 0; colIdx < wrappedValues.length; colIdx++){
        const column = wrappedValues[colIdx];
        const text = column.lines[lineIdx] || '';
        page.drawText(text, { x:x+2, y:y-7, size:column.fontSize, font, color:BLACK });
        x += colWidths[colIdx];
      }
      y -= lineHeight;
    }

    // Add CMS External Notes if enabled (below the row)
    if(showCmsNotes){
      const cmsNotes = safeStr(row[CONFIG.COLS.cmsExternalNotes]);
      if(cmsNotes){
        const cmsText = `CMS Notes: ${cmsNotes}`;
        const maxW = contentW - 4;
        const cmsSize = 6;
        const cmsLineHeight = 7;
        
        // Simple word wrapping for CMS notes
        const words = cmsText.split(' ');
        let currentLine = '';
        const cmsLines = [];
        
        for(const word of words){
          const testLine = currentLine ? currentLine + ' ' + word : word;
          const testWidth = fontBold.widthOfTextAtSize(testLine, cmsSize);
          
          if(testWidth <= maxW){
            currentLine = testLine;
          } else {
            if(currentLine) cmsLines.push(currentLine);
            currentLine = word;
          }
        }
        if(currentLine) cmsLines.push(currentLine);
        
        // Draw CMS notes in bold, slightly indented
        for(const line of cmsLines){
          page.drawText(line, { x:M+4, y:y-6, size:cmsSize, font:fontBold, color:DARK_GRAY });
          y -= cmsLineHeight;
        }
        y -= 2; // Extra space after CMS notes
      }
    }

    y -= 6; // Increased spacing after row (was 2)
    }
  }

  return await pdfDoc.save();
}


/* ---------------- DOWNLOAD / ZIP ---------------- */
function downloadBytes(bytes, filename, mime="application/pdf"){
  const blob = new Blob([bytes], {type:mime});
  const url = URL.createObjectURL(blob);
  blobUrls.push(url);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{
    try{ URL.revokeObjectURL(url); }catch{}
    blobUrls = blobUrls.filter(u => u !== url);
  }, 20000);
}

async function downloadZip(items, zipName, folderName=null){
  const zip = new JSZip();
  
  // If folder name provided, create subfolder structure
  const folder = folderName ? zip.folder(folderName) : zip;
  
  for(const it of items) folder.file(it.filename, it.bytes);

  const blob = await zip.generateAsync({type:"blob"});
  const url = URL.createObjectURL(blob);
  blobUrls.push(url);

  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{
    try{ URL.revokeObjectURL(url); }catch{}
    blobUrls = blobUrls.filter(u => u !== url);
  }, 25000);
}

/* ---------------- RESULTS RENDER ---------------- */
function renderList(container, items){
  container.innerHTML = "";
  if(items.length === 0){
    const div = document.createElement("div");
    div.className = "muted small";
    div.textContent = "None generated.";
    container.appendChild(div);
    return;
  }

  for(const it of items){
    const row = document.createElement("div");
    row.className = "listItem";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "listName";
    name.textContent = it.filename;

    const meta = document.createElement("div");
    meta.className = "listMeta";
    meta.textContent = `${it.count || 1} item(s)`;

    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn btnSmall";
    btn.textContent = "Download";
    btn.addEventListener("click", ()=> downloadBytes(it.bytes, it.filename, "application/pdf"));

    row.appendChild(left);
    row.appendChild(btn);
    container.appendChild(row);
  }
}

function renderResults(){
  const total =
    generated.buyerReports.length +
    generated.buyerReportsCondensed.length +
    generated.lotByLot.length +
    generated.buyerContracts.length +
    generated.sellerContracts.length +
    generated.buyerContractsGrouped.length +
    generated.consignorContractsGrouped.length +
    generated.consignorReports.length +
    generated.consignorReportsCondensed.length +
    generated.repReports.length +
    generated.repReportsCondensed.length +
    generated.preConsignorReports.length +
    generated.preConsignorReportsCondensed.length +
    generated.preRepReports.length +
    generated.preRepReportsCondensed.length +
    generated.salesByConsignor.length +
    generated.salesByBuyer.length +
    generated.salesByRep.length +
    (generated.completeBuyer ? 1 : 0) +
    (generated.completeConsignor ? 1 : 0) +
    (generated.completeRep ? 1 : 0) +
    (generated.auctionRecap ? 1 : 0);

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  // Render regular and condensed to same lists
  renderList(listBuyerReports, [...generated.buyerReports, ...generated.buyerReportsCondensed]);
  renderList(listLotByLot, generated.lotByLot);
  renderList(listBuyerContracts, generated.buyerContracts);
  renderList(listSellerContracts, generated.sellerContracts);
  renderList(listBuyerContractsGrouped, generated.buyerContractsGrouped);
  renderList(listConsignorContractsGrouped, generated.consignorContractsGrouped);
  renderList(listConsignorReports, [...generated.consignorReports, ...generated.consignorReportsCondensed]);
  renderList(listRepReports, [...generated.repReports, ...generated.repReportsCondensed]);
  renderList(listPreConsignorReports, [...generated.preConsignorReports, ...generated.preConsignorReportsCondensed]);
  renderList(listPreRepReports, [...generated.preRepReports, ...generated.preRepReportsCondensed]);
  
  // Special reports
  renderList(listSalesByConsignor, generated.salesByConsignor);
  renderList(listSalesByBuyer, generated.salesByBuyer);
  renderList(listSalesByRep, generated.salesByRep);
  renderList(listCompleteBuyer, generated.completeBuyer ? [generated.completeBuyer] : []);
  renderList(listCompleteConsignor, generated.completeConsignor ? [generated.completeConsignor] : []);
  renderList(listCompleteRep, generated.completeRep ? [generated.completeRep] : []);
  renderList(listAuctionRecap, generated.auctionRecap ? [generated.auctionRecap] : []);

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
  zipBuyerContracts.disabled = generated.buyerContracts.length === 0;
  zipSellerContracts.disabled = generated.sellerContracts.length === 0;
  zipBuyerContractsGrouped.disabled = generated.buyerContractsGrouped.length === 0;
  zipConsignorContractsGrouped.disabled = generated.consignorContractsGrouped.length === 0;
  zipConsignorReports.disabled = generated.consignorReports.length === 0;
  zipRepReports.disabled = generated.repReports.length === 0;
  zipPreConsignorReports.disabled = generated.preConsignorReports.length === 0;
  zipPreRepReports.disabled = generated.preRepReports.length === 0;
  
  // Special reports ZIP buttons
  zipSalesByConsignor.disabled = generated.salesByConsignor.length === 0;
  zipSalesByBuyer.disabled = generated.salesByBuyer.length === 0;
  zipSalesByRep.disabled = generated.salesByRep.length === 0;
  
  const hasSpecialReports = generated.salesByConsignor.length > 0 || 
                            generated.salesByBuyer.length > 0 || 
                            generated.salesByRep.length > 0 ||
                            generated.completeBuyer ||
                            generated.completeConsignor ||
                            generated.auctionRecap;
  zipSpecialReports.disabled = !hasSpecialReports;
  
  zipAll.disabled = total === 0;
}


/* ---------------- SECTION SELECT/DESELECT ALL ---------------- */
function wireSectionSelectors(){
  // Pre-Auction
  const selectAllPre = document.getElementById("selectAllPre");
  const deselectAllPre = document.getElementById("deselectAllPre");
  if(selectAllPre){
    selectAllPre.addEventListener("click", (e) => {
      e.preventDefault();
      chkPreConsignor.checked = true;
      chkPreConsignorCondensed.checked = true;
      chkPreRep.checked = true;
      chkPreRepCondensed.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllPre){
    deselectAllPre.addEventListener("click", (e) => {
      e.preventDefault();
      chkPreConsignor.checked = false;
      chkPreConsignorCondensed.checked = false;
      chkPreRep.checked = false;
      chkPreRepCondensed.checked = false;
      setBuildEnabled();
    });
  }

  // Post-Auction
  const selectAllPost = document.getElementById("selectAllPost");
  const deselectAllPost = document.getElementById("deselectAllPost");
  if(selectAllPost){
    selectAllPost.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyer.checked = true;
      chkBuyerCondensed.checked = true;
      chkLotByLot.checked = true;
      chkConsignor.checked = true;
      chkConsignorCondensed.checked = true;
      chkRep.checked = true;
      chkRepCondensed.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllPost){
    deselectAllPost.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyer.checked = false;
      chkBuyerCondensed.checked = false;
      chkLotByLot.checked = false;
      chkConsignor.checked = false;
      chkConsignorCondensed.checked = false;
      chkRep.checked = false;
      chkRepCondensed.checked = false;
      setBuildEnabled();
    });
  }

  // Contracts
  const selectAllContracts = document.getElementById("selectAllContracts");
  const deselectAllContracts = document.getElementById("deselectAllContracts");
  if(selectAllContracts){
    selectAllContracts.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyerContracts.checked = true;
      chkSellerContracts.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllContracts){
    deselectAllContracts.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyerContracts.checked = false;
      chkSellerContracts.checked = false;
      setBuildEnabled();
    });
  }

  // Special Reports
  const selectAllSpecial = document.getElementById("selectAllSpecial");
  const deselectAllSpecial = document.getElementById("deselectAllSpecial");
  if(selectAllSpecial){
    selectAllSpecial.addEventListener("click", (e) => {
      e.preventDefault();
      chkSalesByConsignor.checked = true;
      chkSalesByBuyer.checked = true;
      chkSalesByRep.checked = true;
      chkCompleteBuyer.checked = true;
      chkCompleteConsignor.checked = true;
      chkCompleteRep.checked = true;
      chkAuctionRecap.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllSpecial){
    deselectAllSpecial.addEventListener("click", (e) => {
      e.preventDefault();
      chkSalesByConsignor.checked = false;
      chkSalesByBuyer.checked = false;
      chkSalesByRep.checked = false;
      chkCompleteBuyer.checked = false;
      chkCompleteConsignor.checked = false;
      chkCompleteRep.checked = false;
      chkAuctionRecap.checked = false;
      setBuildEnabled();
    });
  }
}

/* ---------------- BUILD ---------------- */
function wireBuild(){
  buildBtn.addEventListener("click", async ()=>{
    setError(builderError, "");
    buildBtn.disabled = true;
    buildBtn.textContent = "Generating…";

    const errors = []; // Track errors

    try{
      assertLibsLoaded();
      if(csvRows.length === 0) throw new Error("Upload a CSV first.");

      const anyChecked =
        chkBuyer.checked ||
        chkConsignor.checked ||
        chkRep.checked ||
        chkLotByLot.checked ||
        chkBuyerContracts.checked ||
        chkSellerContracts.checked ||
        chkPreConsignor.checked ||
        chkPreRep.checked ||
        chkSalesByConsignor.checked ||
        chkSalesByBuyer.checked ||
        chkSalesByRep.checked ||
        chkCompleteBuyer.checked ||
        chkCompleteConsignor.checked ||
        chkAuctionRecap.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      generated = { 
        buyerReports:[], 
        buyerReportsCondensed: [],
        lotByLot:[], 
        buyerContracts:[], 
        sellerContracts:[], 
        buyerContractsGrouped: [],
        consignorContractsGrouped: [],
        consignorReports:[], 
        consignorReportsCondensed: [],
        repReports:[],
        repReportsCondensed: [],
        preConsignorReports: [],
        preConsignorReportsCondensed: [],
        preRepReports: [],
        preRepReportsCondensed: [],
        salesByConsignor: [],
        salesByBuyer: [],
        salesByRep: [],
        completeBuyer: null,
        completeConsignor: null,
        completeRep: null,
        auctionRecap: null,
      };

      // POST-AUCTION GENERATION
      const postAuctionRequested = chkBuyer.checked || chkConsignor.checked || chkRep.checked || 
                                   chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked ||
                                   chkBuyerContractsGrouped.checked || chkConsignorContractsGrouped.checked;

      if(postAuctionRequested){
        const chk = requiredColsPresent(csvRows);
        if(!chk.ok) throw new Error(`CSV missing required column(s) for post-auction: ${chk.missing.join(", ")}`);
        
        contractColName = detectContractColumn(csvRows);
        if(!contractColName) throw new Error(`CSV is missing a Contract column. Expected one of: ${CONFIG.CONTRACT_COL_CANDIDATES.join(", ")}`);

        const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
        const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
        
        // Check for rep in both Representative and Rep columns
        const repRows = csvRows.filter(r => {
          const rep = getRepColumn(r);
          return safeStr(rep) !== "";
        });
        const byRep = new Map();
        for(const r of repRows){
          const rep = safeStr(getRepColumn(r));
          if(!rep) continue;
          if(!byRep.has(rep)) byRep.set(rep, []);
          byRep.get(rep).push(r);
        }

        if(chkBuyer.checked){
          for(const [buyer, rows] of byBuyer.entries()){
            if(!buyer) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: buyer, rows, mode:"buyer", singleLotMode:false, forceBuyerName:buyer });
              generated.buyerReports.push({ filename: `${fileSafeName(buyer)}-Buyer Recap.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Buyer Report for "${buyer}": ${err.message}`);
            }
          }
        }
        
        if(chkBuyerCondensed.checked){
          for(const [buyer, rows] of byBuyer.entries()){
            if(!buyer) continue;
            try{
              const condensedBytes = await buildCondensedListingPdf({ entityName: buyer, rows, mode:"buyer", isPre:false, includePrice:true });
              generated.buyerReportsCondensed.push({ filename: `${fileSafeName(buyer)}-Buyer Recap-CONDENSED.pdf`, bytes: condensedBytes, count: rows.length });
            } catch(err){
              errors.push(`Buyer Report Condensed for "${buyer}": ${err.message}`);
            }
          }
        }

        if(chkLotByLot.checked){
          // Read selected banner color from UI
          const selectedColorEl = document.querySelector('input[name="lotByLotColor"]:checked');
          const lotByLotBannerColor = selectedColorEl ? selectedColorEl.value : CONFIG.COLORS.cmsBlue;

          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
            try{
              const bytes = await buildPdfForGroup({
                entityName: buyer,
                rows: [row],
                mode: "buyer",
                singleLotMode: true,
                forceBuyerName: buyer,
                headerRightBig: `Contract # ${contract}`,
                lotByLotBannerColorHex: lotByLotBannerColor
              });
              generated.lotByLot.push({ filename: `${fileSafeName(contract)}-Contract-Details.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Contract Details for "${contract}": ${err.message}`);
            }
          }
        }

        if(chkBuyerContracts.checked){
          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
            try{
              const bytes = await buildSalesContractPdf({ row, side:"buyer" });
              generated.buyerContracts.push({ filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Buyer Contract "${contract}": ${err.message}`);
            }
          }
        }

        if(chkSellerContracts.checked){
          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const seller = safeStr(row[CONFIG.COLS.consignor]) || "Seller";
            try{
              const bytes = await buildSalesContractPdf({ row, side:"seller" });
              generated.sellerContracts.push({ filename: `${fileSafeName(contract)}-${fileSafeName(seller)}-Consignor-Contract.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Seller Contract "${contract}": ${err.message}`);
            }
          }
        }

        if(chkBuyerContractsGrouped.checked){
          const byBuyer = groupBy(csvRows.filter(r => getContract(r)), CONFIG.COLS.buyer);
          for(const [buyer, rows] of byBuyer.entries()){
            if(!buyer) continue;
            // Generate individual PDFs for each contract, stored grouped by buyer
            for(const row of rows){
              const contract = safeStr(getContract(row)) || "Contract";
              try{
                const bytes = await buildSalesContractPdf({ row, side:"buyer" });
                generated.buyerContractsGrouped = generated.buyerContractsGrouped || [];
                generated.buyerContractsGrouped.push({ 
                  filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`, 
                  bytes, 
                  count: 1,
                  groupName: buyer // Used for ZIP folder organization
                });
              } catch(err){
                errors.push(`Grouped Buyer Contract "${contract}" for "${buyer}": ${err.message}`);
              }
            }
          }
        }

        if(chkConsignorContractsGrouped.checked){
          const byConsignor = groupBy(csvRows.filter(r => getContract(r)), CONFIG.COLS.consignor);
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            // Generate individual PDFs for each contract, stored grouped by consignor
            for(const row of rows){
              const contract = safeStr(getContract(row)) || "Contract";
              try{
                const bytes = await buildSalesContractPdf({ row, side:"seller" });
                generated.consignorContractsGrouped = generated.consignorContractsGrouped || [];
                generated.consignorContractsGrouped.push({ 
                  filename: `${fileSafeName(contract)}-${fileSafeName(consignor)}-Consignor-Contract.pdf`, 
                  bytes, 
                  count: 1,
                  groupName: consignor // Used for ZIP folder organization
                });
              } catch(err){
                errors.push(`Grouped Consignor Contract "${contract}" for "${consignor}": ${err.message}`);
              }
            }
          }
        }

        if(chkConsignor.checked){
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: consignor, rows, mode:"consignor", showCmsNotes: chkShowConsignorCmsNotes.checked });
              generated.consignorReports.push({ filename: `Trade Confirmations-${fileSafeName(consignor)}.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Consignor Report for "${consignor}": ${err.message}`);
            }
          }
        }
        
        if(chkConsignorCondensed.checked){
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const condensedBytes = await buildCondensedListingPdf({ entityName: consignor, rows, mode:"consignor", isPre:false, includePrice:true, showCmsNotes: chkShowConsignorCondensedCmsNotes.checked });
              generated.consignorReportsCondensed.push({ filename: `Trade Confirmations-${fileSafeName(consignor)}-CONDENSED.pdf`, bytes: condensedBytes, count: rows.length });
            } catch(err){
              errors.push(`Consignor Report Condensed for "${consignor}": ${err.message}`);
            }
          }
        }

        if(chkRep.checked){
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: rep, rows, mode:"rep", showCmsNotes: chkShowCmsNotes.checked });
              generated.repReports.push({ filename: `Rep-${fileSafeName(rep)}-Trade Confirmations.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Rep Report for "${rep}": ${err.message}`);
            }
          }
        }
        
        if(chkRepCondensed.checked){
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const condensedBytes = await buildCondensedListingPdf({ entityName: rep, rows, mode:"rep", isPre:false, includePrice:true, showCmsNotes: chkShowRepCondensedCmsNotes.checked });
              generated.repReportsCondensed.push({ filename: `Rep-${fileSafeName(rep)}-Trade Confirmations-CONDENSED.pdf`, bytes: condensedBytes, count: rows.length });
            } catch(err){
              errors.push(`Rep Report Condensed for "${rep}": ${err.message}`);
            }
          }
        }
      }

      // PRE-AUCTION GENERATION
      if(chkPreConsignor.checked || chkPreRep.checked){
        // Pre-auction doesn't require all the post-auction columns
        const row0 = csvRows[0] || {};
        const keys = new Set(Object.keys(row0));
        const requiredPreCols = [
          CONFIG.PRE_COLS.consignor,
          CONFIG.PRE_COLS.head,
          CONFIG.PRE_COLS.sex,
          CONFIG.PRE_COLS.delivery,
          CONFIG.PRE_COLS.location,
        ];
        const missingPre = requiredPreCols.filter(c => !keys.has(c));
        if(missingPre.length > 0){
          throw new Error(`CSV missing required columns for pre-auction: ${missingPre.join(", ")}`);
        }

        if(chkPreConsignor.checked){
          const byConsignor = groupBy(csvRows, CONFIG.PRE_COLS.consignor);
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const bytes = await buildPreAuctionListingPdf({ entityName: consignor, rows, mode:"consignor", showCmsNotes: chkShowPreConsignorCmsNotes.checked });
              generated.preConsignorReports.push({ 
                filename: `Listing-Confirmations-${fileSafeName(consignor)}.pdf`, 
                bytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Consignor for "${consignor}": ${err.message}`);
            }
          }
        }
        
        if(chkPreConsignorCondensed.checked){
          const byConsignor = groupBy(csvRows, CONFIG.PRE_COLS.consignor);
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const condensedBytes = await buildCondensedListingPdf({ entityName: consignor, rows, mode:"consignor", isPre:true, includePrice:false, showCmsNotes: chkShowPreConsignorCondensedCmsNotes.checked });
              generated.preConsignorReportsCondensed.push({ 
                filename: `Listing-Confirmations-${fileSafeName(consignor)}-CONDENSED.pdf`, 
                bytes: condensedBytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Consignor Condensed for "${consignor}": ${err.message}`);
            }
          }
        }

        if(chkPreRep.checked){
          const repRows = csvRows.filter(r => safeStr(r[CONFIG.PRE_COLS.rep]) !== "");
          const byRep = groupBy(repRows, CONFIG.PRE_COLS.rep);
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const bytes = await buildPreAuctionListingPdf({ entityName: rep, rows, mode:"rep", showCmsNotes: chkShowPreRepCmsNotes.checked });
              generated.preRepReports.push({ 
                filename: `Rep-${fileSafeName(rep)}-Listing-Confirmations.pdf`, 
                bytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Rep for "${rep}": ${err.message}`);
            }
          }
        }
        
        if(chkPreRepCondensed.checked){
          const repRows = csvRows.filter(r => safeStr(r[CONFIG.PRE_COLS.rep]) !== "");
          const byRep = groupBy(repRows, CONFIG.PRE_COLS.rep);
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const condensedBytes = await buildCondensedListingPdf({ entityName: rep, rows, mode:"rep", isPre:true, includePrice:false, showCmsNotes: chkShowPreRepCondensedCmsNotes.checked });
              generated.preRepReportsCondensed.push({ 
                filename: `Rep-${fileSafeName(rep)}-Listing-Confirmations-CONDENSED.pdf`, 
                bytes: condensedBytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Rep Condensed for "${rep}": ${err.message}`);
            }
          }
        }

        // PRE-AUCTION SPECIAL REPORTS
      }

      // SPECIAL REPORTS GENERATION
      const specialReportsRequested = chkSalesByConsignor.checked || chkSalesByBuyer.checked || chkSalesByRep.checked ||
                                      chkCompleteBuyer.checked || chkCompleteConsignor.checked || chkAuctionRecap.checked;

      if(specialReportsRequested){
        // These all require contract column
        const chk = requiredColsPresent(csvRows);
        if(!chk.ok) throw new Error(`CSV missing required column(s) for special reports: ${chk.missing.join(", ")}`);
        
        contractColName = detectContractColumn(csvRows);
        if(!contractColName) throw new Error(`CSV is missing a Contract column for special reports.`);

        const soldRows = csvRows.filter(r => !isPO(r));

        // Sales Summary by Consignor
        if(chkSalesByConsignor.checked){
          const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const bytes = await buildSalesSummaryPdf({ entityName: consignor, rows, mode: "consignor" });
              generated.salesByConsignor.push({ filename: `Sales-Summary-${fileSafeName(consignor)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Sales Summary for Consignor "${consignor}": ${err.message}`);
            }
          }
        }

        // Sales Summary by Buyer
        if(chkSalesByBuyer.checked){
          const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
          for(const [buyer, rows] of byBuyer.entries()){
            if(!buyer) continue;
            try{
              const bytes = await buildSalesSummaryPdf({ entityName: buyer, rows, mode: "buyer" });
              generated.salesByBuyer.push({ filename: `Sales-Summary-${fileSafeName(buyer)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Sales Summary for Buyer "${buyer}": ${err.message}`);
            }
          }
        }

        // Sales Summary by Rep
        if(chkSalesByRep.checked){
          const repRows = csvRows.filter(r => getRepColumn(r));
          const byRep = new Map();
          for(const r of repRows){
            const rep = safeStr(getRepColumn(r));
            if(!rep) continue;
            if(!byRep.has(rep)) byRep.set(rep, []);
            byRep.get(rep).push(r);
          }
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const bytes = await buildSalesSummaryPdf({ entityName: rep, rows, mode: "rep" });
              generated.salesByRep.push({ filename: `Sales-Summary-${fileSafeName(rep)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Sales Summary for Rep "${rep}": ${err.message}`);
            }
          }
        }

        // Complete Buyer Summary
        if(chkCompleteBuyer.checked){
          try{
            const bytes = await buildPartySummaryPdf({ allRows: csvRows, mode: "buyer" });
            generated.completeBuyer = { filename: "Complete-Buyer-Summary.pdf", bytes, count: 1 };
          } catch(err){
            errors.push(`Complete Buyer Summary: ${err.message}`);
          }
        }

        // Complete Consignor Summary
        if(chkCompleteConsignor.checked){
          try{
            const bytes = await buildPartySummaryPdf({ allRows: csvRows, mode: "consignor" });
            generated.completeConsignor = { filename: "Complete-Consignor-Summary.pdf", bytes, count: 1 };
          } catch(err){
            errors.push(`Complete Consignor Summary: ${err.message}`);
          }
        }

        // Complete Rep Summary
        if(chkCompleteRep.checked){
          try{
            // Create byRep Map for this report
            const repRows = csvRows.filter(r => {
              const rep = getRepColumn(r);
              return safeStr(rep) !== "";
            });
            const byRep = new Map();
            for(const r of repRows){
              const rep = safeStr(getRepColumn(r));
              if(!rep) continue;
              if(!byRep.has(rep)) byRep.set(rep, []);
              byRep.get(rep).push(r);
            }
            
            const summaries = [];
            
            if(byRep && byRep.size > 0){
              // Build sold summaries
              for(const [rep, rows] of byRep.entries()){
                if(!rep || rep.trim() === "") continue;
                const soldReps = rows.filter(r => !isPO(r));
                if(soldReps.length > 0){
                  const lotCount = soldReps.length;
                  const totalHead = soldReps.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
                  const totalSales = soldReps.reduce((sum, r) => sum + calculateLotTotal(r), 0);
                  summaries.push({ name: rep, lotCount, totalHead, totalSales, isPO: false });
                }
              }
              
              // Add PO/SCRATCH reps at the bottom
              for(const [rep, rows] of byRep.entries()){
                if(!rep || rep.trim() === "") continue;
                const poReps = rows.filter(r => isPO(r));
                if(poReps.length > 0){
                  const lotCount = poReps.length;
                  const totalHead = poReps.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
                  summaries.push({ name: rep, lotCount, totalHead, totalSales: 0, isPO: true });
                }
              }
            }
            
            // Generate even if empty (will show "No reps" in PDF)
            const bytes = await buildCompleteSummaryPdf({ summaries, mode: "rep" });
            generated.completeRep = { filename: "Complete-Rep-Summary.pdf", bytes, count: 1 };
          } catch(err){
            errors.push(`Complete Rep Summary: ${err.message}`);
          }
        }

        // Auction Recap Summary
        if(chkAuctionRecap.checked){
          try{
            const bytes = await buildAuctionRecapPdf({ allRows: csvRows });
            generated.auctionRecap = { filename: "Auction-Recap-Summary.pdf", bytes, count: 1 };
          } catch(err){
            errors.push(`Auction Recap Summary: ${err.message}`);
          }
        }
      }

      // Show errors if any — a blocking alert() used to stand in here,
      // which happened to force the operator to see the failure list
      // before the code below navigated to the Results page (since
      // alert() blocks until dismissed). Replaced with the existing
      // non-blocking error banner; preserving "see the failures before
      // moving on" now means explicitly not auto-navigating to Results
      // when there were any, rather than setting a banner there and
      // immediately switching away from the page that shows it.
      //
      // Whichever report types succeeded already have real PDF bytes
      // (each type generated in its own try/catch above) — render them
      // into the Results page's lists either way, so nothing that did
      // work is hidden by a partial failure elsewhere.
      renderResults();
      if(errors.length > 0){
        const errorMsg = `${errors.length} PDF(s) failed to generate:\n\n${errors.map((e,i) => `${i+1}. ${e}`).join('\n')}`;
        setError(builderError, errorMsg);
      } else {
        goto(pageResults);
      }

    } catch(err){
      console.error(err);
      setError(builderError, `Generation error: ${err.message || err}`);
    } finally {
      buildBtn.disabled = false;
      buildBtn.textContent = "Generate PDFs";
      setBuildEnabled();
    }
  });

  zipBuyerReports.addEventListener("click", async ()=> {
    const all = [...generated.buyerReports, ...generated.buyerReportsCondensed];
    if(all.length) downloadZip(all, "Buyer-Reports.zip");
  });
  zipLotByLot.addEventListener("click", async ()=> generated.lotByLot.length && downloadZip(generated.lotByLot, "Contract-Details.zip"));
  zipBuyerContracts.addEventListener("click", async ()=> generated.buyerContracts.length && downloadZip(generated.buyerContracts, "Buyer-Contracts.zip"));
  zipSellerContracts.addEventListener("click", async ()=> generated.sellerContracts.length && downloadZip(generated.sellerContracts, "Seller-Contracts.zip"));
  zipBuyerContractsGrouped.addEventListener("click", async ()=> {
    if (!generated.buyerContractsGrouped.length) return;
    
    // Group files by buyer name
    const zip = new JSZip();
    const byBuyer = {};
    
    for(const item of generated.buyerContractsGrouped){
      const groupName = item.groupName || "Unknown";
      if(!byBuyer[groupName]) byBuyer[groupName] = [];
      byBuyer[groupName].push(item);
    }
    
    // Create a folder for each buyer
    for(const [buyer, items] of Object.entries(byBuyer)){
      const folder = zip.folder(fileSafeName(buyer));
      for(const it of items) folder.file(it.filename, it.bytes);
    }
    
    const blob = await zip.generateAsync({type:"blob"});
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Buyer-Contracts-Grouped.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} blobUrls = blobUrls.filter(u => u !== url); }, 25000);
  });
  
  zipConsignorContractsGrouped.addEventListener("click", async ()=> {
    if (!generated.consignorContractsGrouped.length) return;
    
    // Group files by consignor name
    const zip = new JSZip();
    const byConsignor = {};
    
    for(const item of generated.consignorContractsGrouped){
      const groupName = item.groupName || "Unknown";
      if(!byConsignor[groupName]) byConsignor[groupName] = [];
      byConsignor[groupName].push(item);
    }
    
    // Create a folder for each consignor
    for(const [consignor, items] of Object.entries(byConsignor)){
      const folder = zip.folder(fileSafeName(consignor));
      for(const it of items) folder.file(it.filename, it.bytes);
    }
    
    const blob = await zip.generateAsync({type:"blob"});
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Consignor-Contracts-Grouped.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} blobUrls = blobUrls.filter(u => u !== url); }, 25000);
  });
  zipConsignorReports.addEventListener("click", async ()=> {
    const all = [...generated.consignorReports, ...generated.consignorReportsCondensed];
    if(all.length) downloadZip(all, "Consignor-Reports.zip");
  });
  zipRepReports.addEventListener("click", async ()=> {
    const all = [...generated.repReports, ...generated.repReportsCondensed];
    if(all.length) downloadZip(all, "Rep-Reports.zip");
  });
  zipPreConsignorReports.addEventListener("click", async ()=> {
    const all = [...generated.preConsignorReports, ...generated.preConsignorReportsCondensed];
    if(all.length) downloadZip(all, "Listing-Confirmations-Consignor.zip");
  });
  zipPreRepReports.addEventListener("click", async ()=> {
    const all = [...generated.preRepReports, ...generated.preRepReportsCondensed];
    if(all.length) downloadZip(all, "Listing-Confirmations-Rep.zip");
  });

  // Special Reports ZIP handlers
  zipSalesByConsignor.addEventListener("click", async ()=> generated.salesByConsignor.length && downloadZip(generated.salesByConsignor, "Sales-Summaries-Consignor.zip"));
  zipSalesByBuyer.addEventListener("click", async ()=> generated.salesByBuyer.length && downloadZip(generated.salesByBuyer, "Sales-Summaries-Buyer.zip"));
  zipSalesByRep.addEventListener("click", async ()=> generated.salesByRep.length && downloadZip(generated.salesByRep, "Sales-Summaries-Rep.zip"));

  zipSpecialReports.addEventListener("click", async ()=>{
    const zip = new JSZip();
    const folder = zip.folder("Special-Reports");
    
    for(const it of generated.salesByConsignor) folder.file(it.filename, it.bytes);
    for(const it of generated.salesByBuyer) folder.file(it.filename, it.bytes);
    for(const it of generated.salesByRep) folder.file(it.filename, it.bytes);
    if(generated.completeBuyer) folder.file(generated.completeBuyer.filename, generated.completeBuyer.bytes);
    if(generated.completeConsignor) folder.file(generated.completeConsignor.filename, generated.completeConsignor.bytes);
    if(generated.completeRep) folder.file(generated.completeRep.filename, generated.completeRep.bytes);
    if(generated.auctionRecap) folder.file(generated.auctionRecap.filename, generated.auctionRecap.bytes);

    if(Object.keys(zip.files).length > 0){
      const blob = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Special-Reports.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>{
        try{ URL.revokeObjectURL(url); }catch{}
        blobUrls = blobUrls.filter(u => u !== url);
      }, 25000);
    }
  });

  zipAll.addEventListener("click", async ()=>{
    const zip = new JSZip();
    
    // Create organized folder structure
    if(generated.buyerContracts.length > 0){
      const folder = zip.folder("Buyer-Contracts");
      for(const it of generated.buyerContracts) folder.file(it.filename, it.bytes);
    }
    
    if(generated.sellerContracts.length > 0){
      const folder = zip.folder("Seller-Contracts");
      for(const it of generated.sellerContracts) folder.file(it.filename, it.bytes);
    }
    
    if(generated.buyerContractsGrouped.length > 0){
      const mainFolder = zip.folder("Buyer-Contracts-Grouped");
      const byBuyer = {};
      for(const item of generated.buyerContractsGrouped){
        const groupName = item.groupName || "Unknown";
        if(!byBuyer[groupName]) byBuyer[groupName] = [];
        byBuyer[groupName].push(item);
      }
      for(const [buyer, items] of Object.entries(byBuyer)){
        const subFolder = mainFolder.folder(fileSafeName(buyer));
        for(const it of items) subFolder.file(it.filename, it.bytes);
      }
    }
    
    if(generated.consignorContractsGrouped.length > 0){
      const mainFolder = zip.folder("Consignor-Contracts-Grouped");
      const byConsignor = {};
      for(const item of generated.consignorContractsGrouped){
        const groupName = item.groupName || "Unknown";
        if(!byConsignor[groupName]) byConsignor[groupName] = [];
        byConsignor[groupName].push(item);
      }
      for(const [consignor, items] of Object.entries(byConsignor)){
        const subFolder = mainFolder.folder(fileSafeName(consignor));
        for(const it of items) subFolder.file(it.filename, it.bytes);
      }
    }
    
    if(generated.buyerReports.length > 0 || generated.buyerReportsCondensed.length > 0){
      const folder = zip.folder("Buyer-Reports");
      for(const it of generated.buyerReports) folder.file(it.filename, it.bytes);
      for(const it of generated.buyerReportsCondensed) folder.file(it.filename, it.bytes);
    }
    
    if(generated.lotByLot.length > 0){
      const folder = zip.folder("Contract-Details");
      for(const it of generated.lotByLot) folder.file(it.filename, it.bytes);
    }
    
    if(generated.consignorReports.length > 0 || generated.consignorReportsCondensed.length > 0){
      const folder = zip.folder("Consignor-Trade-Confirmations");
      for(const it of generated.consignorReports) folder.file(it.filename, it.bytes);
      for(const it of generated.consignorReportsCondensed) folder.file(it.filename, it.bytes);
    }
    
    if(generated.repReports.length > 0 || generated.repReportsCondensed.length > 0){
      const folder = zip.folder("Rep-Trade-Confirmations");
      for(const it of generated.repReports) folder.file(it.filename, it.bytes);
      for(const it of generated.repReportsCondensed) folder.file(it.filename, it.bytes);
    }
    
    if(generated.preConsignorReports.length > 0 || generated.preConsignorReportsCondensed.length > 0){
      const folder = zip.folder("Consignor-Listing-Confirmations");
      for(const it of generated.preConsignorReports) folder.file(it.filename, it.bytes);
      for(const it of generated.preConsignorReportsCondensed) folder.file(it.filename, it.bytes);
    }
    
    if(generated.preRepReports.length > 0 || generated.preRepReportsCondensed.length > 0){
      const folder = zip.folder("Rep-Listing-Confirmations");
      for(const it of generated.preRepReports) folder.file(it.filename, it.bytes);
      for(const it of generated.preRepReportsCondensed) folder.file(it.filename, it.bytes);
    }

    // Special Reports
    if(generated.salesByConsignor.length > 0 || generated.salesByBuyer.length > 0 || generated.salesByRep.length > 0 ||
       generated.completeBuyer || generated.completeConsignor || generated.completeRep || generated.auctionRecap){
      const folder = zip.folder("Special-Reports");
      for(const it of generated.salesByConsignor) folder.file(it.filename, it.bytes);
      for(const it of generated.salesByBuyer) folder.file(it.filename, it.bytes);
      for(const it of generated.salesByRep) folder.file(it.filename, it.bytes);
      if(generated.completeBuyer) folder.file(generated.completeBuyer.filename, generated.completeBuyer.bytes);
      if(generated.completeConsignor) folder.file(generated.completeConsignor.filename, generated.completeConsignor.bytes);
      if(generated.completeRep) folder.file(generated.completeRep.filename, generated.completeRep.bytes);
      if(generated.auctionRecap) folder.file(generated.auctionRecap.filename, generated.auctionRecap.bytes);
    }
    
    if(zip.files && Object.keys(zip.files).length > 0){
      const blob = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      const a = document.createElement("a");
      a.href = url;
      a.download = "CMS-Auction-All.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>{
        try{ URL.revokeObjectURL(url); }catch{}
        blobUrls = blobUrls.filter(u => u !== url);
      }, 25000);
    }
  });
}

/* ---------------- EXIT / WIPE ---------------- */
function wireExit(){
  function wipeAll(){
    for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
    blobUrls = [];

    csvRows = [];
    contractColName = null;

    fileInput.value = "";
    fileMeta.textContent = "";
    hide(fileMeta);
    
    // Clear new UI elements
    const dropzoneContent = document.getElementById('dropzoneContent');
    const csvConfirmation = document.getElementById('csvConfirmation');
    const csvPreview = document.getElementById('csvPreview');
    const generationSummary = document.getElementById('generationSummary');
    
    if (dropzoneContent) dropzoneContent.classList.remove('hidden');
    if (csvConfirmation) csvConfirmation.classList.add('hidden');
    if (csvPreview) csvPreview.classList.add('hidden');
    if (generationSummary) generationSummary.classList.add('hidden');

    auctionName.value = "";
    auctionDate.value = "";
    auctionLabel.value = "";

    listBuyerReports.innerHTML = "";
    listLotByLot.innerHTML = "";
    listBuyerContracts.innerHTML = "";
    listSellerContracts.innerHTML = "";
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";
    listPreConsignorReports.innerHTML = "";
    listPreRepReports.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipLotByLot.disabled = true;
    zipBuyerContracts.disabled = true;
    zipSellerContracts.disabled = true;
    zipConsignorReports.disabled = true;
    zipRepReports.disabled = true;
    zipPreConsignorReports.disabled = true;
    zipPreRepReports.disabled = true;
    zipAll.disabled = true;

    resultsMeta.textContent = "";
    setBuildEnabled();
    // Phase 3: PIN gate removed; stay on builder after wipe
    goto(pageBuilder);
  }

  exitBtn.addEventListener("click", wipeAll);

  window.addEventListener("beforeunload", ()=>{
    for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
  });

  backBtn.addEventListener("click", ()=> goto(pageBuilder));
}

/* ---------------- INIT ---------------- */
function init(){
  try{ bindDom(); }
  catch(e){ console.error(e); alert(e.message); return; }

  wireAuth();

  wireDropZone({ zoneEl: dropZone, inputEl: fileInput, onFile: handleCsvFile, metaEl: fileMeta });

  [chkBuyer, chkBuyerCondensed, chkConsignor, chkConsignorCondensed, chkRep, chkRepCondensed, chkLotByLot, chkBuyerContracts, chkSellerContracts, 
   chkPreConsignor, chkPreConsignorCondensed, chkPreRep, chkPreRepCondensed,
   chkSalesByConsignor, chkSalesByBuyer, chkSalesByRep, chkCompleteBuyer, chkCompleteConsignor, chkCompleteRep, chkAuctionRecap]
    .forEach(el => el.addEventListener("change", setBuildEnabled));

  wireSectionSelectors();
  
  // Wire date picker auto-fill. Pulled out to a named function, not
  // left inline in the "change" listener below, because setting
  // auctionDatePicker.value with plain JS (as the default-date-on-load
  // code further down does) never fires a real "change" event on its
  // own — that's a DOM quirk, not a bug in this listener. Without this
  // split, the auto-fill only ever ran after a manual pick, never for
  // the default date silently sitting in the picker on a fresh page
  // load. Called both from the listener (manual picks) and right after
  // the default is set below (so the same fill happens either way).
  function applyAuctionDateFill() {
    const selectedDate = auctionDatePicker.value;
    if(!selectedDate) return;

    // Parse the datetime-local value (format: YYYY-MM-DDTHH:mm)
    const dateObj = new Date(selectedDate);

    // Format date: "February 12th, 2026 @ 1:00PM"
    const months = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    const month = months[dateObj.getMonth()];
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    const ordinal = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };

    // Format time: "1:00PM"
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}${ampm}`;

    // Set the formatted date
    auctionDate.value = `${month} ${day}${ordinal(day)}, ${year} @ ${timeStr}`;

    // Auto-select the Contract Details banner color that matches this month
    const monthColorRadio = document.querySelector(`input[name="lotByLotColor"][data-month="${dateObj.getMonth()}"]`);
    if(monthColorRadio) monthColorRadio.checked = true;

    // Auto-fill auction title ONLY if empty
    if(!auctionName.value || auctionName.value.trim() === ""){
      auctionName.value = `${month} DairyX, Holstein and Native Auction`;
    }
  }
  auctionDatePicker.addEventListener("change", applyAuctionDateFill);

  wireBuild();
  wireExit();
  wireResultsDropdowns();

  // Set default time to 1:00PM for date picker
  const now = new Date();
  now.setHours(13, 0, 0, 0); // 1:00PM
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  auctionDatePicker.value = `${year}-${month}-${day}T13:00`;
  applyAuctionDateFill();

  // Pre-select the Contract Details banner color for the default (current) month
  const defaultMonthColorRadio = document.querySelector(`input[name="lotByLotColor"][data-month="${now.getMonth()}"]`);
  if(defaultMonthColorRadio) defaultMonthColorRadio.checked = true;

  // Phase 3: PIN gate removed. Suite shell now provides auth.
  goto(pageBuilder);
  setBuildEnabled();
  
  // Ensure everything is cleared on page load/refresh
  csvRows = [];
  contractColName = null;
  blobUrls.forEach(url => { try{ URL.revokeObjectURL(url); }catch{} });
  blobUrls = [];
  generated = { 
    buyerReports:[], 
    buyerReportsCondensed: [],
    lotByLot:[], 
    buyerContracts:[], 
    sellerContracts:[], 
    buyerContractsGrouped: [],
    consignorContractsGrouped: [],
    consignorReports:[],
    consignorReportsCondensed: [],
    repReports:[],
    repReportsCondensed: [],
    preConsignorReports: [],
    preConsignorReportsCondensed: [],
    preRepReports: [],
    preRepReportsCondensed: [],
  };
}

document.addEventListener("DOMContentLoaded", init);

// Also clear on page unload (browser refresh, navigation away, tab close)
window.addEventListener("beforeunload", ()=>{
  for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
  blobUrls = [];
});
