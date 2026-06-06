# FridgeChef 🍳

AI-powered recipe generator — tell it what's in your fridge, get 3 dishes you can cook right now.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init fridgechef"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/fridgechef.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Before clicking Deploy, go to **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
4. Click **Deploy** — done. Vercel gives you a shareable URL like `fridgechef.vercel.app`

### Local dev
```bash
cp .env.example .env.local
# Edit .env.local and add your real ANTHROPIC_API_KEY
npm install
npm run dev
# Open http://localhost:3000
```

## How it works

- **Frontend** (`app/page-components/FridgeChef.jsx`) — your React component, unchanged except `callClaude` now hits `/api/chat` instead of Anthropic directly
- **Backend** (`app/api/chat/route.js`) — Next.js serverless function; your API key lives here in an env variable, never exposed to the browser
- Every `git push` to main auto-deploys via Vercel
