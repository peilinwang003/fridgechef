"use client";
import React, { useState } from "react";

const QUICK = ["Eggs", "Scallions", "Rice", "Potato", "Tomato", "Tofu", "Bell pepper", "Garlic", "Carrot", "Chicken breast", "Noodles", "Cabbage"];
const CUISINES = ["Any", "Chinese", "Western", "Asian"];
const TIMES = ["No limit", "15-min quick", "Under 30 min"];
const DIETS = ["Vegetarian", "No spice"];
const VIBES = [
  { key: "speed", emoji: "⚡", label: "After-work sprint", desc: "done in 15 min", prompt: "The user is exhausted after work and just wants to eat within 15 minutes using the fewest steps and least cleanup. Prioritize speed and easy washing-up." },
  { key: "broke", emoji: "💪", label: "Broke & cutting", desc: "high-protein · cheap", prompt: "The user is cutting fat on a tight budget: generate high-protein, low-calorie meals from cheap ingredients, low oil and sugar. You may note rough calories in the tagline." },
  { key: "fancy", emoji: "✨", label: "Effortlessly fancy", desc: "looks great, dead easy", prompt: "The user wants something that looks high-end and photogenic with minimal effort: great presentation and a standout look, but the actual cooking must be very simple. Include a small plating/garnish tip in the steps." },
  { key: "dark", emoji: "🌚", label: "Cursed-kitchen rescue", desc: "make it make sense", prompt: "The user has a weird, mismatched set of ingredients. Get creative and force them into a dish that is at least edible, maybe even surprisingly good. You can be a bit humorous, but the steps must actually work." },
];

export default function FridgeChef() {
  const [ingredients, setIngredients] = useState(["Eggs", "Tomato", "Scallions"]);
  const [draft, setDraft] = useState("");
  const [cuisine, setCuisine] = useState("Any");
  const [timePref, setTimePref] = useState("No limit");
  const [diets, setDiets] = useState([]);
  const [strict, setStrict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [vibe, setVibe] = useState(null);
  const [openStep, setOpenStep] = useState(null);
  const [stepQ, setStepQ] = useState("");
  const [stepA, setStepA] = useState({});
  const [stepLoading, setStepLoading] = useState(null);
  const [openSub, setOpenSub] = useState(null);
  const [subQ, setSubQ] = useState("");
  const [subLoading, setSubLoading] = useState(null);

  const isFav = (r) => favorites.some((f) => f.name === r.name);
  const toggleFav = (r) =>
    setFavorites(isFav(r) ? favorites.filter((f) => f.name !== r.name) : [...favorites, r]);

  // ✅ Key change: hits /api/chat instead of Anthropic directly
  const callClaude = async (prompt, system) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  };

  const addTag = (val) => {
    const v = val.trim().replace(/[,，]$/, "").trim();
    if (v && !ingredients.includes(v)) setIngredients([...ingredients, v]);
    setDraft("");
  };
  const removeTag = (t) => setIngredients(ingredients.filter((i) => i !== t));
  const toggleDiet = (d) => setDiets(diets.includes(d) ? diets.filter((x) => x !== d) : [...diets, d]);

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "，") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && ingredients.length) {
      removeTag(ingredients[ingredients.length - 1]);
    }
  };

  const generate = async () => {
    if (!ingredients.length) {
      setError("Tell me what's in the fridge first ~");
      return;
    }
    setLoading(true);
    setError("");
    setRecipes([]);

    const v = VIBES.find((x) => x.key === vibe);
    const userPrompt = `I have these ingredients: ${ingredients.join(", ")}.
Preferences: cuisine=${cuisine}; time=${timePref}${diets.length ? "; " + diets.join(", ") : ""}.
${strict
      ? "Strict mode: use ONLY the ingredients I listed, plus basic seasonings (oil, salt, soy sauce, vinegar, sugar). Do not introduce other main ingredients."
      : "You may add a few common extra ingredients and seasonings."}
${v ? `Special request ("${v.label}" mode): ${v.prompt}` : ""}

Recommend 3 dishes I can make right now. Respond in English. Return ONLY JSON, no explanation, no markdown code fences. Format:
{"recipes":[{"name":"","tagline":"one-line hook","time":"~X min","difficulty":"Easy/Medium/Tricky","have":[],"missing":[],"steps":[]}]}
have = ingredients this dish uses that I already have; missing = ingredients I still need (keep near-empty in strict mode); steps = 3-6 concise steps.`;

    try {
      const text = await callClaude(userPrompt, "You are a home-cooking recipe assistant. Output strictly valid JSON only.");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed.recipes || !parsed.recipes.length) throw new Error("empty");
      setRecipes(parsed.recipes);
      setStepA({});
      setOpenStep(null);
      setOpenSub(null);
    } catch (e) {
      setError("Couldn't cook that up — try again, or swap a few ingredients ~");
    } finally {
      setLoading(false);
    }
  };

  const askStep = async (recipe, stepIdx, key, question) => {
    setStepLoading(key);
    const prompt = `Recipe "${recipe.name}", full steps: ${recipe.steps.map((s, n) => `${n + 1}.${s}`).join("  ")}
The user has a question about step ${stepIdx + 1} "${recipe.steps[stepIdx]}": ${question}
Answer in plain, beginner-friendly English, 2-4 sentences, with concrete checkable cues (how to judge temperature, roughly how much). Only answer this step; don't restate the whole recipe.`;
    try {
      const txt = await callClaude(prompt, "You are a patient kitchen teacher. Keep answers concise, specific, and practical.");
      setStepA((p) => ({ ...p, [key]: txt.trim() }));
    } catch {
      setStepA((p) => ({ ...p, [key]: "Couldn't answer that — try asking again ~" }));
    } finally {
      setStepLoading(null);
    }
  };

  const substitute = async (i, request) => {
    setSubLoading(i);
    const r = recipes[i];
    const prompt = `Here is a recipe as JSON: ${JSON.stringify(r)}
The user's tweak request: ${request}
Revise the dish accordingly (you may adjust have / missing / steps so it still works under the new conditions). Keep the name unchanged if possible.
Respond in English. Return ONLY JSON, same format: {"name":"","tagline":"","time":"","difficulty":"","have":[],"missing":[],"steps":[]}. No explanation, no markdown.`;
    try {
      const txt = await callClaude(prompt, "You are a recipe assistant. Output strictly valid JSON only.");
      const clean = txt.replace(/```json/g, "").replace(/```/g, "").trim();
      const updated = JSON.parse(clean);
      setRecipes((p) => p.map((x, idx) => (idx === i ? updated : x)));
      setOpenSub(null);
      setSubQ("");
    } catch {
      alert("Couldn't rewrite that — try rephrasing ~");
    } finally {
      setSubLoading(null);
    }
  };

  const renderCard = (r, i, saved) => (
    <article className="fc-card" key={(saved ? "f" : "r") + i} style={{ animationDelay: i * 0.08 + "s" }}>
      <button
        className={"fc-heart" + (isFav(r) ? " on" : "")}
        onClick={() => toggleFav(r)}
        aria-label="save"
        title={isFav(r) ? "Remove from saved" : "Save"}
      >
        {isFav(r) ? "♥" : "♡"}
      </button>
      <div className="fc-cname">{r.name}</div>
      {r.tagline && <div className="fc-tagline">{r.tagline}</div>}
      <div className="fc-meta">
        {r.time && <span className="fc-pill">⏱ {r.time}</span>}
        {r.difficulty && <span className="fc-pill">🔪 {r.difficulty}</span>}
      </div>
      {!!(r.have && r.have.length) && (
        <div className="fc-have">
          {r.have.map((h, j) => <span className="fc-ing h" key={j}>✓ {h}</span>)}
        </div>
      )}
      {!!(r.missing && r.missing.length) && (
        <>
          <div className="fc-mhead">Still need</div>
          <div className="fc-miss">
            {r.missing.map((m, j) => <span className="fc-ing m" key={j}>+ {m}</span>)}
          </div>
        </>
      )}
      {!!(r.steps && r.steps.length) && (
        <ol className="fc-steps">
          {r.steps.map((s, j) => {
            const key = `${saved ? "f" : "r"}-${i}-${j}`;
            return (
              <li key={j}>
                <div className="fc-steprow">
                  <span>{s}</span>
                  <button
                    className="fc-ask"
                    onClick={() => {
                      setOpenStep(openStep === key ? null : key);
                      setStepQ("");
                    }}
                  >
                    {openStep === key ? "Hide" : "How?"}
                  </button>
                </div>
                {openStep === key && (
                  <div className="fc-qa">
                    <input
                      className="fc-qinput"
                      value={stepQ}
                      onChange={(e) => setStepQ(e.target.value)}
                      placeholder="e.g. How do I tell when the oil is hot enough?"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && stepQ.trim()) askStep(r, j, key, stepQ.trim());
                      }}
                    />
                    <button
                      className="fc-qsend"
                      disabled={stepLoading === key || !stepQ.trim()}
                      onClick={() => stepQ.trim() && askStep(r, j, key, stepQ.trim())}
                    >
                      {stepLoading === key ? "…" : "Ask"}
                    </button>
                  </div>
                )}
                {stepA[key] && <div className="fc-answer">💡 {stepA[key]}</div>}
              </li>
            );
          })}
        </ol>
      )}
      {!saved && (
        <div className="fc-subwrap">
          <button
            className="fc-subbtn"
            onClick={() => {
              setOpenSub(openSub === i ? null : i);
              setSubQ("");
            }}
          >
            🔁 Swap an ingredient / tweak it
          </button>
          {openSub === i && (
            <div className="fc-qa">
              <input
                className="fc-qinput"
                value={subQ}
                onChange={(e) => setSubQ(e.target.value)}
                placeholder="e.g. No soy sauce — can I use dark soy? Make it in an air fryer?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subQ.trim()) substitute(i, subQ.trim());
                }}
              />
              <button
                className="fc-qsend"
                disabled={subLoading === i || !subQ.trim()}
                onClick={() => subQ.trim() && substitute(i, subQ.trim())}
              >
                {subLoading === i ? "…" : "Go"}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Bricolage+Grotesque:wght@400;500;700&display=swap');
    .fc-root{
      --paper:#F7EFDD; --ink:#2B2118; --tomato:#D7522E; --herb:#5C7A3A;
      --amber:#C98A2B; --line:#E2D5BA; --card:#FFFBF1;
      font-family:'Bricolage Grotesque',sans-serif; color:var(--ink);
      background:
        radial-gradient(120% 90% at 0% 0%, #FBF4E4 0%, transparent 55%),
        radial-gradient(120% 90% at 100% 100%, #F3E7C9 0%, transparent 55%),
        var(--paper);
      min-height:100vh; padding:34px 22px 60px;
    }
    .fc-kicker{font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:var(--tomato);font-weight:700;}
    .fc-title{font-family:'Fraunces',serif;font-weight:900;font-size:clamp(30px,5vw,52px);line-height:.98;margin:8px 0 6px;letter-spacing:-.01em;}
    .fc-sub{color:#6b5d49;max-width:50ch;font-size:15px;line-height:1.5;}
    .fc-panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:24px;box-shadow:0 1px 0 #fff inset, 0 14px 30px -22px rgba(80,55,20,.5);}
    .fc-label{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9a8a6f;font-weight:700;margin-bottom:10px;}
    .fc-tagbox{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:1px dashed var(--line);border-radius:12px;padding:10px;background:#FFFDF8;}
    .fc-tag{display:inline-flex;align-items:center;gap:6px;background:var(--ink);color:#F7EFDD;border-radius:999px;padding:5px 8px 5px 12px;font-size:14px;font-weight:500;}
    .fc-tag button{all:unset;cursor:pointer;width:16px;height:16px;display:grid;place-items:center;border-radius:50%;background:rgba(247,239,221,.18);font-size:11px;line-height:1;}
    .fc-input{flex:1;min-width:140px;border:none;outline:none;background:transparent;font:inherit;font-size:15px;color:var(--ink);padding:4px;}
    .fc-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
    .fc-chip{cursor:pointer;border:1px solid var(--line);background:#FFFDF8;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:500;color:#5a4d3a;transition:.15s;font-family:inherit;}
    .fc-chip:hover{border-color:var(--tomato);color:var(--tomato);transform:translateY(-1px);}
    .fc-chip.on{background:var(--tomato);border-color:var(--tomato);color:#fff;}
    .fc-prefs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px;margin-top:18px;}
    .fc-row{display:flex;flex-wrap:wrap;gap:8px;}
    .fc-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;}
    .fc-switch{width:42px;height:24px;border-radius:999px;background:var(--line);position:relative;transition:.2s;flex:none;}
    .fc-switch.on{background:var(--herb);}
    .fc-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.25);}
    .fc-switch.on .fc-knob{left:21px;}
    .fc-go{margin-top:22px;width:100%;cursor:pointer;border:none;border-radius:14px;background:var(--tomato);color:#fff;font-family:'Fraunces',serif;font-weight:600;font-size:19px;padding:15px;transition:.18s;box-shadow:0 10px 22px -10px rgba(215,82,46,.7);}
    .fc-go:hover{transform:translateY(-2px);box-shadow:0 14px 26px -10px rgba(215,82,46,.8);}
    .fc-go:disabled{opacity:.55;cursor:wait;transform:none;}
    .fc-err{margin-top:14px;color:var(--tomato);font-size:14px;font-weight:500;}
    .fc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:28px;}
    .fc-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 16px 34px -26px rgba(80,55,20,.6);animation:rise .5s both;position:relative;}
    .fc-heart{position:absolute;top:14px;right:14px;all:unset;cursor:pointer;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;font-size:19px;color:#c9b49a;background:#FFFDF8;border:1px solid var(--line);transition:.16s;}
    .fc-heart:hover{color:var(--tomato);border-color:var(--tomato);transform:scale(1.08);}
    .fc-heart.on{color:#fff;background:var(--tomato);border-color:var(--tomato);}
    .fc-favwrap{margin-top:30px;padding:20px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,#FFFBF1,#FBF3DF);box-shadow:0 14px 30px -24px rgba(80,55,20,.5);}
    .fc-favhead{display:flex;align-items:baseline;gap:12px;margin-bottom:6px;}
    .fc-favtitle{font-family:'Fraunces',serif;font-weight:900;font-size:22px;color:var(--tomato);}
    .fc-favcount{font-size:13px;font-weight:600;color:#9a8a6f;}
    @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .fc-tagline{color:#7a6a52;font-size:14px;font-style:italic;margin:6px 0 14px;}
    .fc-cname{font-family:'Fraunces',serif;font-weight:900;font-size:22px;line-height:1.1;padding-right:40px;}
    .fc-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
    .fc-pill{font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:#F1E7CE;color:#7a6038;}
    .fc-have,.fc-miss{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
    .fc-ing{font-size:12.5px;padding:3px 9px;border-radius:8px;font-weight:500;}
    .fc-ing.h{background:rgba(92,122,58,.14);color:var(--herb);}
    .fc-ing.m{background:rgba(201,138,43,.16);color:var(--amber);}
    .fc-mhead{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a7977c;font-weight:700;margin:10px 0 5px;}
    .fc-steps{list-style:none;padding:0;margin:12px 0 0;counter-reset:s;}
    .fc-steps li{counter-increment:s;position:relative;padding:7px 0 7px 30px;font-size:14px;line-height:1.5;border-top:1px solid var(--line);}
    .fc-steps li:first-child{border-top:none;}
    .fc-steps li::before{content:counter(s);position:absolute;left:0;top:9px;width:20px;height:20px;border-radius:50%;background:var(--ink);color:var(--paper);font-size:11px;font-weight:700;display:grid;place-items:center;font-family:'Fraunces',serif;}
    .fc-load{margin-top:28px;text-align:center;color:#8a7a60;font-family:'Fraunces',serif;font-size:18px;}
    .fc-dots span{display:inline-block;width:8px;height:8px;margin:0 3px;border-radius:50%;background:var(--tomato);animation:bnc 1s infinite;}
    .fc-dots span:nth-child(2){animation-delay:.15s}.fc-dots span:nth-child(3){animation-delay:.3s}
    @keyframes bnc{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}
    .fc-vibehead{margin:22px 0 12px;font-family:'Fraunces',serif;font-weight:900;font-size:18px;}
    .fc-vibehead span{font-family:'Bricolage Grotesque',sans-serif;font-weight:500;font-size:13px;color:#9a8a6f;margin-left:8px;}
    .fc-vibes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}
    .fc-vibe{cursor:pointer;text-align:left;border:1px solid var(--line);background:#FFFDF8;border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:2px;transition:.16s;font-family:inherit;}
    .fc-vibe:hover{border-color:var(--tomato);transform:translateY(-2px);box-shadow:0 10px 20px -14px rgba(215,82,46,.6);}
    .fc-vibe.on{background:var(--ink);border-color:var(--ink);}
    .fc-vemoji{font-size:20px;}
    .fc-vlabel{font-weight:700;font-size:15px;color:var(--ink);}
    .fc-vdesc{font-size:12px;color:#9a8a6f;}
    .fc-vibe.on .fc-vlabel{color:#F7EFDD;}
    .fc-vibe.on .fc-vdesc{color:#c7b89c;}
    .fc-steprow{display:flex;align-items:flex-start;gap:8px;justify-content:space-between;}
    .fc-ask{all:unset;cursor:pointer;flex:none;font-size:11px;font-weight:700;color:var(--tomato);border:1px solid rgba(215,82,46,.35);border-radius:999px;padding:2px 9px;white-space:nowrap;transition:.15s;}
    .fc-ask:hover{background:var(--tomato);color:#fff;}
    .fc-qa{display:flex;gap:7px;margin-top:9px;}
    .fc-qinput{flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;background:#FFFDF8;font:inherit;font-size:13px;padding:8px 10px;outline:none;color:var(--ink);}
    .fc-qinput:focus{border-color:var(--tomato);}
    .fc-qsend{all:unset;cursor:pointer;flex:none;background:var(--ink);color:var(--paper);font-weight:700;font-size:13px;padding:0 14px;border-radius:10px;display:grid;place-items:center;}
    .fc-qsend:hover{background:var(--tomato);}
    .fc-qsend:disabled{opacity:.4;cursor:not-allowed;}
    .fc-answer{margin-top:9px;background:rgba(92,122,58,.1);border-left:3px solid var(--herb);border-radius:0 8px 8px 0;padding:9px 11px;font-size:13.5px;line-height:1.55;color:#42532b;}
    .fc-subwrap{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);}
    .fc-subbtn{all:unset;cursor:pointer;font-size:13px;font-weight:600;color:#7a6a52;border:1px solid var(--line);border-radius:10px;padding:8px 12px;transition:.15s;display:inline-block;}
    .fc-subbtn:hover{border-color:var(--tomato);color:var(--tomato);}
  `;

  return (
    <div className="fc-root">
      <style>{css}</style>
      <div className="fc-kicker">What's in the fridge · I'll figure it out</div>
      <div className="fc-title">What can I cook tonight?</div>
      <p className="fc-sub">Toss in whatever you've got and tell me your mood — I'll give you three dishes you can start cooking right now.</p>

      <div className="fc-panel">
        <div className="fc-label">What I've got</div>
        <div className="fc-tagbox">
          {ingredients.map((t) => (
            <span className="fc-tag" key={t}>
              {t}
              <button onClick={() => removeTag(t)} aria-label="remove">✕</button>
            </span>
          ))}
          <input
            className="fc-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={ingredients.length ? "Add another, press Enter" : "Type an ingredient, press Enter"}
          />
        </div>
        <div className="fc-quick">
          {QUICK.filter((q) => !ingredients.includes(q)).map((q) => (
            <button className="fc-chip" key={q} onClick={() => addTag(q)}>+ {q}</button>
          ))}
        </div>

        <div className="fc-vibehead">What's the vibe today?<span>pick one — the whole menu adapts</span></div>
        <div className="fc-vibes">
          {VIBES.map((v) => (
            <button
              key={v.key}
              className={"fc-vibe" + (vibe === v.key ? " on" : "")}
              onClick={() => setVibe(vibe === v.key ? null : v.key)}
            >
              <span className="fc-vemoji">{v.emoji}</span>
              <span className="fc-vlabel">{v.label}</span>
              <span className="fc-vdesc">{v.desc}</span>
            </button>
          ))}
        </div>

        <div className="fc-prefs">
          <div>
            <div className="fc-label">Cuisine</div>
            <div className="fc-row">
              {CUISINES.map((c) => (
                <button key={c} className={"fc-chip" + (cuisine === c ? " on" : "")} onClick={() => setCuisine(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="fc-label">Time</div>
            <div className="fc-row">
              {TIMES.map((t) => (
                <button key={t} className={"fc-chip" + (timePref === t ? " on" : "")} onClick={() => setTimePref(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="fc-label">Avoid</div>
            <div className="fc-row">
              {DIETS.map((d) => (
                <button key={d} className={"fc-chip" + (diets.includes(d) ? " on" : "")} onClick={() => toggleDiet(d)}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        <label className="fc-toggle" style={{ marginTop: 18 }} onClick={() => setStrict(!strict)}>
          <span className={"fc-switch" + (strict ? " on" : "")}><span className="fc-knob" /></span>
          <span style={{ fontSize: 14 }}>
            <b>Strict mode</b> · {strict ? "only the ingredients I listed" : "allow common extras"}
          </span>
        </label>

        <button className="fc-go" onClick={generate} disabled={loading}>
          {loading ? "Flipping through recipes…" : "Show me what I can make →"}
        </button>
        {error && <div className="fc-err">{error}</div>}
      </div>

      {loading && (
        <div className="fc-load">
          <div className="fc-dots"><span /><span /><span /></div>
          Seeing what the fridge can pull together…
        </div>
      )}

      {!!favorites.length && (
        <section className="fc-favwrap">
          <div className="fc-favhead">
            <span className="fc-favtitle">★ My saved</span>
            <span className="fc-favcount">{favorites.length} saved</span>
          </div>
          <div className="fc-cards">
            {favorites.map((r, i) => renderCard(r, i, true))}
          </div>
        </section>
      )}

      {!!recipes.length && (
        <div className="fc-cards">
          {recipes.map((r, i) => renderCard(r, i, false))}
        </div>
      )}
    </div>
  );
}
