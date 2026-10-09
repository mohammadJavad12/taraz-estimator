// ============================================
// پیکربندی دروس
// ترتیب باید دقیقاً با COLS در پایتون یکی باشد
// ============================================
const SUBJECTS = [
    { id: 'bio',  label: 'زیست‌شناسی' },
    { id: 'phy',  label: 'فیزیک' },
    { id: 'chem', label: 'شیمی' },
    { id: 'math', label: 'ریاضی' },
    { id: 'zamin' , label:"زمین شناسی"}
];

// ============================================
// کش کردن پارامترهای تبدیلات
// ============================================
const preprocCache = {};

// ============================================
// شروع
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    buildForm();
    await loadModels();
    populateExamList();
    setupEventListeners();
});

// ============================================
// ساخت فرم به صورت داینامیک
// ============================================
function buildForm() {
    const container = document.getElementById('subjects-container');
    container.innerHTML = '';
    
    SUBJECTS.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="${sub.id}">${sub.label} (%)</label>
            <input id="${sub.id}" type="number" min="0" max="100" step="0.01"
                   placeholder="مثلاً 73.33" inputmode="decimal">
        `;
        container.appendChild(div);
    });
}

// ============================================
// لود کردن داینامیک مدل‌های JS
// ============================================
async function loadModels() {
    if (typeof AVAILABLE_EXAMS === 'undefined') {
        console.error('AVAILABLE_EXAMS تعریف نشده. list.js را چک کن.');
        return;
    }
    
    const promises = AVAILABLE_EXAMS.map(exam => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `js_models/${exam}.js`;
            script.onload = () => {
                console.log(`✓ مدل ${exam} لود شد`);
                resolve();
            };
            script.onerror = () => {
                console.error(`✗ خطا در لود مدل ${exam}`);
                resolve();
            };
            document.head.appendChild(script);
        });
    });
    
    await Promise.all(promises);
}

// ============================================
// پر کردن لیست آزمون‌ها  ← این بخش خالی بود
// ============================================
function populateExamList() {
    const select = document.getElementById('exam');
    select.innerHTML = '';
    
    if (typeof AVAILABLE_EXAMS === 'undefined' || AVAILABLE_EXAMS.length === 0) {
        select.innerHTML = '<option value="">مدلی موجود نیست</option>';
        return;
    }
    
    AVAILABLE_EXAMS.forEach(exam => {
        const option = document.createElement('option');
        option.value = exam;
        option.textContent = formatExamName(exam);
        select.appendChild(option);
    });
    
    console.log(`✓ ${AVAILABLE_EXAMS.length} آزمون در لیست قرار گرفت`);
}

// ============================================
// تبدیل اسم آزمون به فرمت خوانا
// ============================================
function formatExamName(name) {
    return name
        .split('_')
        .map(word => {
            if (/^\d+$/.test(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

// ============================================
// رویدادها
// ============================================
function setupEventListeners() {
    document.getElementById('predictBtn').addEventListener('click', predict);
    
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') predict();
        });
    });
}

// ============================================
// لود کردن پارامترهای تبدیلات
// ============================================
async function loadPreproc(exam) {
    if (preprocCache[exam]) return preprocCache[exam];
    const res = await fetch(`js_models/${exam}_preproc.json`);
    const data = await res.json();
    preprocCache[exam] = data;
    return data;
}

// ============================================
// Polynomial Features (درجه ۲)
// ============================================
function polynomialFeatures(inputs, degree) {
    const result = [...inputs];
    
    if (degree >= 2) {
        for (let i = 0; i < inputs.length; i++) {
            result.push(inputs[i] * inputs[i]);
        }
        for (let i = 0; i < inputs.length; i++) {
            for (let j = i + 1; j < inputs.length; j++) {
                result.push(inputs[i] * inputs[j]);
            }
        }
    }
    return result;
}

// ============================================
// پیش‌بینی کامل
// ============================================
async function predict() {
    const exam = document.getElementById('exam').value;
    if (!exam) { showError('آزمون را انتخاب کنید'); return; }
    
    const inputs = SUBJECTS.map(sub => {
        const v = parseFloat(document.getElementById(sub.id).value);
        return isNaN(v) ? 0 : v;
    });
    
    console.log('📥 inputs:', inputs);
    console.log('📥 exam:', exam);
    
    if (inputs.every(v => v === 0)) {
        showError('حداقل یک درصد را وارد کنید');
        return;
    }
    
    try {
        const preproc = await loadPreproc(exam);
        console.log('📥 preproc:', preproc);
        
        const polyFeatures = polynomialFeatures(inputs, preproc.poly_degree);
        console.log('📥 polyFeatures:', polyFeatures);
        
        const scaled = polyFeatures.map((v, i) =>
            (v - preproc.scaler_mean[i]) / preproc.scaler_scale[i]
        );
        console.log('📥 scaled:', scaled);
        
        const scoreFn = window[`score_${exam}`];
        console.log('📥 scoreFn:', typeof scoreFn);
        
        if (typeof scoreFn !== 'function') {
            showError('مدل پیدا نشد');
            return;
        }
        
        const taraz = scoreFn(scaled);
        console.log('📥 taraz:', taraz);
        
        showResult(Math.round(taraz));
        
    } catch (err) {
        console.error(err);
        showError('خطا در محاسبه');
    }
}

// ============================================
// نمایش نتیجه
// ============================================
function showResult(taraz) {
    const result = document.getElementById('result');
    result.innerHTML = `
        <div class="label">تراز تخمینی شما</div>
        <div class="value">${taraz.toLocaleString('fa-IR')}</div>
    `;
    result.classList.add('show');
    document.getElementById('error').classList.remove('show');
}

function showError(message) {
    const error = document.getElementById('error');
    error.textContent = message;
    error.classList.add('show');
    document.getElementById('result').classList.remove('show');
}