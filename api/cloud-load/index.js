// يجلب آخر نسخة محفوظة مباشرة من Azure Blob Storage ويعيدها كما هي للمتصفح.
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
    const blockBlobClient = containerClient.getBlockBlobClient(BLOB_NAME);

    const exists = await blockBlobClient.exists();
    if (!exists) {
      context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' };
      return;
    }

    const downloadResponse = await blockBlobClient.download();
    const text = await streamToText(downloadResponse.readableStreamBody);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'تعذر التحميل من التخزين السحابي' } };
  }
};

async function streamToText(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
