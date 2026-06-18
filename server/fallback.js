/**
 * @fileoverview Replicates the original rule-based fallback logic on the server side.
 * Used when GEMINI_API_KEY is not configured or the API request fails.
 */

const BENCHMARKS = {
  global: 6.3,
  india: 5.2
};

const FACTORS = {
  transport: { car: 0.21, motorbike: 0.11, bus: 0.04, auto: 0.15, cycle: 0 },
  diet: { vegan: 1.5, vegetarian: 2.5, mixed: 4.5, 'meat-heavy': 7.5 },
  energy: { ac: 0.82, device: 0.05 },
  shopping: { small: 3.5, electronics: 15, appliance: 40 },
  waste: { none: 0, little: 0.3, lot: 0.8 },
  flight: 90
};

function getStandingText(total) {
  if (total <= BENCHMARKS.india) {
    return `That's below both the India average (${BENCHMARKS.india} kg) and the 1.5°C target (${BENCHMARKS.global} kg) — you're doing great today! 🌟`;
  } else if (total <= BENCHMARKS.global) {
    return `You're above the India average (${BENCHMARKS.india} kg) but still under the 1.5°C target (${BENCHMARKS.global} kg) — a solid day with room for a small win.`;
  } else if (total <= 10) {
    return `That's above the 1.5°C target (${BENCHMARKS.global} kg) and the India average (${BENCHMARKS.india} kg), but let's see where we can trim a little.`;
  } else {
    return `That's above both benchmarks, but no worries — big numbers often come from one-off things. Let's spot the easy fix.`;
  }
}

function getActionTip(category, b) {
  const tips = {
    'Transport': [
      `Try taking the bus or metro for one of your car trips tomorrow — swapping just 10 km from car to bus saves about <strong>1.7 kg CO₂e</strong>.`,
      `If any trip is under 3 km, consider walking or cycling — it's zero-emission and saves <strong>0.6 kg</strong> per short ride.`,
      `Carpooling your commute tomorrow could halve your transport emissions, saving roughly <strong>${(b.transport * 0.5).toFixed(1)} kg</strong>.`
    ],
    'Diet': [
      `Try swapping tomorrow's lunch to a vegetarian option — one plant-based meal can save about <strong>1.5 kg CO₂e</strong>.`,
      `If you had a meat-heavy day, going mixed (with one dal/paneer meal) tomorrow saves <strong>3.0 kg</strong>.`,
      `Trying a vegan dinner tomorrow (like chole or rajma) could save about <strong>1.0 kg CO₂e</strong> compared to a non-veg dinner.`
    ],
    'Energy': [
      `Setting your AC to 26°C (instead of 24°C) and running it 1 hour less saves about <strong>0.8 kg CO₂e</strong>.`,
      `Using a fan instead of AC for 2 hours tomorrow can save roughly <strong>1.6 kg CO₂e</strong>.`,
      `Switching off devices when not in use and cutting 2 hours saves <strong>0.1 kg</strong> — small, but it adds up over weeks.`
    ],
    'Shopping': [
      `No-buy days are a great reset — skipping one small purchase saves <strong>3.5 kg CO₂e</strong> instantly.`,
      `If you can delay an electronics or appliance purchase, that's a significant footprint avoided for the day.`,
      `Consider buying secondhand tomorrow if you need something — it can reduce the footprint by up to <strong>70%</strong>.`
    ],
    'Food Waste': [
      `Plan your portions for tomorrow to reduce leftover waste — even going from "a lot" to "a little" saves <strong>0.5 kg CO₂e</strong>.`,
      `Storing leftovers properly tonight and eating them tomorrow eliminates food waste emissions entirely.`
    ],
    'Flights': [
      `Flying is the biggest per-hour emitter. If it was a short-haul flight, see if the train could work next time — a 2-hour train ride saves about <strong>170 kg CO₂e</strong> vs flying.`,
      `Since you can't undo today's flight, balance it out this week by going car-free for a few days — each car-free day saves roughly <strong>4-5 kg</strong>.`
    ]
  };

  const options = tips[category] || tips['Transport'];
  return options[Math.floor(Math.random() * options.length)];
}

function getEncouragement(total) {
  const lines = [
    "Every small choice adds up — you're already ahead by paying attention. 🌱",
    "Tracking is the first step to change — you're on the right path! 💚",
    "Small shifts, big impact over time. Keep going! 🌿",
    "You showed up today, and that matters. Tomorrow's another chance to win. ✨",
    "Awareness is your superpower — keep using it! 🌍",
    "One day at a time, one choice at a time. You've got this! 🍃"
  ];
  if (total <= BENCHMARKS.india) {
    return "Amazing day! If everyone lived like this, we'd be on track for our climate goals. Keep it up! 🎉";
  }
  return lines[Math.floor(Math.random() * lines.length)];
}

export function getRuleBasedInsights(breakdown) {
  const categories = {
    Transport: breakdown.transport,
    Diet: breakdown.diet,
    Energy: breakdown.energy,
    Shopping: breakdown.shopping,
    'Food Waste': breakdown.waste,
    Flights: breakdown.flight
  };

  let biggest = '';
  let biggestVal = 0;
  for (const [cat, val] of Object.entries(categories)) {
    if (val > biggestVal) {
      biggestVal = val;
      biggest = cat;
    }
  }

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const standingText = getStandingText(total);
  const tip = getActionTip(biggest, breakdown);
  const encouragement = getEncouragement(total);
  
  const maxCat = Math.max(...Object.values(categories), 1);
  const breakdownHTML = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, val]) => {
      const cls = cat.toLowerCase().replace(' ', '');
      const catCls = {
        transport: 'transport',
        diet: 'diet',
        energy: 'energy',
        shopping: 'shopping',
        foodwaste: 'waste',
        flights: 'flight'
      }[cls] || 'transport';
      const pct = (val / maxCat) * 100;
      return `<div class="breakdown-row">
        <span class="breakdown-label">${cat}</span>
        <div class="breakdown-track"><div class="breakdown-fill ${catCls}" style="width:${pct}%"></div></div>
        <span class="breakdown-val">${val.toFixed(1)} kg</span>
      </div>`;
    }).join('');

  return `
    <p>Your daily total is <span class="insight-stat">${total.toFixed(1)} kg CO₂e</span>. ${standingText}</p>
    <div class="breakdown-bars">${breakdownHTML}</div>
    <p>Your biggest contributor today is <strong>${biggest}</strong> at ${biggestVal.toFixed(1)} kg.</p>
    <div class="insight-tip">${tip}</div>
    <p class="insight-encourage">${encouragement}</p>
  `;
}

export function parseActivities(text) {
  let transport = 0;
  let diet = 0;
  let energy = 0;
  let flight = 0;
  let dietLabel = '';
  let transportLabel = '';
  let hasData = false;

  const lower = text.toLowerCase();

  const kmMatch = lower.match(/(\d+\.?\d*)\s*km/);
  const km = kmMatch ? parseFloat(kmMatch[1]) : 0;

  if (lower.includes('car') || lower.includes('drove') || lower.includes('drive')) {
    const valKm = km || 15;
    transport = valKm * FACTORS.transport.car;
    transportLabel = `Car (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('bike') || lower.includes('motorbike') || lower.includes('two wheeler') || lower.includes('scooty') || lower.includes('scooter')) {
    const valKm = km || 10;
    transport = valKm * FACTORS.transport.motorbike;
    transportLabel = `Motorbike (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('bus') || lower.includes('metro') || lower.includes('train') || lower.includes('public')) {
    const valKm = km || 15;
    transport = valKm * FACTORS.transport.bus;
    transportLabel = `Bus/Metro (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('auto') || lower.includes('rickshaw')) {
    const valKm = km || 8;
    transport = valKm * FACTORS.transport.auto;
    transportLabel = `Auto (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('walk') || lower.includes('cycle') || lower.includes('bicycle')) {
    transport = 0;
    transportLabel = 'Walked/Cycled';
    hasData = true;
  }

  if (lower.includes('vegan')) {
    diet = FACTORS.diet.vegan;
    dietLabel = 'Vegan';
    hasData = true;
  } else if (lower.includes('vegetarian') || lower.includes('veg ') || lower.includes('dal') || lower.includes('paneer') || lower.includes('sabzi')) {
    diet = FACTORS.diet.vegetarian;
    dietLabel = 'Vegetarian';
    hasData = true;
  } else if (lower.includes('meat') || lower.includes('chicken') || lower.includes('mutton') || lower.includes('beef') || lower.includes('fish') || lower.includes('non-veg') || lower.includes('nonveg') || lower.includes('biryani')) {
    if (lower.includes('heavy') || lower.includes('lot of meat') || lower.includes('bbq') || lower.includes('steak')) {
      diet = FACTORS.diet['meat-heavy'];
      dietLabel = 'Meat-heavy';
    } else {
      diet = FACTORS.diet.mixed;
      dietLabel = 'Mixed (with non-veg)';
    }
    hasData = true;
  } else if (lower.includes('mixed') || lower.includes('normal') || lower.includes('regular') || lower.includes('egg')) {
    diet = FACTORS.diet.mixed;
    dietLabel = 'Mixed';
    hasData = true;
  }

  const acMatch = lower.match(/ac.*?(\d+\.?\d*)\s*h|(\d+\.?\d*)\s*h.*?ac/i);
  const acHours = acMatch ? parseFloat(acMatch[1] || acMatch[2]) : 0;

  if (lower.includes('ac') || lower.includes('air condition') || lower.includes('cooler') || lower.includes('heater')) {
    const hrs = acHours || 4;
    energy = hrs * FACTORS.energy.ac;
    hasData = true;
  }

  const flightMatch = lower.match(/(\d+\.?\d*)\s*h.*?fl|fl.*?(\d+\.?\d*)\s*h/i);
  if (lower.includes('flew') || lower.includes('flight') || lower.includes('plane')) {
    const hrs = flightMatch ? parseFloat(flightMatch[1] || flightMatch[2]) : 2;
    flight = hrs * FACTORS.flight;
    hasData = true;
  }

  return { transport, diet, energy, flight, dietLabel, transportLabel, hasData };
}

export function getRuleBasedChatReply(message) {
  const lower = message.toLowerCase();

  // 1. Check if activities can be parsed
  const parsed = parseActivities(lower);
  if (parsed.hasData) {
    const total = parsed.transport + parsed.diet + parsed.energy + parsed.flight;
    const standing = getStandingText(total);
    const cats = {
      'Transport': parsed.transport,
      'Diet': parsed.diet,
      'Energy (AC/devices)': parsed.energy,
      'Flights': parsed.flight
    };
    let bigName = '';
    let bigVal = 0;
    for (const [k, v] of Object.entries(cats)) {
      if (v > bigVal) {
        bigVal = v;
        bigName = k;
      }
    }
    
    let tip = '';
    if (bigName === 'Transport') {
      tip = 'Try taking the bus or metro for one trip tomorrow — swapping 10 km from car to public transit saves about <strong>1.7 kg</strong>.';
    } else if (bigName === 'Diet') {
      tip = 'Swap one meal tomorrow to a plant-based option (like rajma or chole) — that alone can save about <strong>1.5 kg</strong>.';
    } else if (bigName.includes('Energy')) {
      tip = 'Set your AC to 26°C and cut 1 hour — that saves about <strong>0.8 kg</strong> without sacrificing comfort.';
    } else if (bigName === 'Flights') {
      tip = 'Can\'t undo today\'s flight, but going car-free tomorrow and the day after balances out about <strong>8 kg</strong>.';
    }
    const enc = getEncouragement(total);

    return `<p>Your estimated total is <strong>${total.toFixed(1)} kg CO₂e</strong>. ${standing}</p>
    <p>Your biggest source: <strong>${bigName}</strong> at ${bigVal.toFixed(1)} kg. ${tip}</p>
    <p><em>${enc}</em></p>`;
  }

  // 2. Keyword matching responses
  if (lower.includes('flight') || lower.includes('flying') || lower.includes('fly') || lower.includes('plane')) {
    return `<p>Flying emits about <strong>90 kg CO₂e per hour</strong> — a 2-hour flight equals roughly <strong>14 days</strong> of the average Indian's footprint. If you can, the train for short distances is a game-changer: a 4-hour train ride emits about <strong>3 kg</strong> vs a 1-hour flight's <strong>90 kg</strong>.</p>
    <p>Next time you're booking, check if a train or bus route works — even one skipped flight a year makes a real dent! 🚆</p>`;
  }

  if (lower.includes('meat') || lower.includes('beef') || lower.includes('chicken') || lower.includes('non-veg') || lower.includes('nonveg')) {
    return `<p>A meat-heavy diet emits about <strong>7.5 kg CO₂e/day</strong>, while vegetarian is about <strong>2.5 kg</strong> — that's a 5 kg difference! In India, even one meat-free day a week saves roughly <strong>260 kg CO₂e per year</strong>.</p>
    <p>Try a "dal Monday" — swapping one non-veg meal for dal or paneer is an easy, delicious win. 🥗</p>`;
  }

  if (lower.includes('ac') || lower.includes('air condition') || lower.includes('cooling') || lower.includes('heating')) {
    return `<p>AC emits about <strong>0.82 kg CO₂e per hour</strong>. Running it 8 hours a day = <strong>6.6 kg</strong>, which alone exceeds the 1.5°C target. Setting it to <strong>26°C</strong> instead of 22°C can cut energy use by <strong>20-30%</strong>.</p>
    <p>Try the fan + AC combo — run AC for the first hour to cool the room, then switch to a ceiling fan. Saves about <strong>3-4 hours</strong> of AC time! ❄️</p>`;
  }

  if (lower.includes('car') || lower.includes('drive') || lower.includes('driving') || lower.includes('commute')) {
    return `<p>A car emits <strong>0.21 kg CO₂e per km</strong>. A typical 20 km daily commute = <strong>4.2 kg</strong>. The same distance by bus or metro? Just <strong>0.8 kg</strong>.</p>
    <p>If public transit isn't an option, try carpooling even 2 days a week — that alone saves about <strong>4 kg/week</strong>. 🚗➡️🚌</p>`;
  }

  if (lower.includes('shopping') || lower.includes('buy') || lower.includes('purchase') || lower.includes('amazon') || lower.includes('flipkart')) {
    return `<p>Even a "small" purchase like clothing carries about <strong>3.5 kg CO₂e</strong> of embedded emissions from manufacturing and shipping. An electronics purchase? <strong>15 kg</strong>. A major appliance? <strong>40 kg</strong>.</p>
    <p>Before your next buy, try the 48-hour rule: wait 2 days. If you still need it, go for it — but you'll be surprised how often the urge passes! 🛍️</p>`;
  }

  if (lower.includes('food waste') || lower.includes('leftover') || lower.includes('throw') || lower.includes('waste food')) {
    return `<p>Food waste adds <strong>0.3 to 0.8 kg CO₂e/day</strong> depending on how much is thrown out. Over a year, that's up to <strong>290 kg</strong> — just from tossing food!</p>
    <p>A simple fix: cook slightly less than you think you need. Leftovers can be tomorrow's lunch. 🍱</p>`;
  }

  // 3. Fallback generic reply
  return `<p>I'd love to help you figure out your footprint! Could you tell me three things about today?</p>
  <p>1️⃣ <strong>How did you get around?</strong> (car, bus, metro, auto, bike, walk)<br>
  2️⃣ <strong>What did you eat?</strong> (vegan, vegetarian, mixed, or meat-heavy)<br>
  3️⃣ <strong>Did you run the AC</strong> or any heavy appliances today?</p>`;
}
