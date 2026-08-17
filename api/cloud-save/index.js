// يستقبل حالة الموقع الكاملة من المتصفح (نفس النطاق، بلا مشاكل CORS)
// ويحفظها مباشرة في Azure Blob Storage (حساب Azure الشخصي للمستخدم) — بلا وسيط Power Automate.
// سلسلة الاتصال تُقرأ من متغير بيئة AZURE_STORAGE_CONNECTION_STRING (Application Settings في Azure)
// — لا تظهر في الكود أو المتصفح أبداً.
const { BlobServiceClient } = require('@azure/storage-blob');

const CONTAINER_NAME = 'platform-data';
const BLOB_NAME = 'progress.json';

module.exports = async function (context, req) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'AZURE_STORAGE_CONNECTION_STRING غير مضبوط في إعدادات Azure' } };
    return;
  }
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(BLOB_NAME);

    const payload = JSON.stringify(req.body || {});
    await blockBlobClient.upload(payload, Buffer.byteLength(payload), {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'ok' }
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'تعذر الحفظ في التخزين السحابي' } };
  }
};
