// ═══════════════════════════════════════════════════════════════════
//  sKladMan — app.js  v6.0
//  Multi-select filters · Fuzzy Search + UA transliteration
//  URL hash · Share · Mobile nav · Cart state
//  Auto-translate EN · Size chart table · Click-from-order
// ═══════════════════════════════════════════════════════════════════

const API_URL      = 'https://script.google.com/macros/s/AKfycbxS1qhCZvrKB-t4tnidIZMbqu-6VHYtwCKU0SeAM80vkatQzlkurX3xukS1B6kjdsHE/exec';
const MONO_JAR_URL = 'https://send.monobank.ua/jar/772Y4LGGEc';

// ─── NOVA POSHTA ──────────────────────────────────────────────────────────────
const NP_API_KEY = '3d2d7b1203bce99986813799d54bccf9';
const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

let selectedCityRef  = '';
let selectedCityName = '';
let npCityTimer      = null;
let npWareTimer      = null;

async function npPost(modelName, calledMethod, methodProperties = {}) {
  try {
    const res = await fetch(NP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: NP_API_KEY, modelName, calledMethod, methodProperties })
    });
    const data = await res.json();
    return data.success ? data.data : [];
  } catch { return []; }
}

function onCityInput(val) {
  clearTimeout(npCityTimer);
  selectedCityRef  = '';
  selectedCityName = '';
  const npInput = document.getElementById('f-np');
  if (npInput) {
    npInput.value       = '';
    npInput.disabled    = true;
    npInput.placeholder = lang === 'uk' ? 'Спочатку оберіть місто' : 'Select a city first';
  }
  closeDrop('np-dropdown');
  if (!val || val.length < 1) { closeDrop('city-dropdown'); return; }
  showDropLoading('city-dropdown');
  npCityTimer = setTimeout(async () => {
    const results   = await npPost('Address', 'searchSettlements', { CityName: val, Limit: 12, Page: 1 });
    const addresses = results?.[0]?.Addresses || [];
    const drop = document.getElementById('city-dropdown');
    if (!drop) return;
    if (!addresses.length) { showDropEmpty('city-dropdown', lang === 'uk' ? 'Нічого не знайдено' : 'Nothing found'); return; }
    const escapedVal = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    drop.innerHTML = addresses.map(a => {
      const ref    = esc(a.Ref || a.DeliveryCity || '');
      const label  = a.Present || a.MainDescription || '';
      const region = a.RegionsDescription ? `<small style="color:var(--text-muted);font-size:11px">${a.RegionsDescription}</small>` : '';
      const highlighted = label.replace(new RegExp(`(${escapedVal})`, 'gi'), '<strong>$1</strong>');
      return `<div class="np-dropdown-item" onmousedown="selectCity('${ref}','${esc(label)}')">
        <span class="np-city-name">${highlighted}</span>${region}
      </div>`;
    }).join('');
    drop.classList.add('open');
  }, 350);
}

function selectCity(ref, name) {
  selectedCityRef  = ref;
  selectedCityName = name;
  const inp = document.getElementById('f-city');
  if (inp) inp.value = name;
  closeDrop('city-dropdown');
  const npInput = document.getElementById('f-np');
  if (npInput) {
    npInput.disabled    = false;
    npInput.value       = '';
    const deliveryVal   = document.querySelector('input[name="delivery"]:checked')?.value || 'nova_poshta';
    const isPoshtamat   = deliveryVal === 'nova_poshta_poshtamat';
    npInput.placeholder = lang === 'uk'
      ? (isPoshtamat ? 'Введіть номер поштомату...' : 'Введіть номер або адресу відділення...')
      : (isPoshtamat ? 'Enter post office number...'  : 'Enter branch number or address...');
    npInput.focus();
  }
  onWarehouseInput('');
}

function onWarehouseInput(val) {
  clearTimeout(npWareTimer);
  if (!selectedCityRef && !selectedCityName) {
    showDropEmpty('np-dropdown', lang === 'uk' ? 'Спочатку оберіть місто' : 'Select a city first');
    return;
  }
  const deliveryVal = document.querySelector('input[name="delivery"]:checked')?.value || 'nova_poshta';
  showDropLoading('np-dropdown');
  npWareTimer = setTimeout(() => loadNPWarehouses(val, deliveryVal), 300);
}

async function loadNPWarehouses(val, deliveryVal) {
  const isPoshtamat = deliveryVal === 'nova_poshta_poshtamat';
  const props = { FindByString: val || '', Limit: 500, Language: 'UA' };
  if (selectedCityRef)  props.SettlementRef = selectedCityRef;
  else                  props.CityName      = selectedCityName;
  let warehouses = await npPost('Address', 'getWarehouses', props);
  if (warehouses && warehouses.length) {
    const isPostomatFn = w => w.CategoryOfWarehouse === 'Postomat' || (w.Description && w.Description.toLowerCase().includes('поштомат'));
    warehouses = isPoshtamat ? warehouses.filter(isPostomatFn) : warehouses.filter(w => !isPostomatFn(w));
  }
  if (!warehouses || !warehouses.length) {
    showDropEmpty('np-dropdown', lang === 'uk' ? 'Відділень не знайдено' : 'No branches found');
    return;
  }
  const drop = document.getElementById('np-dropdown');
  if (!drop) return;
  const escapedVal = val ? val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  drop.innerHTML = warehouses.slice(0, 50).map(w => {
    const desc        = w.Description || '';
    const highlighted = (escapedVal && val) ? desc.replace(new RegExp(`(${escapedVal})`, 'gi'), '<strong>$1</strong>') : desc;
    return `<div class="np-dropdown-item" onmousedown="selectWarehouse('${esc(desc)}')">${highlighted}</div>`;
  }).join('');
  drop.classList.add('open');
}

function selectWarehouse(desc) {
  const inp = document.getElementById('f-np');
  if (inp) inp.value = desc;
  closeDrop('np-dropdown');
}

function showDropLoading(id) {
  const d = document.getElementById(id);
  if (!d) return;
  d.innerHTML = `<div class="np-dropdown-item np-loading"><span class="np-spin"></span>${lang === 'uk' ? 'Шукаємо...' : 'Searching...'}</div>`;
  d.classList.add('open');
}
function showDropEmpty(id, msg) {
  const d = document.getElementById(id);
  if (!d) return;
  d.innerHTML = `<div class="np-dropdown-item np-empty">${msg}</div>`;
  d.classList.add('open');
}
function closeDrop(id) {
  const d = document.getElementById(id);
  if (d) { d.classList.remove('open'); d.innerHTML = ''; }
}
function scheduleDropdownClose(id) { setTimeout(() => closeDrop(id), 200); }
function esc(str) { return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// ─── СТАН ─────────────────────────────────────────────────────────────────────
let PRODUCTS         = [];
let lang             = localStorage.getItem('lang') || 'uk';
let activeCategories = [];
let activeBrands     = [];
let activeSort       = 'default';
let activeTab        = 'all';
let searchQuery      = '';
let suggestedQuery   = '';
let modalProduct     = null, modalPhotoIndex = 0;
let modalPhotoCache  = {};
let selectedSize     = null;
let cart             = JSON.parse(localStorage.getItem('cart') || '[]');
let currentStep      = 1;
let orderFormHidden  = false;       // true while product modal is open from order form
const translationCache = {};        // text → translated text

// ─── SCROLL ANIMATIONS ────────────────────────────────────────────────────────
let cardObserver = null;
function initScrollAnimations() {
  if (cardObserver) cardObserver.disconnect();
  cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('card-visible');
        entry.target.style.transitionDelay = '0ms';
      } else {
        entry.target.classList.remove('card-visible');
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.card').forEach((card, i) => {
    card.style.transitionDelay = `${Math.min((i % 10) * 40, 300)}ms`;
    cardObserver.observe(card);
  });
}

function updateGridWithFade(actionFn) {
  const grid = document.getElementById('product-grid');
  if (!grid) { actionFn(); return; }
  grid.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  grid.style.opacity    = '0';
  grid.style.transform  = 'translateY(15px)';
  setTimeout(() => {
    actionFn();
    requestAnimationFrame(() => {
      grid.style.opacity   = '1';
      grid.style.transform = 'translateY(0)';
    });
  }, 250);
}

// ─── ПЕРЕКЛАДИ ────────────────────────────────────────────────────────────────
const T = {
  uk: {
    nav_all:'Всі товари', nav_sale:'Розпродаж',
    filter_category:'Категорія', filter_brand:'Бренд', filter_sort:'Сортування',
    all_brands:'Всі бренди', all_categories:'Всі категорії',
    sort_default:'За замовчуванням', sort_price_asc:'Ціна: від низької',
    sort_price_desc:'Ціна: від високої', sort_relevance:'За релевантністю',
    sale_badge:'SALE', no_products:'Товари не знайдено',
    size_label:'Розмір:', available:'в наявності',
    details_material:'Склад', details_care:'Догляд', details_measurements:'Заміри',
    results:'товарів знайдено', search_placeholder:'Пошук товарів...',
    add_to_cart:'Додати в кошик', select_size:'Оберіть розмір',
    in_cart:'В кошику — перейти', cart_title:'Кошик',
    cart_empty:'Кошик порожній', cart_total:'Разом',
    checkout:'Оформити замовлення', clear_cart:'Очистити кошик',
    added_toast:'Додано до кошика!', loading:'Завантаження...',
    order_title:'Оформлення', submit_btn:'Підтвердити замовлення',
    submitting:'Відправляємо...',
    success_title:'Замовлення прийнято!', success_msg:"Ми зв'яжемось з вами найближчим часом.",
    close_order:'Закрити',
    step1:'1. Контакти', step2:'2. Доставка', step3:'3. Оплата',
    suggestion_prefix:'Можливо, ви мали на увазі:',
    suggestion_accept:'Шукати',
    share_copied:'Посилання скопійовано!',
    view_product:'Переглянути товар',
    size_cm:'Виміри вказані в сантиметрах',
    size_col_size:'Розмір',
    size_col_foot:'Довжина стопи',
    size_col_measure:'Виміри',
    translating:'Перекладаємо...',
  },
  en: {
    nav_all:'All items', nav_sale:'Sale',
    filter_category:'Category', filter_brand:'Brand', filter_sort:'Sort',
    all_brands:'All brands', all_categories:'All categories',
    sort_default:'Default', sort_price_asc:'Price: low to high',
    sort_price_desc:'Price: high to low', sort_relevance:'By relevance',
    sale_badge:'SALE', no_products:'No products found',
    size_label:'Size:', available:'available',
    details_material:'Material', details_care:'Care', details_measurements:'Measurements',
    results:'items found', search_placeholder:'Search products...',
    add_to_cart:'Add to cart', select_size:'Select size',
    in_cart:'In cart — view', cart_title:'Cart',
    cart_empty:'Your cart is empty', cart_total:'Total',
    checkout:'Checkout', clear_cart:'Clear cart',
    added_toast:'Added to cart!', loading:'Loading...',
    order_title:'Checkout', submit_btn:'Confirm order',
    submitting:'Sending...',
    success_title:'Order placed!', success_msg:'We will contact you shortly.',
    close_order:'Close',
    step1:'1. Contacts', step2:'2. Delivery', step3:'3. Payment',
    suggestion_prefix:'Did you mean:',
    suggestion_accept:'Search',
    share_copied:'Link copied!',
    view_product:'View product',
    size_cm:'Measurements in centimetres',
    size_col_size:'Size',
    size_col_foot:'Foot length',
    size_col_measure:'Measurements',
    translating:'Translating...',
  }
};

const DELIVERY_LABELS_UK = {
  nova_poshta:           'Нова Пошта — відділення',
  nova_poshta_poshtamat: 'Нова Пошта — поштомат',
  nova_poshta_courier:   "Нова Пошта — кур'єр",
  ukrposhta:             'Укрпошта',
};
const PAYMENT_LABELS = {
  mono:   'Переказ на Банку (Monobank)',
  privat: 'ПриватБанк',
  cod:    'Накладений платіж'
};
const CATEGORY_KEYS = {
  'Shoes':      { uk:'Взуття',    en:'Shoes' },
  'T-shirt':    { uk:'Футболки',  en:'T-shirts' },
  'Sweatshirt': { uk:'Світшоти',  en:'Sweatshirts' },
  'Jacket':     { uk:'Куртки',    en:'Jackets' },
  'Pants':      { uk:'Штани',     en:'Pants' },
  'Longsleeve': { uk:'Лонгсліви', en:'Longsleeves' },
  'Shirt':      { uk:'Сорочки',   en:'Shirts' },
};

const LOCAL_PRODUCTS = [
  { id:"001-001-001", brand:"Nike", name:"Nike P-6000", category:"Shoes", price:2300, oldPrice:2300, onSale:false, sizes:{"S/39":"3","M/40":"2","L/41":"5","XL/42":"2","XXL/43":"2"}, desc:"Технологічні моделі з акцентом на комфорт та вентиляцію.", material:"Сітка (Mesh), синтетична шкіра.", care:"Можна протирати вологою серветкою.", measurements:"39: 24.5–25.0см; 40: 25.5см; 41: 26.0см; 42: 26.5см; 43: 27.5см.", totalStock:14 },
  { id:"001-001-002", brand:"Nike", name:"Nike m2k tekno white", category:"Shoes", price:2300, oldPrice:2500, onSale:true, sizes:{"S/39":"1","M/40":"2","L/41":"6","XL/42":"3","XXL/43":"1"}, desc:"Класика dad shoes у бездоганному білому кольорі.", material:"100% натуральна шкіра.", care:"Регулярно протирати вологою серветкою.", measurements:"39: 24.5–25.0см; 40: 25.5см; 41: 26.0см; 42: 26.5см; 43: 27.5см.", totalStock:13 },
];

// ─── AUTO-TRANSLATION (MyMemory free API, no key needed) ──────────────────────

// Simple dictionary for common measurement terms (avoids API calls for these)
const MEASURE_DICT_UK_EN = {
  'ширина':'width','довжина':'length','висота':'height',
  'обхват грудей':'chest','обхват талії':'waist','обхват стегон':'hip',
  'довжина рукава':'sleeve length','довжина стопи':'foot length',
  'см':'cm','мм':'mm',
};

function replaceMeasureTerms(val) {
  let out = val;
  Object.entries(MEASURE_DICT_UK_EN).forEach(([uk, en]) => {
    out = out.replace(new RegExp(uk, 'gi'), en);
  });
  return out;
}

async function translateUkToEn(text) {
  if (!text?.trim()) return text;
  if (lang !== 'en') return text;
  const cacheKey = text.trim();
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=uk|en`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = data.responseData?.translatedText;
    if (translated && !translated.toUpperCase().includes('MYMEMORY WARNING') && translated !== text) {
      translationCache[cacheKey] = translated;
      return translated;
    }
    return text;
  } catch {
    return text;
  }
}

// Returns translated text fields for a product; fast if UK, async if EN
async function getProductText(p) {
  if (lang === 'uk') {
    return {
      desc:         p.desc         || '',
      material:     p.material     || '',
      care:         p.care         || '',
      measurements: p.measurements || '',
    };
  }
  // Parallel fetches — pre-translated fields win, otherwise call API
  const [desc, material, care] = await Promise.all([
    p.descEn     ? Promise.resolve(p.descEn)     : translateUkToEn(p.desc     || ''),
    p.materialEn ? Promise.resolve(p.materialEn) : translateUkToEn(p.material || ''),
    p.careEn     ? Promise.resolve(p.careEn)     : translateUkToEn(p.care     || ''),
  ]);
  // Measurements: keep original but swap common terms (numbers/cm are universal)
  const measurements = p.measurementsEn || replaceMeasureTerms(p.measurements || '');
  return { desc, material, care, measurements };
}

// ─── FUZZY SEARCH ─────────────────────────────────────────────────────────────
const UA_TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'g','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh',
  'з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n',
  'о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
  'ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya',' ':' '
};

const SEARCH_SYNONYMS = {
  'найк':'nike','найкі':'nike','наік':'nike','найку':'nike',
  'адідас':'adidas','адедас':'adidas',
  'пума':'puma',
  'джордан':'jordan','аір джордан':'jordan',
  'нью беланс':'new balance','ню беланс':'new balance',
  'рибок':'reebok','рібок':'reebok',
  'конверс':'converse','конвєрс':'converse',
  'ванс':'vans',
  'футболка':'t-shirt','футболки':'t-shirt','майка':'t-shirt','майки':'t-shirt',
  'кросівки':'shoes','кросовки':'shoes','кроси':'shoes','кросівок':'shoes',
  'взуття':'shoes','кеди':'shoes','снікери':'shoes','кросовок':'shoes',
  'штани':'pants','джинси':'pants',
  'куртка':'jacket','куртки':'jacket','вітровка':'jacket','пуховик':'jacket',
  'світшот':'sweatshirt','світшоти':'sweatshirt','свіш':'sweatshirt',
  'лонгслів':'longsleeve','лонгсліви':'longsleeve',
  'сорочка':'shirt','сорочки':'shirt','рубашка':'shirt',
};

function transliterate(str) {
  return str.toLowerCase().split('').map(c => UA_TRANSLIT[c] ?? c).join('');
}

function expandQuery(raw) {
  const lower = raw.toLowerCase().trim();
  if (SEARCH_SYNONYMS[lower]) return SEARCH_SYNONYMS[lower];
  const expanded = lower.split(/\s+/).map(w => SEARCH_SYNONYMS[w] || w).join(' ');
  if (expanded !== lower) return expanded;
  const translit = transliterate(lower);
  if (translit !== lower) return translit;
  return lower;
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i-1] === b[j-1]
        ? prev[j-1]
        : 1 + Math.min(prev[j], curr[j-1], prev[j-1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

function getRelevanceScore(p, rawQuery) {
  if (!rawQuery) return 0;
  const q       = expandQuery(rawQuery);
  const words   = q.split(/\s+/).filter(Boolean);
  const name    = p.name.toLowerCase();
  const brand   = p.brand.toLowerCase();
  const catUk   = (CATEGORY_KEYS[p.category]?.uk || p.category).toLowerCase();
  const catEn   = (CATEGORY_KEYS[p.category]?.en || p.category).toLowerCase();
  const haystack = `${brand} ${name} ${catUk} ${catEn}`;
  let score = 0;
  for (const word of words) {
    if (brand === word) score += 100;
    else if (name === word) score += 80;
    else if (brand.startsWith(word) || name.startsWith(word)) score += 50;
    else if (haystack.includes(word)) score += 20;
    else if (word.length >= 3) {
      const distBrand = levenshtein(word, brand.substring(0, word.length + 2));
      const distName  = levenshtein(word, name.substring(0, word.length + 2));
      const best      = Math.min(distBrand, distName);
      if (best <= 2) score += Math.max(0, 10 - best * 3);
    }
  }
  return score;
}

function productMatchesQuery(p, rawQuery) {
  if (!rawQuery) return true;
  const q       = expandQuery(rawQuery);
  const words   = q.split(/\s+/).filter(Boolean);
  const name    = p.name.toLowerCase();
  const brand   = p.brand.toLowerCase();
  const catUk   = (CATEGORY_KEYS[p.category]?.uk || p.category).toLowerCase();
  const catEn   = (CATEGORY_KEYS[p.category]?.en || p.category).toLowerCase();
  const haystack = `${brand} ${name} ${catUk} ${catEn}`;
  return words.every(word => {
    if (haystack.includes(word)) return true;
    if (word.length < 3) return false;
    const tolerance = Math.floor(word.length / 4);
    const distBrand = levenshtein(word, brand.substring(0, word.length + 2));
    const distName  = levenshtein(word, name.substring(0, word.length + 2));
    return Math.min(distBrand, distName) <= tolerance;
  });
}

function findSuggestion(rawQuery) {
  if (!rawQuery) return '';
  const words   = rawQuery.toLowerCase().trim().split(/\s+/);
  const brands  = [...new Set(PRODUCTS.map(p => p.brand.toLowerCase()))];
  const catKeys = Object.values(CATEGORY_KEYS).flatMap(c => [c.uk.toLowerCase(), c.en.toLowerCase()]);
  const corrected = words.map(word => {
    if (SEARCH_SYNONYMS[word]) return SEARCH_SYNONYMS[word];
    let best = null, bestDist = 3;
    for (const b of brands) {
      const d = levenshtein(word, b);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    if (best) return best;
    for (const c of catKeys) {
      const d = levenshtein(word, c);
      if (d <= 2) return c;
    }
    return word;
  });
  const suggestion = corrected.join(' ');
  return suggestion !== rawQuery.toLowerCase().trim() ? suggestion : '';
}

// ─── SIZE / MEASUREMENT CHART ─────────────────────────────────────────────────

// Parse "39: 24.5–25.0см; 40: 25.5см" → [{size, value}, …]
function parseMeasurements(str) {
  if (!str?.trim()) return null;
  const clean = str.trim().replace(/\.$/, '');
  const parts = clean.split(/\s*;\s*/).filter(Boolean);
  if (parts.length < 2) return null;
  const rows = parts.map(part => {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) return null;
    return { size: part.slice(0, colonIdx).trim(), value: part.slice(colonIdx + 1).trim() };
  }).filter(Boolean);
  return rows.length >= 2 ? rows : null;
}

function buildSizeChart(measurementsStr, p) {
  const rows = parseMeasurements(measurementsStr);
  if (!rows) return `<p style="padding-bottom:14px;font-size:13px;color:var(--text-mid)">${measurementsStr}</p>`;

  const t      = T[lang];
  const isShoe = p.category === 'Shoes';
  const colHeader = isShoe ? t.size_col_foot : t.size_col_measure;

  // Which size to highlight (if user has already selected one)
  let highlightKey = '';
  if (selectedSize) {
    const parts = selectedSize.split('/');
    highlightKey = isShoe ? (parts[1] || parts[0]) : (parts[0] || selectedSize);
  }

  const rowsHtml = rows.map(r => {
    const val        = lang === 'en' ? replaceMeasureTerms(r.value) : r.value;
    const highlighted = highlightKey && (r.size === highlightKey || r.size.includes(highlightKey));
    return `<tr${highlighted ? ' class="highlighted"' : ''}><td>${r.size}</td><td>${val}</td></tr>`;
  }).join('');

  return `<div class="size-chart-wrap">
    <table class="size-chart">
      <thead><tr>
        <th>${t.size_col_size}</th>
        <th>${colHeader}</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p class="size-chart-hint">${t.size_cm}</p>
  </div>`;
}

// Highlight the matching row when user picks a size (no full re-render needed)
function updateSizeChartHighlight() {
  if (!modalProduct) return;
  const isShoe = modalProduct.category === 'Shoes';
  let highlightKey = '';
  if (selectedSize) {
    const parts = selectedSize.split('/');
    highlightKey = isShoe ? (parts[1] || parts[0]) : (parts[0] || selectedSize);
  }
  document.querySelectorAll('.size-chart tbody tr').forEach(row => {
    const rowSize = row.querySelector('td')?.textContent?.trim() || '';
    row.classList.toggle('highlighted',
      !!highlightKey && (rowSize === highlightKey || rowSize.includes(highlightKey))
    );
  });
}

// ─── IMAGE HELPERS ────────────────────────────────────────────────────────────
function getCardImgSrc(p) {
  if (p.photos && p.photos.length > 0) return p.photos[0];
  if (p.photoUrl && p.photoUrl.startsWith('http')) return p.photoUrl;
  return '';
}
async function loadProductImages(p) {
  if (modalPhotoCache[p.id]) return modalPhotoCache[p.id];
  if (p.photos && p.photos.length > 0) { modalPhotoCache[p.id] = p.photos; return p.photos; }
  if (p.photoUrl && p.photoUrl.startsWith('http')) { modalPhotoCache[p.id] = [p.photoUrl]; return [p.photoUrl]; }
  modalPhotoCache[p.id] = null; return null;
}

// ─── PRODUCT LOADING ──────────────────────────────────────────────────────────
async function fetchProducts() {
  if (API_URL && API_URL.startsWith('https://script.google')) {
    showLoadingScreen(true);
    try {
      const res  = await fetch(`${API_URL}?action=products`);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) PRODUCTS = data.products;
      else PRODUCTS = LOCAL_PRODUCTS;
    } catch { PRODUCTS = LOCAL_PRODUCTS; }
    finally { showLoadingScreen(false); }
  } else {
    PRODUCTS = LOCAL_PRODUCTS;
  }
  renderNav(); renderFilters(); renderGrid(); updateFilterUI();
  checkURLHash();
}

function showLoadingScreen(show) {
  let el = document.getElementById('loading-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.innerHTML = '<div class="loading-spinner"></div><p>Завантаження товарів...</p>';
    document.getElementById('product-grid').parentElement.prepend(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

function getStock(p) {
  return p.totalStock ?? Object.values(p.sizes).reduce((s, v) => s + parseInt(v || 0), 0);
}

// ─── FILTERING & SORTING ─────────────────────────────────────────────────────
function getFiltered() {
  let list = PRODUCTS.filter(p => {
    if (activeTab === 'sale' && !p.onSale) return false;
    if (activeCategories.length > 0 && !activeCategories.includes(p.category)) return false;
    if (activeBrands.length > 0 && !activeBrands.includes(p.brand)) return false;
    if (searchQuery && !productMatchesQuery(p, searchQuery)) return false;
    return true;
  });

  const sortFn = (() => {
    if (activeSort === 'relevance' && searchQuery)
      return (a, b) => getRelevanceScore(b, searchQuery) - getRelevanceScore(a, searchQuery);
    if (activeSort === 'price_asc')  return (a, b) => a.price - b.price;
    if (activeSort === 'price_desc') return (a, b) => b.price - a.price;
    return null;
  })();
  if (sortFn) list.sort(sortFn);

  list.sort((a, b) => {
    const as = getStock(a), bs = getStock(b);
    if (as === 0 && bs > 0) return 1;
    if (bs === 0 && as > 0) return -1;
    return 0;
  });
  return list;
}

const fmt = p => p.toLocaleString('uk-UA') + ' ₴';

function renderGrid() {
  const filtered = getFiltered();
  const countEl  = document.getElementById('results-count');
  if (countEl) countEl.textContent = `${filtered.length} ${T[lang].results}`;
  const grid = document.getElementById('product-grid');

  // Suggestion bar
  const suggBar  = document.getElementById('search-suggestion');
  const suggText = document.getElementById('search-suggestion-text');
  const suggBtn  = document.getElementById('search-suggestion-btn');
  suggestedQuery = '';

  if (searchQuery && filtered.length === 0) {
    const suggestion = findSuggestion(searchQuery);
    if (suggestion && suggBar && suggText && suggBtn) {
      suggestedQuery       = suggestion;
      suggText.innerHTML   = `${T[lang].suggestion_prefix} <strong>"${suggestion}"</strong>`;
      suggBtn.textContent  = T[lang].suggestion_accept;
      suggBar.style.display = 'flex';
    } else if (suggBar) {
      suggBar.style.display = 'none';
    }
  } else if (suggBar) {
    suggBar.style.display = 'none';
  }

  if (!filtered.length) {
    grid.innerHTML = `<div class="no-results">${T[lang].no_products}</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const disc   = p.onSale && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const stock  = getStock(p);
    const imgSrc = getCardImgSrc(p);
    return `
      <div class="card${stock === 0 ? ' out-of-stock' : ''}" onclick="openModal('${p.id}')">
        <div class="card-img-wrap">
          <img src="${imgSrc}" alt="${p.name}" loading="lazy"
               onerror="this.closest('.card-img-wrap').classList.add('no-img')">
          ${p.onSale ? `<span class="badge-sale">${T[lang].sale_badge} −${disc}%</span>` : ''}
          ${stock === 0 ? `<div class="stock-overlay">${lang === 'uk' ? 'Немає в наявності' : 'Out of stock'}</div>` : ''}
        </div>
        <div class="card-info">
          <p class="card-brand">${p.brand}</p>
          <p class="card-name">${p.name}</p>
          <div class="card-price">
            <span class="price-current">${fmt(p.price)}</span>
            ${p.oldPrice > p.price ? `<span class="price-old">${fmt(p.oldPrice)}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  requestAnimationFrame(() => initScrollAnimations());
}

function acceptSuggestion() {
  if (!suggestedQuery) return;
  searchQuery = suggestedQuery;
  const inp1 = document.getElementById('search-input');
  const inp2 = document.getElementById('mobile-search-input');
  if (inp1) inp1.value = suggestedQuery;
  if (inp2) inp2.value = suggestedQuery;
  renderGrid();
}

// ─── FILTERS ─────────────────────────────────────────────────────────────────
function renderFilters() {
  const t      = T[lang];
  const brands = [...new Set(PRODUCTS.map(p => p.brand))].sort();
  const cats   = [...new Set(PRODUCTS.map(p => p.category))];
  const sortEl = document.getElementById('filter-sort');

  if (sortEl) {
    sortEl.innerHTML = [
      `<option value="default">${t.sort_default}</option>`,
      `<option value="price_asc">${t.sort_price_asc}</option>`,
      `<option value="price_desc">${t.sort_price_desc}</option>`,
      `<option value="relevance">${t.sort_relevance}</option>`,
    ].join('');
    sortEl.value = activeSort;
  }

  const body = document.getElementById('filter-panel-body');
  if (!body) return;
  body.innerHTML = `
    <div class="fp-section" id="fp-cat">
      <button class="fp-section-header" onclick="toggleFpSection('fp-cat')">
        <span>${t.filter_category}</span>
        <svg class="fp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="fp-section-body">
        ${cats.map(c => `
          <label class="fp-checkbox-row">
            <input type="checkbox" class="fp-cb fp-cb-cat" value="${c}"
              ${activeCategories.includes(c) ? 'checked' : ''} onchange="onCatChange(this)">
            <span class="fp-cb-box"></span>
            <span class="fp-cb-label">${CATEGORY_KEYS[c]?.[lang] || c}</span>
          </label>`).join('')}
      </div>
    </div>
    <div class="fp-section" id="fp-brand">
      <button class="fp-section-header" onclick="toggleFpSection('fp-brand')">
        <span>${t.filter_brand}</span>
        <svg class="fp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="fp-section-body">
        ${brands.map(b => `
          <label class="fp-checkbox-row">
            <input type="checkbox" class="fp-cb fp-cb-brand" value="${b}"
              ${activeBrands.includes(b) ? 'checked' : ''} onchange="onBrandChange(this)">
            <span class="fp-cb-box"></span>
            <span class="fp-cb-label">${b}</span>
          </label>`).join('')}
      </div>
    </div>
    <div class="fp-section" id="fp-sale">
      <button class="fp-section-header" onclick="toggleFpSection('fp-sale')">
        <span class="fp-sale-label">SALE</span>
        <svg class="fp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="fp-section-body">
        <label class="fp-checkbox-row">
          <input type="checkbox" class="fp-cb" id="fp-cb-sale"
            ${activeTab === 'sale' ? 'checked' : ''} onchange="onSaleChange(this)">
          <span class="fp-cb-box"></span>
          <span class="fp-cb-label">${lang === 'uk' ? 'Тільки розпродаж' : 'Sale items only'}</span>
        </label>
      </div>
    </div>`;

  updateFilterUI();
}

function renderNav() {
  const t = T[lang];
  document.getElementById('nav-all').textContent  = t.nav_all;
  document.getElementById('nav-sale').textContent = t.nav_sale;

  const si = document.getElementById('search-input');
  if (si) si.placeholder = t.search_placeholder;
  const msi = document.getElementById('mobile-search-input');
  if (msi) msi.placeholder = t.search_placeholder;

  const filterBtn = document.getElementById('filter-btn-label');
  if (filterBtn) filterBtn.textContent = lang === 'uk' ? 'Фільтри' : 'Filters';

  document.getElementById('nav-all').classList.toggle('active',  activeTab === 'all');
  document.getElementById('nav-sale').classList.toggle('active', activeTab === 'sale');
  document.getElementById('cart-title').textContent = t.cart_title;

  // Mobile nav labels
  const mna = document.getElementById('mob-nav-all-label');
  const mns = document.getElementById('mob-nav-sale-label');
  const mnf = document.getElementById('mob-nav-filter-label');
  const mnc = document.getElementById('mob-nav-cart-label');
  if (mna) mna.textContent = t.nav_all;
  if (mns) mns.textContent = t.nav_sale;
  if (mnf) mnf.textContent = lang === 'uk' ? 'Фільтри'  : 'Filters';
  if (mnc) mnc.textContent = lang === 'uk' ? 'Кошик'    : 'Cart';

  document.getElementById('mob-nav-all')?.classList.toggle('active',  activeTab === 'all');
  document.getElementById('mob-nav-sale')?.classList.toggle('active', activeTab === 'sale');

  // Order step labels
  document.querySelectorAll('.order-step[data-step]').forEach(el => {
    const n = el.dataset.step;
    if (n === '1') el.textContent = t.step1;
    if (n === '2') el.textContent = t.step2;
    if (n === '3') el.textContent = t.step3;
  });
}

function toggleFpSection(id) { document.getElementById(id)?.classList.toggle('collapsed'); }

function onCatChange(cb) {
  if (cb.checked) { if (!activeCategories.includes(cb.value)) activeCategories.push(cb.value); }
  else activeCategories = activeCategories.filter(c => c !== cb.value);
  updateGridWithFade(() => { renderGrid(); updateFilterUI(); });
}

function onBrandChange(cb) {
  if (cb.checked) { if (!activeBrands.includes(cb.value)) activeBrands.push(cb.value); }
  else activeBrands = activeBrands.filter(b => b !== cb.value);
  updateGridWithFade(() => { renderGrid(); updateFilterUI(); });
}

function onSaleChange(cb) {
  updateGridWithFade(() => {
    activeTab = cb.checked ? 'sale' : 'all';
    renderNav(); renderGrid(); updateFilterUI();
  });
}

function updateFilterUI() {
  const count = activeCategories.length + activeBrands.length + (activeTab === 'sale' ? 1 : 0);

  const badge    = document.getElementById('filter-active-count');
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }

  const mobBadge = document.getElementById('mob-filter-count');
  if (mobBadge) { mobBadge.textContent = count; mobBadge.style.display = count > 0 ? 'flex' : 'none'; }

  const btn = document.getElementById('btn-show-results');
  if (btn) {
    const n = getFiltered().length;
    btn.textContent = lang === 'uk' ? `Показати ${n} товарів` : `Show ${n} items`;
  }

  const chips = document.getElementById('filter-chips');
  if (!chips) return;
  const items = [];

  activeCategories.forEach(c => items.push({
    label: CATEGORY_KEYS[c]?.[lang] || c,
    clear: () => {
      activeCategories = activeCategories.filter(x => x !== c);
      document.querySelectorAll(`.fp-cb-cat[value="${c}"]`).forEach(x => x.checked = false);
      updateGridWithFade(() => { renderGrid(); updateFilterUI(); });
    }
  }));
  activeBrands.forEach(b => items.push({
    label: b,
    clear: () => {
      activeBrands = activeBrands.filter(x => x !== b);
      document.querySelectorAll(`.fp-cb-brand[value="${b}"]`).forEach(x => x.checked = false);
      updateGridWithFade(() => { renderGrid(); updateFilterUI(); });
    }
  }));
  if (activeTab === 'sale') items.push({
    label: 'SALE',
    clear: () => {
      activeTab = 'all';
      const cb = document.getElementById('fp-cb-sale');
      if (cb) cb.checked = false;
      updateGridWithFade(() => { renderNav(); renderGrid(); updateFilterUI(); });
    }
  });

  chips.innerHTML = items.map((item, i) =>
    `<span class="filter-chip">${item.label}<button onclick="clearChip(${i})">✕</button></span>`
  ).join('');
  chips._clearFns = items.map(x => x.clear);
}

function clearChip(i) {
  const chips = document.getElementById('filter-chips');
  if (chips?._clearFns?.[i]) chips._clearFns[i]();
}

function clearFilters() {
  updateGridWithFade(() => {
    activeCategories = []; activeBrands = []; activeTab = 'all';
    document.querySelectorAll('.fp-cb-cat, .fp-cb-brand').forEach(x => x.checked = false);
    const s = document.getElementById('fp-cb-sale');
    if (s) s.checked = false;
    renderNav(); renderGrid(); updateFilterUI();
  });
}

function openFilters()  { renderFilters(); document.getElementById('filter-drawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeFilters() { document.getElementById('filter-drawer').classList.remove('open'); document.body.style.overflow = ''; }

// ─── URL HASH ────────────────────────────────────────────────────────────────
function setProductHash(id) {
  history.replaceState(null, '', id
    ? `${location.pathname}${location.search}#${id}`
    : `${location.pathname}${location.search}`
  );
}

function checkURLHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const p = PRODUCTS.find(x => x.id === hash);
  if (p) openModal(p.id);
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
async function openModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  modalProduct = p; modalPhotoIndex = 0; selectedSize = null;

  const modal = document.getElementById('modal');
  modal.querySelector('.modal-gallery').innerHTML = '<div class="img-skeleton"></div>';
  modal.querySelector('.modal-info').innerHTML    = '';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setProductHash(p.id);

  // Load images and (possibly async) translated text in parallel
  const [images, text] = await Promise.all([
    loadProductImages(p),
    getProductText(p),
  ]);

  renderModal(p, images, text);
}

function renderModal(p, images, text) {
  const t      = T[lang];
  const modal  = document.getElementById('modal');
  const gallery = modal.querySelector('.modal-gallery');

  // ── Gallery ──
  if (images && images.length > 0) {
    gallery.innerHTML = `
      <div class="gallery-main">
        <img id="modal-main-img" src="${images[modalPhotoIndex]}" alt="${p.name}">
        ${images.length > 1 ? `
          <button class="gallery-nav prev" onclick="changePhoto(-1)">‹</button>
          <button class="gallery-nav next" onclick="changePhoto(1)">›</button>
          <div class="gallery-dots">
            ${images.map((_,i) =>
              `<span class="dot${i === modalPhotoIndex ? ' active' : ''}" onclick="goToPhoto(${i})"></span>`
            ).join('')}
          </div>` : ''}
      </div>
      ${images.length > 1 ? `<div class="gallery-thumbs">
        ${images.map((src,i) =>
          `<img src="${src}" class="thumb${i === modalPhotoIndex ? ' active' : ''}" onclick="goToPhoto(${i})">`
        ).join('')}
      </div>` : ''}`;
  } else {
    gallery.innerHTML = '<div class="gallery-main no-img-placeholder"><span>No image</span></div>';
  }

  // ── Info ──
  const isShoe = p.category === 'Shoes';
  const disc   = p.onSale && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const inCart = selectedSize ? isInCart(p.id, selectedSize) : false;

  const desc         = text?.desc         || '';
  const material     = text?.material     || '';
  const care         = text?.care         || '';
  const measurements = text?.measurements || '';

  const sizesHtml = Object.entries(p.sizes).map(([size, qty]) => {
    const key   = size.includes('/') ? size.split('/')[isShoe ? 1 : 0] : size;
    const avail = parseInt(qty) > 0;
    return `<span class="size-tag${!avail ? ' size-unavailable' : ''}${selectedSize === size ? ' selected' : ''}"
      ${avail ? `onclick="selectSize('${size}', this)"` : ''}>${key}</span>`;
  }).join('');

  const measurementsHtml = measurements ? buildSizeChart(measurements, p) : '';

  modal.querySelector('.modal-info').innerHTML = `
    <div class="modal-brand">${p.brand}</div>
    <h2 class="modal-title">${p.name}</h2>
    <div class="modal-prices">
      <span class="modal-price-current">${fmt(p.price)}</span>
      ${p.oldPrice > p.price ? `<span class="modal-price-old">${fmt(p.oldPrice)}</span>` : ''}
      ${disc > 0 ? `<span class="modal-discount">−${disc}%</span>` : ''}
    </div>
    ${desc ? `<p class="modal-desc">${desc}</p>` : ''}
    <div class="modal-sizes">
      <p class="modal-label">${t.size_label}</p>
      <div class="sizes-row">${sizesHtml}</div>
    </div>
    <div class="modal-details">
      ${material ? `<details><summary>${t.details_material}</summary><p>${material}</p></details>` : ''}
      ${care ? `<details><summary>${t.details_care}</summary><p>${care}</p></details>` : ''}
      ${measurementsHtml ? `<details open><summary>${t.details_measurements}</summary>${measurementsHtml}</details>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn-add-cart${inCart && selectedSize ? ' btn-in-cart' : ''}"
              id="btn-add-cart" onclick="handleCartBtn()"
              ${!selectedSize ? 'disabled' : ''}
              data-state="${!selectedSize ? 'select' : inCart ? 'in-cart' : 'add'}">
        ${getCartBtnHTML(!selectedSize ? 'select' : inCart ? 'in-cart' : 'add')}
      </button>
      <button class="btn-buy-now" onclick="buyNow()" ${!selectedSize ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M5 12h14m-7-7 7 7-7 7"/>
        </svg>
        ${lang === 'uk' ? 'Купити зараз' : 'Buy now'}
      </button>
    </div>`;

  // Share button
  const shareBtn = document.getElementById('modal-share');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const url = `${location.origin}${location.pathname}#${p.id}`;
      navigator.clipboard.writeText(url)
        .then(() => showToast(T[lang].share_copied))
        .catch(() => {
          const ta = document.createElement('textarea');
          ta.value = url; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy');
          document.body.removeChild(ta);
          showToast(T[lang].share_copied);
        });
    };
  }
}

function getCartBtnHTML(state) {
  if (state === 'select') {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>${T[lang].select_size}`;
  }
  if (state === 'in-cart') {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>${T[lang].in_cart}`;
  }
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>${T[lang].add_to_cart}`;
}

function isInCart(productId, size) {
  const key = `${productId}__${size}`;
  return cart.some(x => x.key === key);
}

function updateCartBtnState() {
  const btn = document.getElementById('btn-add-cart');
  if (!btn || !modalProduct) return;
  let state;
  if (!selectedSize) state = 'select';
  else if (isInCart(modalProduct.id, selectedSize)) state = 'in-cart';
  else state = 'add';
  btn.dataset.state = state;
  btn.disabled      = state === 'select';
  btn.innerHTML     = getCartBtnHTML(state);
  btn.classList.toggle('btn-in-cart', state === 'in-cart');
}

function handleCartBtn() {
  const btn = document.getElementById('btn-add-cart');
  if (!btn) return;
  if (btn.dataset.state === 'in-cart') { closeModal(); setTimeout(() => openCart(), 250); return; }
  addToCart();
}

function selectSize(size, el) {
  selectedSize = size;
  document.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
  const buyBtn = document.querySelector('.btn-buy-now');
  if (buyBtn) buyBtn.disabled = false;
  updateCartBtnState();
  updateSizeChartHighlight();   // ← highlight matching row in chart
}

function buyNow() {
  if (!modalProduct || !selectedSize) return;
  addToCart(); closeModal();
  setTimeout(() => openOrderForm(), 100);
}

function changePhoto(dir) {
  const images = modalPhotoCache[modalProduct?.id];
  if (!images) return;
  modalPhotoIndex = (modalPhotoIndex + dir + images.length) % images.length;
  updateGallery(images);
}
function goToPhoto(i) {
  modalPhotoIndex = i;
  const images = modalPhotoCache[modalProduct?.id];
  if (images) updateGallery(images);
}
function updateGallery(images) {
  const m = document.getElementById('modal-main-img');
  if (m) m.src = images[modalPhotoIndex];
  document.querySelectorAll('.dot').forEach((d, i)  => d.classList.toggle('active', i === modalPhotoIndex));
  document.querySelectorAll('.thumb').forEach((th, i) => th.classList.toggle('active', i === modalPhotoIndex));
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  modalProduct = null; selectedSize = null;
  setProductHash('');
  // If opened from order form, restore it without resetting form data
  if (orderFormHidden) {
    orderFormHidden = false;
    document.getElementById('order-modal').classList.add('open');
    // body overflow stays hidden — order form is still open
  } else {
    document.body.style.overflow = '';
  }
}

// ─── OPEN PRODUCT FROM ORDER FORM ────────────────────────────────────────────
// Hides order form, opens modal; modal close restores order form automatically.
function openProductFromOrder(id) {
  const orderEl = document.getElementById('order-modal');
  orderEl.classList.remove('open');
  orderFormHidden = true;
  // body overflow stays hidden because product modal will open
  setTimeout(() => openModal(id), 300);
}

// ─── CART ─────────────────────────────────────────────────────────────────────
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }

function addToCart() {
  if (!modalProduct || !selectedSize) return;
  const key = `${modalProduct.id}__${selectedSize}`;
  const ex  = cart.find(x => x.key === key);
  if (ex) ex.qty++;
  else cart.push({
    key, id: modalProduct.id, name: modalProduct.name,
    brand: modalProduct.brand, size: selectedSize,
    price: modalProduct.price, qty: 1
  });
  saveCart(); updateCartCount();

  const cartBtn = document.getElementById('cart-toggle');
  if (cartBtn) { cartBtn.classList.remove('cart-bump'); void cartBtn.offsetWidth; cartBtn.classList.add('cart-bump'); }

  showToast(T[lang].added_toast);
  updateCartBtnState();
}

function updateCartCount() {
  const total = cart.reduce((s, x) => s + x.qty, 0);
  const badge = document.getElementById('cart-count');
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
  const mobBadge = document.getElementById('mob-cart-count');
  if (mobBadge) { mobBadge.textContent = total; mobBadge.style.display = total > 0 ? 'flex' : 'none'; }
}

function openCart()  { document.getElementById('cart-drawer').classList.add('open'); document.body.style.overflow = 'hidden'; renderCart(); }
function closeCart() { document.getElementById('cart-drawer').classList.remove('open'); document.body.style.overflow = ''; }

function renderCart() {
  const t        = T[lang];
  const itemsEl  = document.getElementById('cart-items');
  const footerEl = document.getElementById('cart-footer');
  document.getElementById('cart-title').textContent = t.cart_title;

  if (!cart.length) {
    itemsEl.innerHTML = `<div class="cart-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      <p>${t.cart_empty}</p>
    </div>`;
    footerEl.innerHTML = '';
    return;
  }

  itemsEl.innerHTML = cart.map(item => {
    const p         = PRODUCTS.find(x => x.id === item.id);
    const isShoe    = p?.category === 'Shoes';
    const sizeLabel = item.size.includes('/') ? item.size.split('/')[isShoe ? 1 : 0] : item.size;
    const imgSrc    = p ? getCardImgSrc(p) : '';
    return `<div class="cart-item">
      <img class="cart-item-img cart-item-img--clickable"
           src="${imgSrc}" alt="${item.name}"
           onclick="openProductFromCart('${item.id}')"
           onerror="this.style.display='none'"
           title="${t.view_product}">
      <div class="cart-item-body">
        <p class="cart-item-brand">${item.brand}</p>
        <p class="cart-item-name cart-item-name--clickable"
           onclick="openProductFromCart('${item.id}')">${item.name}</p>
        <p class="cart-item-meta">${lang === 'uk' ? 'Розмір' : 'Size'}: ${sizeLabel}</p>
        <p class="cart-item-price">${fmt(item.price * item.qty)}</p>
        <div class="cart-item-qty">
          <button type="button" class="qty-btn" onclick="changeQty('${item.key}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button type="button" class="qty-btn" onclick="changeQty('${item.key}', 1)">+</button>
        </div>
      </div>
      <button type="button" class="cart-item-remove"
              onclick="removeFromCart('${item.key}')">✕</button>
    </div>`;
  }).join('');

  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  footerEl.innerHTML = `
    <div class="cart-total-row">
      <span class="cart-total-label">${t.cart_total}</span>
      <span class="cart-total-price">${fmt(total)}</span>
    </div>
    <button type="button" class="btn-checkout"
            onclick="openOrderForm()">${t.checkout}</button>
    <button type="button" class="btn-clear-cart"
            onclick="clearCart()">${t.clear_cart}</button>`;
}

function openProductFromCart(id) {
  closeCart();
  setTimeout(() => openModal(id), 300);
}

function changeQty(key, delta) {
  const item = cart.find(x => x.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(x => x.key !== key);
  saveCart(); updateCartCount(); renderCart();
}
function removeFromCart(key) { cart = cart.filter(x => x.key !== key); saveCart(); updateCartCount(); renderCart(); }
function clearCart() { cart = []; saveCart(); updateCartCount(); renderCart(); }

// ─── ORDER FORM ───────────────────────────────────────────────────────────────
function openOrderForm() {
  if (!cart.length) return;
  currentStep      = 1;
  orderFormHidden  = false;
  selectedCityRef  = ''; selectedCityName = '';
  closeDrop('city-dropdown'); closeDrop('np-dropdown');

  ['f-name','f-phone','f-instagram','f-comment','f-address','f-city',
   'f-up-city','f-up-index','f-up-address'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const npInp = document.getElementById('f-np');
  if (npInp) {
    npInp.value       = '';
    npInp.disabled    = true;
    npInp.placeholder = lang === 'uk' ? 'Спочатку оберіть місто' : 'Select a city first';
  }

  const firstDelivery = document.querySelector('input[name="delivery"]');
  if (firstDelivery) { firstDelivery.checked = true; onDeliveryChange(firstDelivery.value); }
  const firstPayment = document.querySelector('input[name="payment"]');
  if (firstPayment) firstPayment.checked = true;

  const btn = document.getElementById('btn-order-submit');
  const txt = document.getElementById('btn-order-text');
  if (btn) btn.disabled = false;
  if (txt) txt.textContent = T[lang].submit_btn;

  document.getElementById('order-success').style.display = 'none';
  document.getElementById('order-success-details').innerHTML = '';
  renderOrderSummary();
  showStep(1);
  document.getElementById('order-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  closeCart();
}

function closeOrderForm() {
  document.getElementById('order-modal').classList.remove('open');
  orderFormHidden = false;
  document.body.style.overflow = '';
}

function changeOrderQty(key, delta) {
  const item = cart.find(x => x.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(x => x.key !== key);
  saveCart(); updateCartCount(); renderCart();
  if (!cart.length) { closeOrderForm(); return; }
  renderOrderSummary();
  if (currentStep === 3) renderConfirmBox();
}

function renderOrderSummary() {
  const summaryEl = document.getElementById('order-summary');
  if (!summaryEl) return;
  if (!cart.length) { summaryEl.innerHTML = ''; return; }

  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const t     = T[lang];

  summaryEl.innerHTML = `
    <div class="order-items-list">
      ${cart.map(item => {
        const p      = PRODUCTS.find(x => x.id === item.id);
        const isShoe = p?.category === 'Shoes';
        const sLabel = item.size.includes('/') ? item.size.split('/')[isShoe ? 1 : 0] : item.size;
        const imgSrc = p ? getCardImgSrc(p) : '';
        return `<div class="order-item-row">
          <img class="order-item-img order-item-img--clickable"
               src="${imgSrc}" alt="${item.name}"
               onclick="openProductFromOrder('${item.id}')"
               onerror="this.style.display='none'"
               title="${t.view_product}">
          <div class="order-item-info">
            <span class="order-item-brand">${item.brand}</span>
            <span class="order-item-name order-item-name--clickable"
                  onclick="openProductFromOrder('${item.id}')">${item.name}</span>
            <span class="order-item-size">${lang === 'uk' ? 'Розмір' : 'Size'}: ${sLabel}</span>
          </div>
          <div class="order-item-qty-wrap">
            <button type="button" class="qty-btn-sm"
                    onclick="changeOrderQty('${item.key}', -1)">−</button>
            <span class="qty-num-sm">${item.qty}</span>
            <button type="button" class="qty-btn-sm"
                    onclick="changeOrderQty('${item.key}', 1)">+</button>
          </div>
          <span class="order-item-price">${fmt(item.price * item.qty)}</span>
          <button type="button" class="order-item-delete"
                  onclick="changeOrderQty('${item.key}', -${item.qty})"
                  title="${lang === 'uk' ? 'Видалити' : 'Remove'}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>`;
      }).join('')}
    </div>
    <div class="order-summary-total">
      <span>${lang === 'uk' ? 'Разом' : 'Total'}</span>
      <span>${fmt(total)}</span>
    </div>`;
}

function showStep(n) {
  currentStep = n;
  document.querySelectorAll('.order-step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${n}`)?.classList.add('active');
  document.querySelectorAll('.order-step[data-step]').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done',   s < n);
  });
  if (n === 3) renderConfirmBox();
  const body = document.querySelector('.order-body');
  if (body) body.scrollTop = 0;
}

function goToStep(n) {
  if (n === 2) {
    const name  = document.getElementById('f-name')?.value.trim();
    const phone = document.getElementById('f-phone')?.value.trim();
    if (!name)  { markError('f-name');  return; }
    if (!phone || phone.replace(/\D/g, '').length < 9) { markError('f-phone'); return; }
  }
  if (n === 3) {
    const delivery  = document.querySelector('input[name="delivery"]:checked')?.value;
    const isCourier = delivery === 'nova_poshta_courier';
    const isUP      = delivery === 'ukrposhta';
    if (isUP) {
      if (!document.getElementById('f-up-city')?.value.trim())    { markError('f-up-city');    return; }
      if (!document.getElementById('f-up-index')?.value.trim())   { markError('f-up-index');   return; }
      if (!document.getElementById('f-up-address')?.value.trim()) { markError('f-up-address'); return; }
    } else {
      if (!document.getElementById('f-city')?.value.trim()) { markError('f-city'); return; }
      if (isCourier) {
        if (!document.getElementById('f-address')?.value.trim()) { markError('f-address'); return; }
      } else {
        if (!document.getElementById('f-np')?.value.trim()) { markError('f-np'); return; }
      }
    }
  }
  showStep(n);
}

function markError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--sale)';
  el.focus();
  el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
}

function onDeliveryChange(val) {
  const npGroup   = document.getElementById('np-group');
  const upGroup   = document.getElementById('up-group');
  const npRow     = document.getElementById('np-row');
  const addrRow   = document.getElementById('address-row');
  const npInp     = document.getElementById('f-np');
  const isCourier = val === 'nova_poshta_courier';
  const isUP      = val === 'ukrposhta';

  if (isUP) {
    if (npGroup) npGroup.style.display = 'none';
    if (upGroup) upGroup.style.display = 'flex';
  } else {
    if (npGroup) npGroup.style.display = 'block';
    if (upGroup) upGroup.style.display = 'none';
    if (isCourier) {
      if (npRow)   npRow.style.display   = 'none';
      if (addrRow) addrRow.style.display = 'block';
    } else {
      if (npRow)   npRow.style.display   = 'block';
      if (addrRow) addrRow.style.display = 'none';
    }
    if (npInp && !isCourier) {
      const isPoshtamat = val === 'nova_poshta_poshtamat';
      npInp.placeholder = selectedCityRef || selectedCityName
        ? (isPoshtamat
            ? (lang === 'uk' ? 'Введіть номер поштомату...' : 'Enter post office number...')
            : (lang === 'uk' ? 'Введіть номер або адресу відділення...' : 'Enter branch number or address...'))
        : (lang === 'uk' ? 'Спочатку оберіть місто' : 'Select a city first');
      npInp.value = '';
    }
  }
  closeDrop('np-dropdown');
  closeDrop('city-dropdown');
}

function renderConfirmBox() {
  const box = document.getElementById('order-confirm-box');
  if (!box) return;
  const delivery   = document.querySelector('input[name="delivery"]:checked')?.value || 'nova_poshta';
  const paymentVal = document.querySelector('input[name="payment"]:checked')?.value  || 'mono';
  const isCod      = paymentVal === 'cod';
  const total      = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const codFee     = isCod ? 20 : 0;
  const isCourier  = delivery === 'nova_poshta_courier';
  const isUP       = delivery === 'ukrposhta';

  let location = '—';
  if (isUP) {
    location = `${document.getElementById('f-up-city')?.value || ''}, індекс: ${document.getElementById('f-up-index')?.value || ''}, ${document.getElementById('f-up-address')?.value || ''}`;
  } else if (isCourier) {
    location = document.getElementById('f-address')?.value || '—';
  } else {
    location = document.getElementById('f-np')?.value || '—';
  }

  box.innerHTML = `
    <div class="confirm-row"><span>${lang === 'uk' ? 'Отримувач' : 'Recipient'}</span><strong>${document.getElementById('f-name')?.value || '—'}</strong></div>
    <div class="confirm-row"><span>${lang === 'uk' ? 'Телефон'   : 'Phone'}</span><strong>${document.getElementById('f-phone')?.value || '—'}</strong></div>
    <div class="confirm-row"><span>${lang === 'uk' ? 'Доставка'  : 'Delivery'}</span><strong>${DELIVERY_LABELS_UK[delivery] || delivery}</strong></div>
    <div class="confirm-row">
      <span>${isCourier || isUP ? (lang === 'uk' ? 'Адреса' : 'Address') : (lang === 'uk' ? 'Відділення' : 'Branch')}</span>
      <strong style="text-align:right;max-width:200px">${location}</strong>
    </div>
    <div class="confirm-row"><span>${lang === 'uk' ? 'Оплата' : 'Payment'}</span><strong>${PAYMENT_LABELS[paymentVal] || paymentVal}</strong></div>
    <div class="confirm-row confirm-total"><span>${lang === 'uk' ? 'Сума товарів' : 'Items total'}</span><strong>${fmt(total)}</strong></div>
    ${codFee ? `<div class="confirm-row"><span>${lang === 'uk' ? 'Накладений платіж' : 'COD fee'}</span><strong>+${fmt(codFee)}</strong></div>` : ''}
    <div class="confirm-row confirm-grand"><span>${lang === 'uk' ? 'До сплати' : 'Total due'}</span><strong>${fmt(total + codFee)}</strong></div>`;
}

async function submitOrder() {
  const btn = document.getElementById('btn-order-submit');
  const txt = document.getElementById('btn-order-text');
  if (btn) btn.disabled = true;
  if (txt) txt.textContent = T[lang].submitting;

  const delivery    = document.querySelector('input[name="delivery"]:checked')?.value || 'nova_poshta';
  const payVal      = document.querySelector('input[name="payment"]:checked')?.value  || 'mono';
  const isCourier   = delivery === 'nova_poshta_courier';
  const isUP        = delivery === 'ukrposhta';
  const isCod       = payVal === 'cod';
  const total       = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const totalAmount = total + (isCod ? 20 : 0);

  let finalCity = '', finalAddress = '', finalNP = '';
  if (isUP) {
    finalCity    = `${document.getElementById('f-up-city')?.value.trim()}, індекс: ${document.getElementById('f-up-index')?.value.trim()}`;
    finalAddress = document.getElementById('f-up-address')?.value.trim();
  } else {
    finalCity = document.getElementById('f-city')?.value.trim();
    if (isCourier) finalAddress = document.getElementById('f-address')?.value.trim();
    else           finalNP      = document.getElementById('f-np')?.value.trim();
  }

  const payload = {
    action: 'order',
    name:       document.getElementById('f-name')?.value.trim()      || '',
    phone:      document.getElementById('f-phone')?.value.trim()     || '',
    instagram:  document.getElementById('f-instagram')?.value.trim() || '',
    city: finalCity, novaPoshta: finalNP, address: finalAddress,
    deliveryType: DELIVERY_LABELS_UK[delivery] || delivery,
    paymentType:  PAYMENT_LABELS[payVal]       || payVal,
    codFee: isCod ? 20 : 0, totalAmount,
    comment: document.getElementById('f-comment')?.value.trim() || '',
    items: cart.map(i => ({ id: i.id, name: i.name, size: i.size, price: i.price, qty: i.qty })),
  };

  try {
    let orderId = '';
    if (API_URL && API_URL.startsWith('https://script.google')) {
      const res  = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.orderId) orderId = data.orderId;
      if (data.error)   throw new Error(data.error);
    } else {
      await new Promise(r => setTimeout(r, 600));
      orderId = 'ORD-' + Date.now().toString().slice(-4);
    }

    document.querySelectorAll('.order-step-content').forEach(el => el.classList.remove('active'));
    const successEl = document.getElementById('order-success');
    successEl.style.display = 'flex';

    const detailsBox = document.getElementById('order-success-details');
    if (payVal === 'mono') {
      detailsBox.innerHTML = `
        <div class="mono-pay-box">
          <p>Оплатіть замовлення на Банку:</p>
          <a href="${MONO_JAR_URL}" target="_blank" class="mono-pay-btn">
            Оплатити ${fmt(totalAmount)}
          </a>
          <p class="mono-warn">
            ОБ'ЯЗКОВО вкажіть у коментарі до платежу:<br>
            <strong>${orderId}</strong><br>
            та суму: <strong>${fmt(totalAmount)}</strong>
          </p>
        </div>`;
    } else {
      detailsBox.innerHTML = '';
    }

    const stitle = document.getElementById('order-success-title');
    const smsg   = document.getElementById('order-success-msg');
    const sid    = document.getElementById('order-success-id');
    if (stitle) stitle.textContent = payVal === 'mono' ? 'Замовлення створено!'        : T[lang].success_title;
    if (smsg)   smsg.textContent   = payVal === 'mono' ? 'Залишився один крок — оплата.' : T[lang].success_msg;
    if (sid && orderId) sid.textContent = `№ ${orderId}`;

    document.getElementById('order-summary').innerHTML = '';
    cart = []; saveCart(); updateCartCount(); renderCart();

  } catch {
    alert(lang === 'uk' ? 'Помилка відправки. Спробуйте ще раз.' : 'Submission error. Please try again.');
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = T[lang].submit_btn;
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── LANGUAGE ─────────────────────────────────────────────────────────────────
async function setLang(l) {
  lang = l; localStorage.setItem('lang', l);
  document.getElementById('lang-uk').classList.toggle('active', l === 'uk');
  document.getElementById('lang-en').classList.toggle('active', l === 'en');
  renderNav(); renderFilters(); renderGrid();
  // Re-render open modal with translated text
  if (modalProduct) {
    const text = await getProductText(modalProduct);
    renderModal(modalProduct, modalPhotoCache[modalProduct.id] || null, text);
  }
  if (document.getElementById('cart-drawer').classList.contains('open')) renderCart();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Language
  document.getElementById('lang-uk').addEventListener('click', () => setLang('uk'));
  document.getElementById('lang-en').addEventListener('click', () => setLang('en'));
  document.getElementById('lang-uk').classList.toggle('active', lang === 'uk');
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');

  // Desktop nav tabs
  document.getElementById('nav-all').addEventListener('click', () => {
    if (activeTab !== 'all') updateGridWithFade(() => { activeTab = 'all'; renderNav(); renderGrid(); updateFilterUI(); });
  });
  document.getElementById('nav-sale').addEventListener('click', () => {
    if (activeTab !== 'sale') updateGridWithFade(() => { activeTab = 'sale'; renderNav(); renderGrid(); updateFilterUI(); });
  });

  // Mobile bottom nav tabs
  document.getElementById('mob-nav-all')?.addEventListener('click', () => {
    if (activeTab !== 'all') updateGridWithFade(() => { activeTab = 'all'; renderNav(); renderGrid(); updateFilterUI(); });
  });
  document.getElementById('mob-nav-sale')?.addEventListener('click', () => {
    if (activeTab !== 'sale') updateGridWithFade(() => { activeTab = 'sale'; renderNav(); renderGrid(); updateFilterUI(); });
  });

  // Sort
  document.getElementById('filter-sort').addEventListener('change', e => {
    updateGridWithFade(() => { activeSort = e.target.value; renderGrid(); updateFilterUI(); });
  });

  // Desktop search
  const desktopSearch = document.getElementById('search-input');
  if (desktopSearch) {
    desktopSearch.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      const mob = document.getElementById('mobile-search-input');
      if (mob && mob !== document.activeElement) mob.value = e.target.value;
      renderGrid();
    });
  }

  // Mobile search
  const mobileSearch = document.getElementById('mobile-search-input');
  if (mobileSearch) {
    mobileSearch.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      const desk = document.getElementById('search-input');
      if (desk && desk !== document.activeElement) desk.value = e.target.value;
      renderGrid();
    });
  }

  // Modal controls
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);

  // Cart
  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeCart(); closeFilters(); closeOrderForm(); }
    if (!document.getElementById('modal').classList.contains('open')) return;
    if (e.key === 'ArrowLeft')  changePhoto(-1);
    if (e.key === 'ArrowRight') changePhoto(1);
  });

  // Close NP dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.np-autocomplete-wrap')) {
      closeDrop('city-dropdown');
      closeDrop('np-dropdown');
    }
  });

  // Browser back button — close modal if opened via hash
  window.addEventListener('popstate', () => {
    if (!location.hash && document.getElementById('modal').classList.contains('open')) {
      document.getElementById('modal').classList.remove('open');
      document.body.style.overflow = '';
      modalProduct = null; selectedSize = null;
    } else if (location.hash) {
      checkURLHash();
    }
  });

  updateCartCount();
  fetchProducts();
});
