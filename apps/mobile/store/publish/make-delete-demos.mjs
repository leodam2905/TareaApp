// Creates the two expendable accounts whose only job is to be deleted by an
// App Review / Play reviewer demonstrating Guideline 5.1.1.
//
// Re-runnable: if an account already exists the register call fails and we say
// so. After every review round, run this again to replace whichever was erased.
const API = "https://taptarea.com/api";
const ACCOUNTS = [
  { email: "delete-me@taptarea.com",     name: "Delete Me (Customer Demo)", role: "CUSTOMER", phone: "+13105550188" },
  { email: "delete-me-pro@taptarea.com", name: "Delete Me (Pro Demo)",      role: "HANDYMAN", phone: "+13105550189" },
];
const PASSWORD = "DeleteDemo2026!";
for (const a of ACCOUNTS) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...a, password: PASSWORD }),
  });
  const body = await res.text();
  console.log(`${a.email.padEnd(30)} register -> ${res.status} ${body.slice(0, 120)}`);
  const login = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: a.email, password: PASSWORD }),
  });
  const ld = await login.json().catch(() => ({}));
  console.log(`${" ".repeat(30)} login    -> ${login.status} ${ld.token ? "token OK (no OTP)" : JSON.stringify(ld).slice(0, 90)}`);
}
