# 🛍️ Store — Інструкція з налаштування

## Структура папки
```
store/
├── index.html          ← головна сторінка
├── css/
│   └── style.css       ← стилі
├── js/
│   └── app.js          ← логіка та дані товарів
└── images/             ← ВСІ фото та логотип сюди
```

---

## 🖼️ Як додавати фото

### Логотип
- Помісти файл `logo.png` в папку `images/`
- Якщо файл не знайдено — автоматично відобразиться текст "STORE"

### Фото товарів
Назви файлів = Назва з колонки "Назва" + `_1`, `_2` ... `_6`

**Приклади:**
```
images/BAPE Sweater – Twin Ape Embroidery_1.png
images/BAPE Sweater – Twin Ape Embroidery_2.jpg
images/BAPE Sweater – Twin Ape Embroidery_3.webp
images/Nike P-6000_1.jpg
images/Nike P-6000_2.png
```

**Правила:**
- Підтримуються формати: `.png`, `.jpg`, `.webp`, `.jpeg`
- Від 1 до 6 фото на товар
- Якщо фото немає — картка відображається без фото (без помилок)
- Фото автоматично знаходяться по назві з `_1.png` до `_6.webp` — перебирає всі формати

---

## 🚀 Як запустити

### Варіант 1 — Live Server (рекомендовано)
1. Відкрий VS Code
2. Відкрий папку `store/`
3. Встанови розширення **Live Server** (якщо ще не встановлено)
4. Правий клік на `index.html` → **Open with Live Server**
5. Сайт відкриється на `http://127.0.0.1:5500`

### Варіант 2 — звичайне відкриття
- Просто двічі клікни на `index.html`
- ⚠️ Фото можуть не завантажуватись через обмеження браузера (CORS)
- Live Server вирішує цю проблему

---

## ✏️ Як оновити товари

Всі товари знаходяться у файлі `js/app.js` — масив `PRODUCTS` на початку файлу.

Кожен товар має структуру:
```js
{
  id: "001-001-001",
  brand: "Nike",
  name: "Nike P-6000",           // ← ця назва використовується для пошуку фото
  nameEn: "Nike P-6000",
  category: "Shoes",             // Shoes / T-shirt / Sweatshirt / Jacket / Pants / Longsleeve / Shirt
  price: 2300,
  oldPrice: 2300,
  onSale: false,
  sizes: {
    "S/39": "3", "M/40": "2", "L/41": "5", "XL/42": "2", "XXL/43": "2"
  },
  desc: "Опис українською...",
  descEn: "Description in English...",
  material: "...",
  care: "...",
  measurements: "..."
}
```

---

## 🔗 Кнопка Instagram
У файлі `js/app.js` знайди рядок:
```js
href="https://instagram.com"
```
Заміни на посилання свого Instagram профілю, наприклад:
```js
href="https://instagram.com/yourshopname"
```

---

## 🎨 Зміна назви сайту
У `index.html` знайди:
```html
<span class="logo-text" style="display:none">STORE</span>
```
Заміни `STORE` на назву свого магазину.

Також зміни `<title>Store</title>` на початку файлу.
