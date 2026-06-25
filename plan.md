# Final Execution Plan: "Hands Off" Web Agency (Hackathon Edition)

This plan incorporates your specific technical preferences and ensures a high-impact demo for the Cursor Hands Off London Hackathon.

## 1. Technical Stack Refinement

| Component              | Choice                      | Implementation Detail                                                                                                                                                    |
| :--------------------- | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lead Generation**    | **Outscraper** or **Apify** | Use a Google Maps Scraper API (both have free tiers/trials). This is more reliable than custom scraping.                                                                 |
| **Website Generation** | **Agent-Generated Code**    | Instead of a builder, use **Manus AI** or **GPT-4o/Claude 3.5** to generate a single-page React/Tailwind site. Host it instantly on **Vercel** or **Netlify** (via CLI). |
| **Orchestration**      | **Manus AI** (Primary)      | Use Manus to coordinate the flow. As a fallback, use a simple **Node.js/Python script** to chain the LLM calls.                                                          |
| **Financials**         | **PayPal Sandbox**          | Use the `paypal-rest-sdk` to generate an "Order" and get a `checkout_url`.                                                                                               |
| **Communication**      | **Wassist**                 | Use your existing Wassist setup to send the Vercel URL and the PayPal link.                                                                                              |

## 2. The "Golden Path" Implementation

### 1: The "Hunt" (Lead Gen & Database)

1.  **Lead Gen**: Call the **Outscraper Google Maps API** via a **Modal** function. Filter for businesses where `website` is `null`.
2.  **Storage**: Push `name`, `full_address`, and `phone` to **Supabase**. Set `status` to `NEW`.
3.  **Visual**: Keep the Supabase dashboard open on one screen.

### 2: The "Build" (AI-Generated Sites)

1.  **The Prompt**: Manus (or your script) takes the business name and niche. It generates a high-quality `index.html` (with Tailwind CSS).
2.  **Deployment**: Use the **Vercel CLI** (or a simple GitHub Action) to deploy the code.
3.  **Storage**: Save the `deployment_url` to Supabase. Update `status` to `SITE_READY`.

### 3: The "Approach" (Wassist Outreach)

1.  **Outreach**: Manus triggers **Wassist** to send a WhatsApp message: _"Hi {{name}}, I noticed you don't have a website. I built this for you: {{deployment_url}}. Interested?"_
2.  **Conversion**: When the "client" (you, for the demo) replies "YES," the system moves to the next stage.

### 4: The "Payday" (PayPal Integration)

1.  **Invoice**: Call the **PayPal Sandbox API** to create a $99 "Website Setup" order.
2.  **Delivery**: Wassist sends the PayPal link: _"Great! You can claim it here: {{paypal_link}}."_
3.  **Demo**: Show the money hitting your PayPal Sandbox merchant account.

## 3. Demo "Mic Drop" Moments

- **The "Hands Off" Proof**: Start the script, then walk away from your laptop. Let the judges see the leads pop into Supabase and the WhatsApp messages arrive on your phone automatically.
- **The Code Generation**: Show the actual HTML/Tailwind code being written by the AI in real-time.
- **The Real Transaction**: Complete the PayPal checkout live. Nothing beats seeing a "Payment Successful" screen.

## 4. Immediate Next Steps (Tonight)

- [ ] Get an API key for **Outscraper** or **Apify**.
- [ ] Install **Vercel CLI** and log in (`npm install -g vercel`).
- [ ] Verify your **PayPal Sandbox** credentials work with a simple `curl` command.
- [ ] Set up your **Supabase** project and table.

This plan is lean, uses the sponsor stack effectively, and demonstrates true autonomy. Go get that 1st place! 🤌 🚀
