# packages/address — shared address rules (code, v1 slice)

Ek hi jagah se address ke rules — pehle ye list aur validation
mail-api (aur auth-api) me copy-paste thi, isliye dono me drift ho
sakta tha. Ab ye package ek hi source hai.

Is slice me **mail-api is package par migrate hua hai**; auth-api
ka migration coordinator karega — tab tak auth-api ki apni copy
rehti hai, isliye drift ka risk tab tak poori tarah khatam nahi
hua hai.

## API

- `RESERVED_LOCAL_PARTS` — verbatim 13 reserved local-parts
  (abuse, account, admin, help, hostmaster, info, mail, no-reply,
  noreply, postmaster, security, support, webmaster). Bina
  docs/decision ke ek bhi entry mat badlo.
- `AddressError` — package ki apni error (code + message).
  Kisi service ke ApiError par depend nahi karti, taaki ye
  package kisi service ko import na kare. Service isko pakad kar
  apne ApiError (same code/message) me badalta hai, taaki API
  contract same rahe.
- `validateAliasAddress(address, primaryEmail)` — lowercase
  address return karta hai, warna AddressError throw karta hai.
  Rules (docs/29, starting proposals — locks nahi): ek hi address
  (ek @), Phase 1 single-domain (alias apne domain par hi),
  local part 3-64 chars sirf a-z 0-9 . _ -, dot se shuru/khatam
  nahi, consecutive dots nahi, reserved reject, primary address
  ke barabar reject.

## Nahi karega

DB call, API call, secret access, doosre @dusrel package ka
import. ZERO runtime deps (sirf Node built-ins + dev me
TypeScript / @types/node).
