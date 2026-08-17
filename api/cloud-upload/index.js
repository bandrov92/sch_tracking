// يمرر ملف شاهد (صورة) بصيغة base64 إلى تدفق الرفع في Power Automate،
// ويعيد رابط الملف الناتج داخل SharePoint للمتصفح.
module.exports = async function (context, req) {
  const url = process.env.POWER_AUTOMATE_UPLOAD_URL;
  if (!url) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'POWER_AUTOMATE_UPLOAD_URL غير مضبوط في إعدادات Azure' } };
    return;
  }
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const text = await upstream.text();
    context.res = {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'تعذر الاتصال بتدفق الرفع' } };
  }
};
