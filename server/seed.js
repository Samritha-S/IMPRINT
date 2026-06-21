const db = require('./db');
const emissionsEngine = require('./emissionsEngine');
const agentService = require('./agentService');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const LOCATIONS = {
  "Maharashtra": {
    "Mumbai": ["Colaba", "Bandra", "Andheri", "Juhu", "Borivali"],
    "Pune": ["Kothrud", "Koregaon Park", "Aundh", "Baner", "Hinjewadi"],
    "Nagpur": ["Sitabuldi", "Dharampeth", "Sadar"]
  },
  "Karnataka": {
    "Bengaluru": ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "Malleshwaram"],
    "Mysore": ["Gokulam", "Vidyaranyapuram", "Kuvempunagar"],
    "Hubli": ["Vidyanagar", "Keshwapur"]
  },
  "Delhi": {
    "New Delhi": ["Connaught Place", "Chanakyapuri", "Vasant Kunj", "Saket", "Dwarka"]
  },
  "Tamil Nadu": {
    "Chennai": ["Adyar", "Mylapore", "T. Nagar", "Velachery", "Nungambakkam"],
    "Coimbatore": ["Gandhipuram", "RS Puram", "Peelamedu"]
  },
  "Telangana": {
    "Hyderabad": ["Gachibowli", "Jubilee Hills", "Banjara Hills", "Madhapur", "Begumpet"]
  },
  "West Bengal": {
    "Kolkata": ["Salt Lake", "Ballygunge", "Park Street", "New Town", "Behala"]
  },
  "Gujarat": {
    "Ahmedabad": ["Satellite", "Navrangpura", "Vastrapur", "Bodakdev"],
    "Surat": ["Adajan", "Vesu", "Piplod"]
  },
  "Uttar Pradesh": {
    "Noida": ["Sector 62", "Sector 15", "Sector 50"],
    "Lucknow": ["Hazratganj", "Gomti Nagar", "Aliganj"]
  },
  "Kerala": {
    "Kochi": ["Edappally", "Kakkanad", "Fort Kochi"],
    "Trivandrum": ["Kowdiar", "Pattom", "Kazhakkoottam"]
  },
  "Rajasthan": {
    "Jaipur": ["Malviya Nagar", "Vaishali Nagar", "C-Scheme"],
    "Jodhpur": ["Sardarpura", "Shastri Nagar"]
  },
  "Punjab": {
    "Ludhiana": ["Sarabha Nagar", "Model Town"],
    "Amritsar": ["Ranjit Avenue", "Lawrence Road"]
  },
  "Haryana": {
    "Gurgaon": ["DLF Phase 3", "Sector 56", "Sector 45"]
  },
  "Madhya Pradesh": {
    "Indore": ["Vijay Nagar", "Palasia", "Saket"],
    "Bhopal": ["Arera Colony", "MP Nagar"]
  },
  "Bihar": {
    "Patna": ["Boring Road", "Kankarbagh", "Bailey Road"]
  },
  "Andhra Pradesh": {
    "Visakhapatnam": ["Dwaraka Nagar", "MVP Colony", "Gajuwaka"],
    "Vijayawada": ["Benz Circle", "Labbipet"]
  },
  "Odisha": {
    "Bhubaneswar": ["Nayapalli", "Patia", "Saheed Nagar"]
  },
  "Assam": {
    "Guwahati": ["Dispur", "Paltan Bazaar", "Ganeshguri"]
  },
  "Goa": {
    "Panaji": ["Miramar", "Altinho", "Campal"]
  },
  "Uttarakhand": {
    "Dehradun": ["Rajpur Road", "Jakhan", "Clement Town"]
  },
  "Himachal Pradesh": {
    "Shimla": ["Mall Road", "Chotta Shimla", "Kasumpti"]
  },
  "Sikkim": {
    "Gangtok": ["MG Marg", "Deorali", "Development Area"]
  },
  "Puducherry": {
    "Puducherry Town": ["Heritage Town", "White Town", "Boulevard"]
  }
};

const DIETS = ["vegan", "vegetarian", "omnivore", "carnivore"];
const COMMUTES = ["walk_bicycle", "ev", "public_transport", "two_wheeler", "car"];
const NAMES = [
  "Aarav", "Aditya", "Amit", "Ananya", "Arjun", "Bhavana", "Deepak", "Divya", "Ganesh", "Hari",
  "Isha", "Karan", "Kavya", "Madhav", "Meera", "Neha", "Nikhil", "Pooja", "Rahul", "Rhea",
  "Rohan", "Sanjay", "Shreya", "Siddharth", "Sneha", "Tanvi", "Varun", "Vikram", "Yash", "Zara"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Mehta", "Iyer", "Nair", "Rao", "Joshi", "Gupta", "Singh",
  "Reddy", "Kumar", "Das", "Chatterjee", "Banerjee", "Sen", "Choudhury", "Mishra", "Shah", "Pillai"
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function runSeed() {
  console.log("Cleaning database tables...");
  
  // Wrap all insertions in a transaction
  const performSeeding = db.transaction(() => {
    db.prepare("DELETE FROM agent_feedback").run();
    db.prepare("DELETE FROM agent_memory").run();
    db.prepare("DELETE FROM agent_runs").run();
    db.prepare("DELETE FROM bill_scans").run();
    db.prepare("DELETE FROM receipt_scans").run();
    db.prepare("DELETE FROM daily_logs").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM ward_aggregates").run();

    const states = Object.keys(LOCATIONS);
    
    // Seed demo user first
    console.log("Seeding main demo user...");
    const demoUserId = db.prepare(`
      INSERT INTO users (username, password, name, state, city, ward, diet, commute)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'pip',
      hashPassword('password123'),
      'Pip Explorer',
      'Karnataka',
      'Bengaluru',
      'Indiranagar',
      'vegetarian',
      'ev'
    ).lastInsertRowid;

    console.log("Seeding 200 mock users...");
    const userIds = [demoUserId];
    for (let i = 0; i < 200; i++) {
      // Weight popular states higher
      let state = 'Karnataka';
      const rand = Math.random();
      if (rand < 0.20) state = 'Karnataka';
      else if (rand < 0.40) state = 'Maharashtra';
      else if (rand < 0.55) state = 'Delhi';
      else if (rand < 0.70) state = 'Tamil Nadu';
      else state = getRandomItem(states);

      const cities = Object.keys(LOCATIONS[state]);
      const city = getRandomItem(cities);
      const wards = LOCATIONS[state][city];
      const ward = getRandomItem(wards);

      const firstName = getRandomItem(NAMES);
      const lastName = getRandomItem(LAST_NAMES);
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}`;
      const name = `${firstName} ${lastName}`;
      const diet = getRandomItem(DIETS);
      const commute = getRandomItem(COMMUTES);

      const userId = db.prepare(`
        INSERT INTO users (username, password, name, state, city, ward, diet, commute)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(username, hashPassword('password123'), name, state, city, ward, diet, commute).lastInsertRowid;

      userIds.push(userId);
    }

    console.log("Generating 90 days of logs per user...");
    const today = new Date();
    const insertLog = db.prepare(`
      INSERT INTO daily_logs (user_id, log_date, food_kg, transport_kg, energy_kg, total_kg, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    userIds.forEach((userId, uidx) => {
      const user = db.prepare('SELECT diet, commute FROM users WHERE id = ?').get(userId);
      const baseline = emissionsEngine.getProfileDailyBaseline(user.diet, user.commute, 12);

      for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
        const logDate = new Date(today);
        logDate.setDate(today.getDate() - dayOffset);
        const logDateStr = logDate.toISOString().slice(0, 10);

        // Add random fluctuations to emulate human behavior
        const noise = (Math.random() - 0.5) * 1.5;
        
        // weekend food spikes for some users
        let foodFluc = 0;
        const dayOfWeek = logDate.getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && uidx % 3 === 0) {
          foodFluc = 2.5; // Weekend spike!
        }

        const food_kg = Math.max(0.5, baseline.food_kg + foodFluc + (Math.random() - 0.5) * 0.5);
        const transport_kg = Math.max(0, baseline.transport_kg + noise * 0.4);
        const energy_kg = Math.max(1.0, baseline.energy_kg + (Math.random() - 0.5) * 0.8);
        const total_kg = Number((food_kg + transport_kg + energy_kg).toFixed(3));

        insertLog.run(
          userId,
          logDateStr,
          food_kg,
          transport_kg,
          energy_kg,
          total_kg,
          JSON.stringify({ note: "Generated daily tracking logs" })
        );
      }
    });

    console.log("Seeding receipt/bill scans...");
    const insertBill = db.prepare(`
      INSERT INTO bill_scans (user_id, scan_date, type, provider, amount, units, co2_kg, billing_period, image_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertReceipt = db.prepare(`
      INSERT INTO receipt_scans (user_id, scan_date, items, total_kg, image_name)
      VALUES (?, ?, ?, ?, ?)
    `);

    const billProviders = {
      electricity: ["BESCOM", "Tata Power", "Adani", "BSES", "CESC"],
      gas: ["Mahanagar Gas", "IGL"],
      lpg: ["Indane", "HP Gas", "Bharat Gas"],
      petrol: ["IOCL", "BPCL", "HPCL", "Shell"],
      diesel: ["IOCL", "BPCL", "HPCL", "Shell"]
    };

    const receiptItemOptions = [
      { name: "Beef Steak 1kg", category: "beef", weight_kg: 1.0 },
      { name: "Chicken Breast 500g", category: "chicken", weight_kg: 0.5 },
      { name: "Basmati Rice 2kg", category: "rice", weight_kg: 2.0 },
      { name: "Assorted Vegetables 1kg", category: "vegetables", weight_kg: 1.0 },
      { name: "Amul Butter & Cheese", category: "dairy", weight_kg: 0.8 },
      { name: "Wheat Atta 5kg", category: "wheat", weight_kg: 5.0 }
    ];

    userIds.forEach(userId => {
      // Generate 4-8 scans per user
      const scanCount = 4 + Math.floor(Math.random() * 5);
      for (let s = 0; s < scanCount; s++) {
        const dayOffset = 5 + Math.floor(Math.random() * 80);
        const scanDate = new Date(today);
        scanDate.setDate(today.getDate() - dayOffset);
        const scanDateStr = scanDate.toISOString().slice(0, 10);

        if (s % 2 === 0) {
          // Utility Bill scan
          const type = getRandomItem(["electricity", "gas", "lpg", "petrol", "diesel"]);
          const provider = getRandomItem(billProviders[type]);
          const units = 20 + Math.floor(Math.random() * 150);
          const co2_kg = emissionsEngine.calculateEnergyEmissions(type, units);
          const amount = Math.round(units * 6.5);
          const period = scanDateStr.slice(0, 7);

          insertBill.run(
            userId,
            scanDateStr,
            type,
            provider,
            amount,
            units,
            co2_kg,
            period,
            `bill_${type}_${s}.png`
          );
        } else {
          // Grocery Receipt scan
          const items = [];
          let total_kg = 0;
          const itemCount = 2 + Math.floor(Math.random() * 3);
          
          for (let i = 0; i < itemCount; i++) {
            const itemTpl = getRandomItem(receiptItemOptions);
            const itemCo2 = emissionsEngine.calculateFoodEmissions(itemTpl.category, itemTpl.weight_kg);
            items.push({
              name: itemTpl.name,
              category: itemTpl.category,
              weight_kg: itemTpl.weight_kg,
              co2_kg: itemCo2
            });
            total_kg += itemCo2;
          }

          insertReceipt.run(
            userId,
            scanDateStr,
            JSON.stringify(items),
            Number(total_kg.toFixed(3)),
            `receipt_${s}.png`
          );
        }
      }
    });

    console.log("Computing location aggregates for ward_aggregates...");
    // Calculate average daily emissions per user in each locality, city, and state
    const insertAggregate = db.prepare(`
      INSERT INTO ward_aggregates (location_level, state, city, ward, avg_co2_kg, total_users)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Ward level
    const wardAvgs = db.prepare(`
      SELECT users.state, users.city, users.ward, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
      FROM daily_logs 
      JOIN users ON daily_logs.user_id = users.id
      GROUP BY users.state, users.city, users.ward
    `).all();
    
    wardAvgs.forEach(row => {
      insertAggregate.run('ward', row.state, row.city, row.ward, row.avg_co2, row.user_count);
    });

    // City level
    const cityAvgs = db.prepare(`
      SELECT users.state, users.city, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
      FROM daily_logs 
      JOIN users ON daily_logs.user_id = users.id
      GROUP BY users.state, users.city
    `).all();

    cityAvgs.forEach(row => {
      insertAggregate.run('city', row.state, row.city, '', row.avg_co2, row.user_count);
    });

    // State level
    const stateAvgs = db.prepare(`
      SELECT users.state, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
      FROM daily_logs 
      JOIN users ON daily_logs.user_id = users.id
      GROUP BY users.state
    `).all();

    stateAvgs.forEach(row => {
      insertAggregate.run('state', row.state, '', '', row.avg_co2, row.user_count);
    });

    console.log("Running agentic loops to seed initial agent runs history...");
    // Run deterministic loops for some users to generate Feed history
    const sampleUsers = userIds.slice(0, 15);
    sampleUsers.forEach(uid => {
      agentService.runDeterministicLoop(uid);
    });
  });

  performSeeding();
  console.log("Database seeded successfully!");
}

if (require.main === module) {
  runSeed();
}
