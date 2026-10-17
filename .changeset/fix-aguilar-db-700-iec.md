---
"catalog": patch
---

Fix: the Aguilar DB 700's mains inlet is an IEC C14.

The import wrote the bare `iec`, which the connection vocabulary does
not hold, so the strict E130 on `main` refused every validation run
after it merged.
