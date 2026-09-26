# Infrastructure Financial Model & Cost Analysis (INR)

This is a comprehensive financial model for your startup. *All costs are converted to Indian Rupees (INR) at an exchange rate of $1 = ₹100.*

---

## 1. Unit Economics (Cost per Platform)

*   **Backblaze B2:** 
    *   **Storage:** ₹600 per TB/month ($0.006/GB/mo). First 10 GB free.
    *   **Bandwidth (Egress):** **₹0** (100% free egress via Cloudflare Bandwidth Alliance).
    *   **Class B Transactions (Metadata/Downloads):** 75,000 requests/month free (2,500/day). Overages cost $0.004 per 10,000 requests (~₹0.40 per 10k). Estimated at ~₹50 per photographer/year.
    *   **Class C Transactions (Uploads/Creation):** 75,000 requests/month free (2,500/day). Overages cost $0.004 per 1,000 requests (~₹0.40 per 1k).
*   **Modal.com (AI Face Detection & Resizing):** 
    *   **Per-second Compute Billing:** CPU at $0.0000131/vCPU/sec, Memory at $0.00000222/GB/sec.
    *   **Photo Processing Cost:** Processing 100,000 photos costs ~$8.20 (₹820 total, ~₹68/month amortized).
    *   **Free Tier:** Includes a $30/month (₹3,000/month) free tier covering ~360,000 photo executions per month (free up to ~100 active photographers).
*   **Upstash QStash (Serverless Queue):** ₹100 per 100,000 messages ($1.00 per 100k). (Essentially ~₹8 per month per photographer).
*   **Supabase (Database & Auth):** 
    *   **Free Tier:** 0.5 GB database storage, 50,000 MAUs, 2 GB egress.
    *   **Pro Plan:** Flat ₹2,500/month ($25.00/mo). Includes 100,000 Monthly Active Users (MAU), 8 GB database space (holds ~4 million photos' metadata), and 50 GB egress.
    *   **Overages:** Extra Database Storage at $0.125/GB/mo (~₹12.50/GB/mo); Extra MAUs at $0.00325/MAU (~₹0.325 per extra user/mo); Extra Egress at $0.09/GB (bypassed via Cloudflare).
*   **Railway (Next.js Web Server):** 
    *   **Per-second Serverless Billing:** CPU at $0.00000772/vCPU/sec, RAM at $0.00000386/GB/sec, Egress at $0.05/GB.
    *   Because Modal and B2 handle image processing and storage, web server compute remains minimal. Baseline server (0.5 GB RAM, 0.05 vCPU, 5 GB Egress) averages ~$11.00/mo (~₹1,100/mo or ₹13,200/yr). Estimated scale ranges between ₹500 to ₹1,500/month for normal traffic.
*   **Cloudflare (CDN & Edge Routing):** 
    *   **Routing & DNS:** ₹0 for basic routing.
    *   **Workers:** Free plan includes up to 100k requests/day (3M/mo). Paid plan base is $5.00/mo (includes 10M requests), plus $0.50 per additional 1M requests.
    *   **Zone Plans:** Pro plan at ₹2,500/month ($25.00/mo) or Business plan at ₹20,000/month ($200.00/mo) as scale requires advanced security/WAF.
*   **Razorpay (Payment Gateway & Collections):**
    *   **Platform Fee:** 2.00% per successful online transaction (Domestic cards, UPI, Netbanking).
    *   **GST on Gateway Fee:** 18% GST on the 2.0% fee (= 0.36% of transaction volume).
    *   **Effective Fee Rate:** **2.36%** total deduction on captured online payments.
    *   **Manual/Offline Collections:** **₹0** (Cash, direct RTGS/NEFT payments recorded manually incur 0% gateway fee).

---

## 2. WORST-CASE Yearly Scenario (1 Terabyte per Photog)

**Core Assumptions:** Every photographer uploads a massive 1 TB (100k photos) a year. Every photographer brings 500 unique guests logging in every single month. Photographers pay an annual ₹40,000 subscription collected 100% online via Razorpay (2.0% platform fee + 18% GST = 2.36% effective gateway fee).

| Component | 1 Photographer | 10 Photographers | 100 Photographers | 500 Photographers | 1,000 Photographers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backblaze B2** | ₹7,800 | ₹78,000 | ₹780,000 | ₹3,900,000 | ₹7,800,000 |
| **Cloudflare** | ₹0 | ₹0 | ₹30,000 | ₹240,000 | ₹240,000 |
| **Supabase** | ₹30,000 | ₹30,000 | ₹30,000 | ₹660,000 | ₹1,620,000 |
| **Modal.com** | ₹0 | ₹0 | ₹45,600 | ₹372,000 | ₹780,000 |
| **Railway** | ₹6,000 | ₹12,000 | ₹30,000 | ₹120,000 | ₹240,000 |
| **Upstash QStash**| ₹0 | ₹1,200 | ₹9,600 | ₹48,000 | ₹96,000 |
| **Razorpay (2.36%)**| ₹944 | ₹9,440 | ₹94,400 | ₹472,000 | ₹944,000 |
| | | | | | |
| **TOTAL YEARLY** | **~₹44,744** | **~₹1,30,640** | **~₹10,19,600** | **~₹58,12,000** | **~₹1,17,20,000** |
| **Cost per Photog**| **₹44,744 / yr** | **₹13,064 / yr** | **₹10,196 / yr** | **₹11,624 / yr** | **₹11,720 / yr** |

---

## 3. AVERAGE-CASE Realistic Scenario (400GB per Photog)

**Core Assumptions:** A realistic Indian wedding photographer uploads roughly 400GB (40,000 photos) a year. Guests taper off naturally after the wedding, resulting in roughly 150 active guests (MAU) per photographer per month. Average 60% of ₹40,000 subscription collections are processed online via Razorpay (40% direct bank transfer/offline).

| Component | 1 Photographer | 10 Photographers | 100 Photographers | 500 Photographers | 1,000 Photographers |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Storage** | 400 GB | 4 TB | 40 TB | 200 TB | **400 TB** |
| | | | | | |
| **Backblaze B2** | ₹2,880 | ₹28,800 | ₹288,000 | ₹14,40,000 | ₹28,80,000 |
| **Cloudflare** | ₹0 | ₹0 | ₹30,000 | ₹30,000 | ₹30,000 *(Pro)* |
| **Supabase** | ₹30,000 | ₹30,000 | ₹30,000 | ₹30,000 | ₹2,25,000 *(Overage)* |
| **Modal.com** | ₹0 | ₹0 | ₹0 *(Free!)* | ₹128,000 | ₹292,000 |
| **Railway** | ₹6,000 | ₹12,000 | ₹30,000 | ₹120,000 | ₹240,000 |
| **Upstash QStash**| ₹0 | ₹0 | ₹3,800 | ₹19,200 | ₹38,400 |
| **Razorpay (2.36%)**| ₹566 | ₹5,664 | ₹56,640 | ₹2,83,200 | ₹5,66,400 |
| | | | | | |
| **TOTAL YEARLY** | **~₹39,446** | **~₹76,464** | **~₹4,38,440** | **~₹20,50,400** | **~₹42,71,800** |
| *(In Lakhs)* | *(~39k INR)* | *(~76k INR)* | *(~4.38 Lakhs)* | *(~20.5 Lakhs)* | **(~42.7 Lakhs)** |
| **Cost per Photog**| **₹39,446 / yr** | **₹7,646 / yr** | **₹4,384 / yr** | **₹4,101 / yr** | **₹4,272 / yr** |

---

## 4. Key Takeaways & Profitability

1. **Massive Margins:** 
   In a realistic, average-case scenario for 1,000 Indian wedding photographers, your total infrastructure and payment gateway cost drops to just **₹4,272 per photographer, per year** (₹3,705 pure infra + ₹566 gateway fee). If you charge them a ₹40,000 annual subscription, your business operates at an exceptional **~89.3% profit margin**.
2. **Modal AI is Free up to 100 Photographers:**
   Because the average photographer uploads 40k photos instead of 100k, you can support roughly **100 full-time photographers** entirely on Modal.com's $30/mo free tier. You won't pay a single Rupee for AI compute until photographer #101 joins.
3. **Storage Dominates:**
   Even in the average-case, Backblaze B2 makes up the vast majority of your infra bill at enterprise scale. Fortunately, it is still the cheapest enterprise storage option on the planet ($0.006/GB/mo with 0 egress fees via Cloudflare), making your unit economics highly sustainable.
4. **Live Monitoring Sync:**
   The Analytics Dashboard features a live **Infrastructure Cost Hub** ([InfraCostGrid.tsx](file:///Users/sarthak/EveBash/apps/analytics-dashboard/src/components/InfraCostGrid.tsx)) tracking real-time usage metrics across all 7 operational providers: Supabase, Backblaze B2, Cloudflare, Modal.com, Railway, Upstash QStash, and Razorpay Gateway.

