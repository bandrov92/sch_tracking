# النشر على Azure Static Web Apps

## المعمارية الحالية (Azure Blob Storage)

المزامنة السحابية للبيانات العامة تعتمد الآن على **Azure Blob Storage** مباشرة، تحت اشتراك Azure الشخصي، بدل Power Automate. السبب: مشغّل Power Automate "When an HTTP request is received" **لا يدعم الحسابات الشخصية (Personal Microsoft Account)** — خطأ `AADSTS500200` — وهو قيد ثابت من مايكروسوفت لا حل تقني له تحت حساب شخصي.

- `index.html`: نسخة مستقلة من اللوحة، تتضمن نظام مزامنة سحابية يتصل بـ `/api/cloud-save` و`/api/cloud-load` (مسارات داخل نفس الموقع، بلا مشاكل CORS).
- `api/`: دالتا Azure Functions (Node.js) تتصلان مباشرة بـ Azure Blob Storage عبر حزمة `@azure/storage-blob`، باستخدام سلسلة اتصال مخزّنة كمتغير بيئة — لا تظهر في الكود أو المتصفح أبداً.
- `staticwebapp.config.json`: رؤوس حماية للموقع (CSP يسمح بالاتصال بالنطاق الذاتي `'self'` فقط).
- `site.webmanifest` و`sw.js`: تثبيت PWA والتشغيل دون اتصال.

البيانات تُخزَّن كملف واحد `progress.json` داخل حاوية (container) باسم `platform-data` في حساب التخزين. عند الحفظ، الدالة تكتب فوق الملف بالكامل (upload بسيط). عند التحميل، تُقرأ محتوياته وتُعاد كما هي — وتتضمن `savedAt` من آخر حفظة، فيُستخدم تلقائياً لكشف التعارضات دون أي إجراء إضافي.

## خطوات النشر (مرة واحدة)

1. أنشئ مستودع GitHub خاصاً (تحت حسابك الشخصي)، وانقل إليه محتويات هذا المجلد كاملة (بما فيها `api/`).
2. من Azure Portal (تحت اشتراكك الشخصي)، أنشئ **Azure Static Web App** بالخطة المجانية، واختر المستودع والفرع `main`. عند سؤالك عن مسار الواجهة والـ API، اضبط: `App location: /`, `Api location: api`, `Output location: (فارغ)`.
3. سيُنشئ Azure تلقائياً GitHub Secret باسم `AZURE_STATIC_WEB_APPS_API_TOKEN` وملف Workflow للنشر التلقائي.
4. أنشئ تنبيه تكلفة (Cost Alert) بقيمة صفرية على مستوى الاشتراك.

## إنشاء حساب التخزين (Storage Account)

الأسهل والأكثر موثوقية هو **Azure Cloud Shell** (أيقونة `>_` أعلى الـ Portal) بدل تعبئة نموذج الإنشاء يدوياً — الصق هذا السكربت (بعد تعديل الاسم إن لزم، فالاسم يجب أن يكون فريداً عالمياً):

```bash
RG=school-platform-rg
LOCATION=centralus
STORAGE=abdullahschdata2026

az storage account create \
  --name $STORAGE \
  --resource-group $RG \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --account-name $STORAGE \
  --name platform-data \
  --auth-mode login

echo '{}' > progress.json
az storage blob upload \
  --account-name $STORAGE \
  --container-name platform-data \
  --name progress.json \
  --file progress.json \
  --auth-mode login \
  --overwrite

az storage account show-connection-string \
  --name $STORAGE \
  --resource-group $RG \
  --output tsv
```

انسخ سلسلة الاتصال (Connection string) الناتجة من آخر أمر — ستحتاجها في الخطوة التالية.

## ربط سلسلة الاتصال بالموقع

من Azure Portal → مورد Static Web App → **Configuration / Application settings** (أو عبر CLI أدناه)، أضف متغيراً واحداً:

| الاسم | القيمة |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | سلسلة الاتصال الكاملة (`DefaultEndpointsProtocol=...`) |

عبر CLI (الأسهل، من نفس Cloud Shell):

```bash
APP_NAME=$(az staticwebapp list --query "[0].name" -o tsv)

az staticwebapp appsettings set \
  --name "$APP_NAME" \
  --setting-names AZURE_STORAGE_CONNECTION_STRING="<الصق سلسلة الاتصال هنا>"
```

هذه السلسلة لا تُكتب في الكود ولا في GitHub إطلاقاً — تُضبط هنا فقط، ويقرأها `api/` وقت التشغيل. بعد الحفظ، الموقع سيزامن تلقائياً دون أي إعداد إضافي من طرف أعضاء اللجنة.

## نقاط يجب معرفتها

- الحد الأقصى لحجم Blob واحد بهذه الطريقة (Block Blob) ضخم جداً (تيرابايتات) — بعيد كل البعد عن حجم بيانات هذا الموقع.
- التخزين بنمط **LRS (Locally-redundant)** أرخص من GRS وكافٍ تماماً لملف JSON صغير؛ يمكن ترقيته لاحقاً من Portal إن احتجت تكراراً جغرافياً.
- عند نقل الموقع لبيئة Azure أخرى (تطوير/إنتاج) أو تدوير مفتاح الوصول، حدّث `AZURE_STORAGE_CONNECTION_STRING` في Application Settings.

## ميزة مؤجلة: رفع الشواهد بحساب المدرسة الرسمي

السجلات الرسمية (الشواهد، الصور، الفيديوهات) من المخطط حفظها لاحقاً تحت **حساب المدرسة الرسمي** (SharePoint عبر Power Automate)، منفصلة عن بيانات المتابعة العامة المخزّنة الآن في Blob Storage الشخصي. عند البدء بهذه الميزة:

- Schema من نموذج: `{"indicatorId":"1-1-1-1","fileName":"شاهد.jpg","fileContentBase64":"..."}`.
- إجراء SharePoint **"Create file"**: المسار = `evidence/@{triggerBody()?['indicatorId']}/@{triggerBody()?['fileName']}`، المحتوى = `base64ToBinary(triggerBody()?['fileContentBase64'])`.
- إجراء **"Response"**: Body = `{"url": "<رابط الملف الناتج من Create file>"}`.
- يُضاف رابط التدفق كمتغير بيئة منفصل (`POWER_AUTOMATE_UPLOAD_URL`) في دالة `api/cloud-upload` جديدة.
- المشغّل **"When an HTTP request is received" Premium** — يتطلب ترخيص Microsoft 365 المدرسي شاملاً Power Automate Premium.
