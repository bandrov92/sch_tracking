// يجلب آخر نسخة محفوظة من تدفق التحميل في Power Automate ويعيدها كما هي للمتصفح.
module.exports = async function (context, req) {
  const url = process.env.POWER_AUTOMATE_LOAD_URL;
  if (!url) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'POWER_AUTOMATE_LOAD_URL غير مضبوط في إعدادات Azure' } };
    return;
  }
  try {
    const upstream = await fetch(url, { method: 'POST' });
    const text = await upstream.text();
    context.res = {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'تعذر الاتصال بتدفق التحميل' } };
  }
};
