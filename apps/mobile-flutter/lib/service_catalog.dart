import 'package:flutter/material.dart';

// Shared service catalog used by both Instant Quote and Post a Job so the two
// flows ask the exact same structured questions. Labels/option values stay in
// English on purpose — they're the semantic input sent to the pricing AI (the
// category chip shown to the user is localised via [nameKey]).

class ServiceCat {
  // `name` (English) is the key into kServiceTasks and part of the AI request.
  // `nameKey` is the categories.* translation key for the displayed chip label.
  // `icon` matches the customer dashboard's outlined-icon style (emoji kept for
  // any legacy use, but the flows now render `icon`).
  final String name, emoji, api, nameKey;
  final Color color;
  final IconData icon;
  const ServiceCat(this.name, this.emoji, this.api, this.color, this.nameKey, this.icon);
}

const kServiceCats = [
  ServiceCat('Plumbing', '🔧', 'PLUMBING', Color(0xFF38BDF8), 'categories.plumbing', Icons.water_drop_outlined),
  ServiceCat('Electrical', '⚡', 'ELECTRICAL', Color(0xFFF59E0B), 'categories.electrical', Icons.bolt_outlined),
  ServiceCat('Carpentry', '🪵', 'CARPENTRY', Color(0xFFD97706), 'categories.carpentry', Icons.handyman_outlined),
  ServiceCat('Painting', '🎨', 'PAINTING', Color(0xFFA78BFA), 'categories.painting', Icons.palette_outlined),
  ServiceCat('Cleaning', '✨', 'CLEANING', Color(0xFF34D399), 'categories.cleaning', Icons.auto_awesome_outlined),
  ServiceCat('Moving', '📦', 'MOVING', Color(0xFFFB923C), 'categories.moving', Icons.local_shipping_outlined),
  // No ASSEMBLY enum on the backend — Assembly is stored as GENERAL.
  ServiceCat('Assembly', '🪑', 'GENERAL', Color(0xFF8B5CF6), 'categories.assembly', Icons.chair_outlined),
  ServiceCat('HVAC', '❄️', 'HVAC', Color(0xFF22D3EE), 'categories.hvac', Icons.ac_unit_outlined),
  ServiceCat('Roofing', '🏠', 'ROOFING', Color(0xFFEF4444), 'categories.roofing', Icons.roofing_outlined),
  ServiceCat('Landscaping', '🌿', 'LANDSCAPING', Color(0xFF22C55E), 'categories.landscaping', Icons.eco_outlined),
  ServiceCat('Appliance Repair', '🔌', 'APPLIANCE_REPAIR', Color(0xFF64748B), 'categories.appliance', Icons.kitchen_outlined),
  ServiceCat('Laundry', '🧺', 'LAUNDRY', Color(0xFF14B8A6), 'categories.laundry', Icons.local_laundry_service_outlined),
  ServiceCat('General', '🛠️', 'GENERAL', Color(0xFF94A3B8), 'categories.general', Icons.build_outlined),
];

// task label -> list of details {key, label, options}
const Map<String, List<Map<String, dynamic>>> kServiceTasks = {
  'Plumbing': [
    {'label': 'Fix Leaky Faucet', 'details': [
      {'key': 'location', 'label': 'Location', 'options': ['Kitchen', 'Bathroom', 'Outdoor']},
      {'key': 'parts', 'label': 'Parts supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Install Faucet', 'details': [
      {'key': 'location', 'label': 'Location', 'options': ['Kitchen', 'Bathroom']},
      {'key': 'parts', 'label': 'Faucet supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Unclog Drain', 'details': [
      {'key': 'drain', 'label': 'Which drain?', 'options': ['Kitchen sink', 'Bathroom sink', 'Shower / tub', 'Toilet']}]},
    {'label': 'Fix Running Toilet', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Keeps running', 'Weak flush', 'Leaking at base']}]},
    {'label': 'Install Toilet', 'details': [
      {'key': 'parts', 'label': 'Toilet supplied by', 'options': ['Me', 'Handyman']},
      {'key': 'removal', 'label': 'Remove old toilet?', 'options': ['Yes', 'No']}]},
    {'label': 'Replace Water Heater', 'details': [
      {'key': 'type', 'label': 'Type', 'options': ['Tank (electric)', 'Tank (gas)', 'Tankless']}]},
    {'label': 'Install Garbage Disposal', 'details': [
      {'key': 'parts', 'label': 'Disposal supplied by', 'options': ['Me', 'Handyman']}]},
  ],
  'Electrical': [
    {'label': 'Install Ceiling Fan', 'details': [
      {'key': 'height', 'label': 'Ceiling height', 'options': ['8 ft', '9 ft', '10+ ft', 'Vaulted']},
      {'key': 'preWired', 'label': 'Pre-wired box?', 'options': ['Yes', 'No — needs wiring']},
      {'key': 'fan', 'label': 'Fan supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Replace Outlet', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']},
      {'key': 'type', 'label': 'Type', 'options': ['Standard', 'GFCI', 'USB combo']}]},
    {'label': 'Install Light Fixture', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']}]},
    {'label': 'Install Smart Switch / Dimmer', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']}]},
    {'label': 'Install Smoke / CO Detector', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']},
      {'key': 'power', 'label': 'Power', 'options': ['Battery', 'Hardwired']}]},
    {'label': 'Mount Wall TV Outlet', 'details': [
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick']}]},
  ],
  'Carpentry': [
    {'label': 'Assemble Furniture', 'details': [
      {'key': 'pieces', 'label': 'Number of pieces', 'options': ['1', '2–3', '4+']},
      {'key': 'size', 'label': 'Largest piece', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Install Shelving', 'details': [
      {'key': 'shelves', 'label': 'Number of shelves', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Repair / Adjust Door', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Sticks / rubs', 'Won\'t latch', 'Squeaks', 'Replace hinges']}]},
    {'label': 'Install Baseboards / Trim', 'details': [
      {'key': 'length', 'label': 'Approx. length', 'options': ['1 room', '2–3 rooms', 'Whole home']}]},
    {'label': 'Build Custom Shelves', 'details': [
      {'key': 'size', 'label': 'Size', 'options': ['Small', 'Medium', 'Large / built-in']}]},
  ],
  'Painting': [
    {'label': 'Paint a Room', 'details': [
      {'key': 'size', 'label': 'Room size', 'options': ['Small', 'Medium', 'Large']},
      {'key': 'coats', 'label': 'Coats', 'options': ['1 coat', '2 coats']}]},
    {'label': 'Patch & Paint Wall', 'details': [
      {'key': 'patches', 'label': 'Damage level', 'options': ['1–2 small holes', '3–5 holes', 'Large area']}]},
    {'label': 'Paint Cabinets', 'details': [
      {'key': 'count', 'label': 'How many cabinets?', 'options': ['Under 10', '10–20', '20+']}]},
    {'label': 'Stain a Deck', 'details': [
      {'key': 'size', 'label': 'Deck size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Paint Trim / Doors', 'details': [
      {'key': 'count', 'label': 'How many?', 'options': ['1–3', '4–8', '8+']}]},
  ],
  'Cleaning': [
    {'label': 'Standard Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'baths', 'label': 'Bathrooms', 'options': ['1', '2', '3+']}]},
    {'label': 'Deep Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'baths', 'label': 'Bathrooms', 'options': ['1', '2', '3+']}]},
    {'label': 'Move-Out Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']}]},
    {'label': 'Window Cleaning', 'details': [
      {'key': 'windows', 'label': 'How many windows?', 'options': ['Under 10', '10–20', '20+']}]},
    {'label': 'Carpet Cleaning', 'details': [
      {'key': 'rooms', 'label': 'How many rooms?', 'options': ['1', '2–3', '4+']}]},
  ],
  'Moving': [
    {'label': 'Local Move', 'details': [
      {'key': 'size', 'label': 'Home size', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'distance', 'label': 'Distance', 'options': ['< 5 miles', '5–15 miles', '15–30 miles', '30+ miles']}]},
    {'label': 'Load / Unload Truck', 'details': [
      {'key': 'size', 'label': 'Home size', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']}]},
    {'label': 'Rearrange Furniture', 'details': [
      {'key': 'pieces', 'label': 'How many pieces?', 'options': ['1–3', '4–8', '8+']}]},
  ],
  'Assembly': [
    {'label': 'Assemble Furniture', 'details': [
      {'key': 'pieces', 'label': 'Number of pieces', 'options': ['1', '2–3', '4+']},
      {'key': 'size', 'label': 'Largest piece', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Mount TV', 'details': [
      {'key': 'tvSize', 'label': 'TV size', 'options': ['Under 40"', '40–55"', '55–75"', '75"+']},
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick', 'Tile']}]},
    {'label': 'Assemble Exercise Equipment', 'details': [
      {'key': 'size', 'label': 'Size', 'options': ['Small', 'Medium', 'Large / multi-station']}]},
    {'label': 'Assemble Playset / Trampoline', 'details': [
      {'key': 'size', 'label': 'Size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Mount Shelves / Cabinets', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1–2', '3–5', '6+']},
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick', 'Tile']}]},
  ],
  'HVAC': [
    {'label': 'Service AC Unit', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Not cooling', 'Weak airflow', 'Making noise', 'Routine tune-up']}]},
    {'label': 'Repair Furnace / Heating', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['No heat', 'Weak heat', 'Strange noise', 'Routine tune-up']}]},
    {'label': 'Install Thermostat', 'details': [
      {'key': 'type', 'label': 'Type', 'options': ['Standard', 'Programmable', 'Smart']}]},
    {'label': 'Install Window AC', 'details': [
      {'key': 'size', 'label': 'Unit size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Clean Ducts / Vents', 'details': [
      {'key': 'vents', 'label': 'How many vents?', 'options': ['Under 5', '5–10', '10+']}]},
    {'label': 'Replace Air Filter', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']}]},
  ],
  'Roofing': [
    {'label': 'Fix Roof Leak', 'details': [
      {'key': 'roof', 'label': 'Roof type', 'options': ['Shingle', 'Metal', 'Flat', 'Tile']}]},
    {'label': 'Replace Shingles', 'details': [
      {'key': 'area', 'label': 'Area', 'options': ['A few shingles', 'Small section', 'Large section']}]},
    {'label': 'Repair Flashing', 'details': [
      {'key': 'location', 'label': 'Location', 'options': ['Chimney', 'Vent', 'Skylight', 'Valley']}]},
    {'label': 'Clean Gutters', 'details': [
      {'key': 'stories', 'label': 'Home height', 'options': ['1 story', '2 story', '3+ story']}]},
    {'label': 'Roof Inspection', 'details': [
      {'key': 'stories', 'label': 'Home height', 'options': ['1 story', '2 story', '3+ story']}]},
  ],
  'Landscaping': [
    {'label': 'Lawn Mowing', 'details': [
      {'key': 'size', 'label': 'Yard size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Tree / Shrub Trimming', 'details': [
      {'key': 'count', 'label': 'How many?', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Yard Cleanup', 'details': [
      {'key': 'size', 'label': 'Yard size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Mulching / Planting', 'details': [
      {'key': 'area', 'label': 'Area', 'options': ['Small bed', 'Medium', 'Large']}]},
    {'label': 'Leaf Removal', 'details': [
      {'key': 'size', 'label': 'Yard size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Sod / Seeding', 'details': [
      {'key': 'area', 'label': 'Area', 'options': ['Small', 'Medium', 'Large']}]},
  ],
  'Appliance Repair': [
    {'label': 'Repair Refrigerator', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Not cooling', 'Leaking', 'Noisy', 'Ice maker']}]},
    {'label': 'Repair Washer', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ["Won't drain", "Won't spin", 'Leaking', "Won't start"]}]},
    {'label': 'Repair Dryer', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['No heat', "Won't tumble", 'Noisy', 'Takes too long']}]},
    {'label': 'Repair Dishwasher', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Not cleaning', 'Leaking', "Won't drain", "Won't start"]}]},
    {'label': 'Repair Oven / Stove', 'details': [
      {'key': 'type', 'label': 'Type', 'options': ['Electric', 'Gas']},
      {'key': 'issue', 'label': 'Issue', 'options': ['Not heating', 'Uneven heat', 'Burner out']}]},
    {'label': 'Install Appliance', 'details': [
      {'key': 'appliance', 'label': 'Which appliance?', 'options': ['Dishwasher', 'Washer', 'Dryer', 'Range', 'Microwave']}]},
  ],
  'Laundry': [
    {'label': 'Wash & Fold', 'details': [
      {'key': 'load', 'label': 'How much?', 'options': ['1 load', '2–3 loads', '4+ loads']}]},
    {'label': 'Ironing', 'details': [
      {'key': 'items', 'label': 'How many items?', 'options': ['Under 10', '10–20', '20+']}]},
    {'label': 'Pickup & Delivery', 'details': [
      {'key': 'load', 'label': 'How much?', 'options': ['Small', 'Medium', 'Large']}]},
  ],
  'General': [
    {'label': 'TV Mounting', 'details': [
      {'key': 'tvSize', 'label': 'TV size', 'options': ['Under 40"', '40–55"', '55–75"', '75"+']},
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick', 'Tile']}]},
    {'label': 'Picture Hanging', 'details': [
      {'key': 'qty', 'label': 'How many items?', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Assembly & Mounting', 'details': [
      {'key': 'item', 'label': 'What to assemble?', 'options': ['TV stand', 'Desk', 'Shelving unit', 'Exercise equipment']}]},
    {'label': 'Gutter Cleaning', 'details': [
      {'key': 'stories', 'label': 'Home height', 'options': ['1 story', '2 story', '3+ story']}]},
    {'label': 'Curtain / Blind Install', 'details': [
      {'key': 'windows', 'label': 'How many windows?', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Pressure Washing', 'details': [
      {'key': 'area', 'label': 'What area?', 'options': ['Driveway', 'Patio / deck', 'House siding', 'Fence']}]},
  ],
};
