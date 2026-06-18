import http.server
import json
import urllib.request
import os
import random
import re

PORT = 8080
DIRECTORY = "frontend"

FACTORS = {
    "transport": { "car": 0.21, "motorbike": 0.11, "bus": 0.04, "auto": 0.15, "cycle": 0 },
    "diet": { "vegan": 1.5, "vegetarian": 2.5, "mixed": 4.5, "meat-heavy": 7.5 },
    "energy": { "ac": 0.82, "device": 0.05 },
    "shopping": { "small": 3.5, "electronics": 15, "appliance": 40 },
    "waste": { "none": 0, "little": 0.3, "lot": 0.8 },
    "flight": 90
}

def get_standing_text_py(total):
    if total <= 5.2:
        return "That's below both the India average (5.2 kg) and the 1.5°C target (6.3 kg) — you're doing great today! 🌟"
    elif total <= 6.3:
        return "You're above the India average (5.2 kg) but still under the 1.5°C target (6.3 kg) — a solid day with room for a small win."
    elif total <= 10:
        return "That's above the 1.5°C target (6.3 kg) and the India average (5.2 kg), but let's see where we can trim a little."
    else:
        return "That's above both benchmarks, but no worries — big numbers often come from one-off things. Let's spot the easy fix."

def get_action_tip_py(category, b):
    tips = {
        'Transport': [
            "Try taking the bus or metro for one of your car trips tomorrow — swapping just 10 km from car to bus saves about <strong>1.7 kg CO₂e</strong>.",
            "If any trip is under 3 km, consider walking or cycling — it's zero-emission and saves <strong>0.6 kg</strong> per short ride.",
            f"Carpooling your commute tomorrow could halve your transport emissions, saving roughly <strong>{(b.get('transport', 0) * 0.5):.1f} kg</strong>."
        ],
        'Diet': [
            "Try swapping tomorrow's lunch to a vegetarian option — one plant-based meal can save about <strong>1.5 kg CO₂e</strong>.",
            "If you had a meat-heavy day, going mixed (with one dal/paneer meal) tomorrow saves <strong>3.0 kg</strong>.",
            "Trying a vegan dinner tomorrow (like chole or rajma) could save about <strong>1.0 kg CO₂e</strong> compared to a non-veg dinner."
        ],
        'Energy': [
            "Setting your AC to 26°C (instead of 24°C) and running it 1 hour less saves about <strong>0.8 kg CO₂e</strong>.",
            "Using a fan instead of AC for 2 hours tomorrow can save roughly <strong>1.6 kg CO₂e</strong>.",
            "Switching off devices when not in use and cutting 2 hours saves <strong>0.1 kg</strong> — small, but it adds up over weeks."
        ],
        'Shopping': [
            "No-buy days are a great reset — skipping one small purchase saves <strong>3.5 kg CO₂e</strong> instantly.",
            "If you can delay an electronics or appliance purchase, that's a significant footprint avoided for the day.",
            "Consider buying secondhand tomorrow if you need something — it can reduce the footprint by up to <strong>70%</strong>."
        ],
        'Food Waste': [
            "Plan your portions for tomorrow to reduce leftover waste — even going from 'a lot' to 'a little' saves <strong>0.5 kg CO₂e</strong>.",
            "Storing leftovers properly tonight and eating them tomorrow eliminates food waste emissions entirely."
        ],
        'Flights': [
            "Flying is the biggest per-hour emitter. If it was a short-haul flight, see if the train could work next time — a 2-hour train ride saves about <strong>170 kg CO₂e</strong> vs flying.",
            "Since you can't undo today's flight, balance it out this week by going car-free for a few days — each car-free day saves roughly <strong>4-5 kg</strong>."
        ]
    }
    options = tips.get(category, tips['Transport'])
    return random.choice(options)

def get_encouragement_py(total):
    lines = [
        "Every small choice adds up — you're already ahead by paying attention. 🌱",
        "Tracking is the first step to change — you're on the right path! 💚",
        "Small shifts, big impact over time. Keep going! 🌿",
        "You showed up today, and that matters. Tomorrow's another chance to win. ✨",
        "Awareness is your superpower — keep using it! 🌍",
        "One day at a time, one choice at a time. You've got this! 🍃"
    ]
    if total <= 5.2:
        return "Amazing day! If everyone lived like this, we'd be on track for our climate goals. Keep it up! 🎉"
    return random.choice(lines)

def get_rule_based_insights_py(b):
    categories = {
        "Transport": b.get("transport", 0),
        "Diet": b.get("diet", 0),
        "Energy": b.get("energy", 0),
        "Shopping": b.get("shopping", 0),
        "Food Waste": b.get("waste", 0),
        "Flights": b.get("flight", 0)
    }
    
    biggest = ""
    biggest_val = 0
    for cat, val in categories.items():
        if val > biggest_val:
            biggest_val = val
            biggest = cat
            
    total = sum(categories.values())
    standing = get_standing_text_py(total)
    tip = get_action_tip_py(biggest, b)
    encourage = get_encouragement_py(total)
    
    max_cat = max(categories.values()) if max(categories.values()) > 0 else 1
    
    breakdown_html = ""
    sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
    for cat, val in sorted_cats:
        if val > 0:
            cls = cat.lower().replace(" ", "")
            cat_cls = {
                "transport": "transport",
                "diet": "diet",
                "energy": "energy",
                "shopping": "shopping",
                "foodwaste": "waste",
                "flights": "flight"
            }.get(cls, "transport")
            pct = (val / max_cat) * 100
            breakdown_html += (
                f'<div class="breakdown-row">'
                f'  <span class="breakdown-label">{cat}</span>'
                f'  <div class="breakdown-track"><div class="breakdown-fill {cat_cls}" style="width:{pct:.0f}%"></div></div>'
                f'  <span class="breakdown-val">{val:.1f} kg</span>'
                f'</div>'
            )
            
    return (
        f'<p>Your daily total is <span class="insight-stat">{total:.1f} kg CO₂e</span>. {standing}</p>'
        f'<div class="breakdown-bars">{breakdown_html}</div>'
        f'<p>Your biggest contributor today is <strong>{biggest}</strong> at {biggest_val:.1f} kg.</p>'
        f'<div class="insight-tip">{tip}</div>'
        f'<p class="insight-encourage">{encourage}</p>'
    )

def parse_activities_py(text):
    transport = 0
    diet = 0
    energy = 0
    flight = 0
    diet_label = ''
    transport_label = ''
    has_data = False

    lower = text.lower()

    km_match = re.search(r'(\d+\.?\d*)\s*km', lower)
    km = float(km_match.group(1)) if km_match else 0

    if 'car' in lower or 'drove' in lower or 'drive' in lower:
        val_km = km if km > 0 else 15
        transport = val_km * FACTORS['transport']['car']
        transport_label = f"Car ({val_km} km)"
        has_data = True
    elif 'bike' in lower or 'motorbike' in lower or 'two wheeler' in lower or 'scooty' in lower or 'scooter' in lower:
        val_km = km if km > 0 else 10
        transport = val_km * FACTORS['transport']['motorbike']
        transport_label = f"Motorbike ({val_km} km)"
        has_data = True
    elif 'bus' in lower or 'metro' in lower or 'train' in lower or 'public' in lower:
        val_km = km if km > 0 else 15
        transport = val_km * FACTORS['transport']['bus']
        transport_label = f"Bus/Metro ({val_km} km)"
        has_data = True
    elif 'auto' in lower or 'rickshaw' in lower:
        val_km = km if km > 0 else 8
        transport = val_km * FACTORS['transport']['auto']
        transport_label = f"Auto ({val_km} km)"
        has_data = True
    elif 'walk' in lower or 'cycle' in lower or 'bicycle' in lower:
        transport = 0
        transport_label = 'Walked/Cycled'
        has_data = True

    if 'vegan' in lower:
        diet = FACTORS['diet']['vegan']
        diet_label = 'Vegan'
        has_data = True
    elif 'vegetarian' in lower or 'veg ' in lower or 'dal' in lower or 'paneer' in lower or 'sabzi' in lower:
        diet = FACTORS['diet']['vegetarian']
        diet_label = 'Vegetarian'
        has_data = True
    elif 'meat' in lower or 'chicken' in lower or 'mutton' in lower or 'beef' in lower or 'fish' in lower or 'non-veg' in lower or 'nonveg' in lower or 'biryani' in lower:
        if 'heavy' in lower or 'lot of meat' in lower or 'bbq' in lower or 'steak' in lower:
            diet = FACTORS['diet']['meat-heavy']
            diet_label = 'Meat-heavy'
        else:
            diet = FACTORS['diet']['mixed']
            diet_label = 'Mixed (with non-veg)'
        has_data = True
    elif 'mixed' in lower or 'normal' in lower or 'regular' in lower or 'egg' in lower:
        diet = FACTORS['diet']['mixed']
        diet_label = 'Mixed'
        has_data = True

    ac_match = re.search(r'ac.*?(\d+\.?\d*)\s*h|(\d+\.?\d*)\s*h.*?ac', lower)
    ac_hours = float(ac_match.group(1) or ac_match.group(2)) if ac_match else 0

    if 'ac' in lower or 'air condition' in lower or 'cooler' in lower or 'heater' in lower:
        hrs = ac_hours if ac_hours > 0 else 4
        energy = hrs * FACTORS['energy']['ac']
        has_data = True

    flight_match = re.search(r'(\d+\.?\d*)\s*h.*?fl|fl.*?(\d+\.?\d*)\s*h', lower)
    flight_hours = float(flight_match.group(1) or flight_match.group(2)) if flight_match else 0

    if 'flew' in lower or 'flight' in lower or 'plane' in lower:
        hrs = flight_hours if flight_hours > 0 else 2
        flight = hrs * FACTORS['flight']
        has_data = True

    return { 
        "transport": transport, 
        "diet": diet, 
        "energy": energy, 
        "flight": flight, 
        "dietLabel": diet_label, 
        "transportLabel": transport_label, 
        "hasData": has_data 
    }

def get_rule_based_chat_reply_py(message):
    lower = message.lower()
    parsed = parse_activities_py(lower)
    
    if parsed["hasData"]:
        total = parsed["transport"] + parsed["diet"] + parsed["energy"] + parsed["flight"]
        standing = get_standing_text_py(total)
        cats = {
            'Transport': parsed["transport"],
            'Diet': parsed["diet"],
            'Energy (AC/devices)': parsed["energy"],
            'Flights': parsed["flight"]
        }
        big_name = ''
        big_val = 0
        for k, v in cats.items():
            if v > big_val:
                big_val = v
                big_name = k
        
        tip = ''
        if big_name == 'Transport':
            tip = 'Try taking the bus or metro for one trip tomorrow — swapping 10 km from car to public transit saves about <strong>1.7 kg</strong>.'
        elif big_name == 'Diet':
            tip = 'Swap one meal tomorrow to a plant-based option (like rajma or chole) — that alone can save about <strong>1.5 kg</strong>.'
        elif 'Energy' in big_name:
            tip = 'Set your AC to 26°C and cut 1 hour — that saves about <strong>0.8 kg</strong> without sacrificing comfort.'
        elif big_name == 'Flights':
            tip = 'Can\'t undo today\'s flight, but going car-free tomorrow and the day after balances out about <strong>8 kg</strong>.'
        enc = get_encouragement_py(total)

        return (
            f"<p>Your estimated total is <strong>{total:.1f} kg CO₂e</strong>. {standing}</p>"
            f"<p>Your biggest source: <strong>{big_name}</strong> at {big_val:.1f} kg. {tip}</p>"
            f"<p><em>{enc}</em></p>"
        )

    if 'flight' in lower or 'flying' in lower or 'fly' in lower or 'plane' in lower:
        return (
            "<p>Flying emits about <strong>90 kg CO₂e per hour</strong> — a 2-hour flight equals roughly <strong>14 days</strong> of the average Indian's footprint. "
            "If you can, the train for short distances is a game-changer: a 4-hour train ride emits about <strong>3 kg</strong> vs a 1-hour flight's <strong>90 kg</strong>.</p>"
            "<p>Next time you're booking, check if a train or bus route works — even one skipped flight a year makes a real dent! 🚆</p>"
        )
    if 'meat' in lower or 'beef' in lower or 'chicken' in lower or 'non-veg' in lower or 'nonveg' in lower:
        return (
            "<p>A meat-heavy diet emits about <strong>7.5 kg CO₂e/day</strong>, while vegetarian is about <strong>2.5 kg</strong> — that's a 5 kg difference! "
            "In India, even one meat-free day a week saves roughly <strong>260 kg CO₂e per year</strong>.</p>"
            "<p>Try a \"dal Monday\" — swapping one non-veg meal for dal or paneer is an easy, delicious win. 🥗</p>"
        )
    if 'ac' in lower or 'air condition' in lower or 'cooling' in lower or 'heating' in lower:
        return (
            "<p>AC emits about <strong>0.82 kg CO₂e per hour</strong>. Running it 8 hours a day = <strong>6.6 kg</strong>, which alone exceeds the 1.5°C target. "
            "Setting it to <strong>26°C</strong> instead of 22°C can cut energy use by <strong>20-30%</strong>.</p>"
            "<p>Try the fan + AC combo — run AC for the first hour to cool the room, then switch to a ceiling fan. Saves about <strong>3-4 hours</strong> of AC time! ❄️</p>"
        )
    if 'car' in lower or 'drive' in lower or 'driving' in lower or 'commute' in lower:
        return (
            "<p>A car emits <strong>0.21 kg CO₂e per km</strong>. A typical 20 km daily commute = <strong>4.2 kg</strong>. "
            "The same distance by bus or metro? Just <strong>0.8 kg</strong>.</p>"
            "<p>If public transit isn't an option, try carpooling even 2 days a week — that alone saves about <strong>4 kg/week</strong>. 🚗➡️🚌</p>"
        )
    if 'shopping' in lower or 'buy' in lower or 'purchase' in lower or 'amazon' in lower or 'flipkart' in lower:
        return (
            "<p>Even a \"small\" purchase like clothing carries about <strong>3.5 kg CO₂e</strong> of embedded emissions from manufacturing and shipping. "
            "An electronics purchase? <strong>15 kg</strong>. A major appliance? <strong>40 kg</strong>.</p>"
            "<p>Before your next buy, try the 48-hour rule: wait 2 days. If you still need it, go for it — but you'll be surprised how often the urge passes! 🛍️</p>"
        )
    if 'food waste' in lower or 'leftover' in lower or 'throw' in lower or 'waste food' in lower:
        return (
            "<p>Food waste adds <strong>0.3 to 0.8 kg CO₂e/day</strong> depending on how much is thrown out. "
            "Over a year, that's up to <strong>290 kg</strong> — just from tossing food!</p>"
            "<p>A simple fix: cook slightly less than you think you need. Leftovers can be tomorrow's lunch. 🍱</p>"
        )

    return (
        "<p>I'd love to help you figure out your footprint! Could you tell me three things about today?</p>"
        "<p>1️⃣ <strong>How did you get around?</strong> (car, bus, metro, auto, bike, walk)<br>"
        "2️⃣ <strong>What did you eat?</strong> (vegan, vegetarian, mixed, or meat-heavy)<br>"
        "3️⃣ <strong>Did you run the AC</strong> or any heavy appliances today?</p>"
    )

def get_gemini_insights_py(breakdown, history, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    total = sum(breakdown.values())
    
    system_instruction = (
        "You are a personal carbon coach named Verde. Your job is to help users understand, track, and reduce their daily carbon footprint through simple, personalized, and actionable insights.\n"
        "Benchmarks Reference:\n"
        "- Global 1.5°C target: 6.3 kg CO2e/day per person\n"
        "- India national average: 5.2 kg CO2e/day per person\n\n"
        "Always structure your response exactly as follows:\n"
        "1. Give their total in kg CO2e and tell them where they stand vs the two benchmarks — in one warm, non-judgmental sentence.\n"
        "2. Identify their single biggest contributor and suggest one specific, actionable, and personalized reduction tip for tomorrow based on their history or current activities.\n"
        "3. Offer a brief word of encouragement.\n\n"
        "Formatting:\n"
        "- Output raw HTML snippet only (do not wrap in markdown ```html code blocks).\n"
        "- Use standard tag elements: <p>, <strong>, etc.\n"
        "- Wrap the reduction tip inside a <div class=\"insight-tip\">...</div>.\n"
        "- Wrap the encouragement in a <p class=\"insight-encourage\">...</p>."
    )
    
    prompt = f"Today's Carbon Footprint Breakdown (total: {total:.1f} kg CO2e):\n{json.dumps(breakdown, indent=2)}\n\nUser's History (last 14 days):\n{json.dumps(history, indent=2)}\n\nAnalyze today's emissions and their history logs. Provide a warm, personalized coaching response."
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]}
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        print("Error calling Gemini API in Python insights:", e)
        return None

def get_gemini_chat_reply_py(message, history, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    system_instruction = (
        "You are a personal carbon coach named Verde. Your job is to help users understand, track, and reduce their daily carbon footprint through simple, personalized, and actionable insights.\n\n"
        "Benchmarks Reference:\n"
        "- Global 1.5°C target: 6.3 kg CO2e/day per person\n"
        "- India national average: 5.2 kg CO2e/day per person\n\n"
        "When a user shares activities, estimate emissions using:\n"
        "- Car: 0.21 kg CO2e/km | Motorbike: 0.11 | Bus/Metro: 0.04 | Flight: 90 kg/hr\n"
        "- Diet — Vegan: 1.5 kg/day | Vegetarian: 2.5 | Mixed: 4.5 | Meat-heavy: 7.5\n"
        "- AC/Heating: 0.82 kg/hr | Devices: 0.05 kg/hr\n"
        "- Shopping — Small item: 3.5 kg | Electronics: 15 kg | Appliance: 40 kg\n"
        "- Food waste: none = +0 | a little = +0.3 | a lot = +0.8 kg\n\n"
        "Response Structure for logs:\n"
        "- Give their total in kg CO2e and tell them where they stand vs the benchmarks in one warm, non-judgmental sentence.\n"
        "- Identify their single biggest contributor and suggest one specific reduction tip for tomorrow.\n"
        "- Offer a brief word of encouragement.\n\n"
        "Formatting:\n"
        "- Output raw HTML snippet (do not wrap in markdown ```html blocks).\n"
        "- Use standard tag elements: <p>, <strong>, etc."
    )
    
    prompt = f"User history context: {json.dumps(history)}\nUser message: \"{message}\"\n\nRespond as Verde. If they shared activities, estimate footprint and follow structure. Otherwise, answer their climate question."
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "systemInstruction": {"parts": [{"text": system_instruction}]}
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        print("Error calling Gemini API in Python chat:", e)
        return None


class VerdeRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/insights':
            self.handle_insights()
        elif self.path == '/api/chat':
            self.handle_chat()
        else:
            self.send_error(404, "Not Found")
            
    def handle_insights(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        req_body = json.loads(post_data.decode('utf-8'))
        
        breakdown = req_body.get('breakdown', {})
        history = req_body.get('history', [])
        
        keys = ['transport', 'diet', 'energy', 'shopping', 'waste', 'flight']
        clean_breakdown = {}
        for k in keys:
            val = float(breakdown.get(k, 0))
            if val < 0 or val != val:  # check for negative or NaN
                val = 0
            if val > 100000:
                val = 100000
            clean_breakdown[k] = val
            
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            insights = get_gemini_insights_py(clean_breakdown, history, api_key)
            if insights:
                self.send_json_response({"source": "gemini", "insights": insights})
                return
                
        insights = get_rule_based_insights_py(clean_breakdown)
        self.send_json_response({"source": "rule-based", "insights": insights})

    def handle_chat(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        req_body = json.loads(post_data.decode('utf-8'))
        
        message = req_body.get('message', '')[:1000]
        history = req_body.get('history', [])
        
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            reply = get_gemini_chat_reply_py(message, history, api_key)
            if reply:
                self.send_json_response({"source": "gemini", "reply": reply})
                return
                
        reply = get_rule_based_chat_reply_py(message)
        self.send_json_response({"source": "rule-based", "reply": reply})

    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == "__main__":
    import socketserver
    # Enable address reuse to avoid port already in use errors on rapid restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), VerdeRequestHandler) as httpd:
        print(f"Verde Carbon Coach Python Server running at http://localhost:{PORT}")
        httpd.serve_forever()
