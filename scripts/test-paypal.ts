import "../src/lib/env.js";
import { createCheckoutOrder } from "../src/lib/paypal.js";

createCheckoutOrder("Ali's Hackathon Cafe")
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => console.error("ERR:", e instanceof Error ? e.message : e));
