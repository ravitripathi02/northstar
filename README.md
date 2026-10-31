# Northstar Ops

Northstar Ops is a small web app for taking a first look at application logs during incident triage. Paste logs into the dashboard or upload a `.log` or `.txt` file. The app highlights repeated errors, possible causes, potential impact, and suggested next steps. A few sample logs are included so you can try it without preparing your own.

## Run it locally

You’ll need Node.js and npm. From this folder, install the dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

AI providers are optional. To use one, copy `.env.example` to `.env.local` and add the key for your provider. For example, in PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set `GEMINI_API_KEY` for Google Gemini, or `OPENROUTER_API_KEY` for OpenRouter. Keep `.env.local` private and don’t commit API keys. Without a working provider key, the dashboard still runs and uses its built-in review.

## How the analysis works

When you submit logs, the browser sends them to the server’s `/api/analyze` route. The server looks for common log levels, timestamps, services, status codes, and recurring error messages. It then tries an AI provider if one is configured. The AI receives summary statistics and a shortened selection of relevant log lines, and returns an incident summary in a fixed format.

Gemini is the default provider. The app tries `gemini-2.0-flash`, followed by `gemini-1.5-flash` and `gemini-1.5-flash-latest` if needed. OpenRouter uses `openai/gpt-oss-20b` by default and can also try `openai/gpt-oss-120b`. Set `OPENROUTER_MODEL` to choose a different OpenRouter model, or set `AI_PROVIDER=openrouter` to try OpenRouter first. If live analysis cannot be used, the app falls back to local rules for severity, patterns, and recommendations.

## Tools and models

The project is built with Next.js, React, and TypeScript. Its icons use Lucide. AI analysis can use Google Gemini or models served through OpenRouter, as described above. The local fallback is regular application code; it does not call an AI model.

## Project map

- `app/` contains the dashboard, shared page layout, and analysis API route.
- `components/` contains the log input and incident result panels.
- `lib/` contains the parser, pattern and severity rules, AI integrations, and fallback analysis.
- `types/` contains shared TypeScript types.
- `public/samples/` contains the sample logs shown in the dashboard.

## Checks

There isn’t an automated test suite configured yet. The project does include lint and production build checks:

```bash
npm run lint
npm run build
```

## Assumptions and limitations

- Log formats vary. The parser recognizes common text patterns and simple JSON wrappers, but it won’t understand every logging format, so some entries may be missed or misclassified.
- For AI analysis, the app selects up to 80 relevant lines and limits the excerpt to 4,000 characters. Context outside that excerpt may matter.
- Gemini and OpenRouter receive the selected log content when used. Remove credentials, personal details, and other sensitive data before submitting logs.
- Suggested causes, severity, impact, and actions are only a starting point. Check the original logs and system metrics before making operational decisions.
- The fallback is based on fixed rules and cannot reason about context like an AI model can.
- This is a development-focused tool. It does not include accounts, saved incident history, or production access controls.
