// وسيط بسيط: يستقبل حالة الموقع الكاملة من المتصفح (نفس النطاق، بلا مشاكل CORS)
// ويمررها لتدفق الحفظ في Power Automate من جهة الخادم.
// رابط التدفق يُقرأ من متغير بيئة (Application Settings في Azure) — لا يظهر في الكود أو المتصفح أبداً.
module.exports = async function (context, req) {
  const url = process.env.POWER_AUTOMATE_SAVE_URL;
  if (!url) {
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'POWER_AUTOMATE_SAVE_URL غير مضبوط في إعدادات Azure' } };
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
      body: text || JSON.stringify({ status: upstream.ok ? 'ok' : 'error' })
    };
  } catch (err) {
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'تعذر الاتصال بتدفق الحفظ' } };
  }
};
