# النشر على Azure Static Web Apps

## تصحيح معماري مهم (اقرأ قبل البدء)

الخطة الأولى افترضت أن المتصفح يستطيع الاتصال مباشرة بروابط تشغيل Power Automate. بعد التحقق، تبيّن أن مشغّل "When an HTTP request is received" **لا يعيد رؤوس CORS** إطلاقاً — أي طلب `fetch()` من متصفح مباشرة إلى رابط التدفق سيُرفض من المتصفح نفسه قبل وصوله لـ Power Automate. لذلك أُضيف مجلد `api/` كوسيط بسيط جداً (3 دوال Azure Functions، بلا أي منطق مصادقة أو Entra ID) يستقبل الطلب من الموقع (نفس النطاق، بلا مشاكل CORS) ويمرره لـ Power Automate من جهة الخادم. هذا يحل مشكلة CORS **ويحسّن الأمان أيضاً**: روابط التدفقات تُخزَّن كمتغيرات بيئة في إعدادات Azure، ولا تظهر في كود الموقع ولا في متصفح أي مستخدم إطلاقاً.

## ما تم تجهيزه

- `index.html`: نسخة مستقلة من اللوحة، تتضمن نظام مزامنة سحابية يتصل بـ `/api/cloud-save` و`/api/cloud-load` و`/api/cloud-upload` (مسارات داخل نفس الموقع).
- `api/`: ثلاث دوال Azure Functions صغيرة (Node.js، بلا اعتماديات خارجية) تُمرّر الطلبات لـ Power Automate من جهة الخادم فقط.
- `staticwebapp.config.json`: رؤوس حماية للموقع (CSP يسمح بالاتصال بالنطاق الذاتي `'self'` فقط، وهو كافٍ لأن كل الاتصالات السحابية تمر عبر `/api/`).
- `site.webmanifest` و`sw.js`: تثبيت PWA والتشغيل دون اتصال.

## خطوات النشر

1. أنشئ مستودع GitHub خاصاً (تحت حسابك الشخصي)، وانقل إليه محتويات هذا المجلد كاملة (بما فيها `api/`).
2. من Azure Portal (تحت اشتراكك الشخصي)، أنشئ **Azure Static Web App** بالخطة المجانية، واختر المستودع والفرع `main`. عند سؤالك عن مسار الواجهة والـ API، اضبط: `App location: /`, `Api location: api`, `Output location: (فارغ)`.
3. سيُنشئ Azure تلقائياً GitHub Secret باسم `AZURE_STATIC_WEB_APPS_API_TOKEN` وملف Workflow للنشر التلقائي.
4. أنشئ تنبيه تكلفة (Cost Alert) بقيمة صفرية على مستوى الاشتراك.

## بناء تدفقات Power Automate الثلاثة

لكل تدفّق: Power Automate → **"+ إنشاء"** → **"تدفق سحابي فوري" (Instant cloud flow)** → اختر مشغّل **"When an HTTP request is received"**. في إعداد **"Who can trigger the flow?"** اختر **Anyone** (الاستدعاء يأتي من دالة Azure من جهة الخادم لا من متصفح مستخدم موثّق، فلا حاجة لتوكن Azure AD؛ الحماية هنا هي رابط SAS السري نفسه). لتوليد Schema الطلب تلقائياً، الصق نموذج JSON في خيار **"Use sample payload to generate schema"** بدل كتابته يدوياً، ثم احذف الحقول الاختيارية من مصفوفة `required` الناتجة.

### 1) تدفّق الحفظ (Save)
- Schema: نموذج مطابق لبنية إخراج `collectFullState()` في الكود (`{version, savedAt, schoolName, kpiSnapshot, indicators:{...}}`).
- أنشئ يدوياً مرة واحدة ملف `data/progress.json` (بمحتوى `{}`) داخل مكتبة "بيانات-المنصة" في SharePoint — هذا يبسّط التدفّق لاستخدام **"Update file"** دائماً بدل التحقق الشرطي من وجود الملف.
- إجراء SharePoint **"Update file"**: الموقع = موقع المدرسة، المكتبة = "بيانات-المنصة"، المسار = `data/progress.json`، المحتوى = جسم الطلب الوارد (`triggerBody()`) محوّلاً لنص.
- إجراء **"Response"**: Status 200، Body: `{"status":"ok"}`.

### 2) تدفّق التحميل (Load)
- بلا Schema مطلوب (اتركه فارغاً).
- إجراء SharePoint **"Get file content"** لنفس المسار `data/progress.json`.
- إجراء **"Response"**: Headers `Content-Type: application/json`، Body = مخرجات "Get file content" مباشرة (هي نفسها تحتوي `savedAt` من آخر حفظة، فتُستخدم تلقائياً لكشف التعارضات دون أي إجراء إضافي).

### 3) تدفّق رفع الشواهد (Upload)
- Schema من نموذج: `{"indicatorId":"1-1-1-1","fileName":"شاهد.jpg","fileContentBase64":"..."}`.
- إجراء SharePoint **"Create file"**: المسار = `evidence/@{triggerBody()?['indicatorId']}/@{triggerBody()?['fileName']}`، المحتوى = `base64ToBinary(triggerBody()?['fileContentBase64'])`.
- إجراء **"Response"**: Body = `{"url": "<رابط الملف الناتج من Create file>"}`.

اختبر كل تدفّق من داخل محرّر Power Automate نفسه عبر **"Test" → "Manually"** قبل ربطه — لا حاجة لأدوات خارجية.

## ربط الروابط بالموقع (خطوة أخيرة، من طرفك فقط)

من Azure Portal → مورد Static Web App → **Configuration / Application settings** → أضف 3 متغيرات:

| الاسم | القيمة |
|---|---|
| `POWER_AUTOMATE_SAVE_URL` | رابط تشغيل تدفّق الحفظ |
| `POWER_AUTOMATE_LOAD_URL` | رابط تشغيل تدفّق التحميل |
| `POWER_AUTOMATE_UPLOAD_URL` | رابط تشغيل تدفّق الرفع |

هذه الروابط لا تُكتب في الكود ولا في GitHub إطلاقاً — تُضبط هنا فقط، ويقرأها `api/` وقت التشغيل. بعد الحفظ، الموقع سيزامن تلقائياً دون أي إعداد إضافي من طرف أعضاء اللجنة.

## نقاط يجب معرفتها (قيود Power Automate الفعلية)

- المشغّل **"When an HTTP request is received" هو Premium** — تحقق أن ترخيص Microsoft 365 المدرسي يشمل Power Automate Premium، وإلا فالتدفقات لن تعمل.
- مهلة الاستجابة القصوى **120 ثانية** — كافية جداً لحجم بيانات هذا الموقع.
- الحد الأقصى لحجم الطلب **~100 ميجابايت** — بعيد عن الحاجة الفعلية (الصور محدودة بـ1 ميجا من طرف الموقع أصلاً).
- عند نقل التدفقات لبيئة Azure أخرى (تطوير/إنتاج) يتغيّر الرابط تلقائياً — حدّث متغيرات البيئة في Application Settings عند أي نقل.
