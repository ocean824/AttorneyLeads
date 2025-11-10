
export async function sendSms(to: string, text: string): Promise<void> {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.log("==== DEV SMS (no Twilio configured) ====");
    console.log("TO:", to);
    console.log("TEXT:", text);
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({ To: to, From: from, Body: text });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
               "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn("Twilio send failed:", res.status, t);
  }
}
